/**
 * Tests for the controlled outbound-webhook verification helper + script.
 *
 * Two layers:
 *   A. PURE-FUNCTION tests on src/lib/partner-webhook/test-event.ts:
 *      - HMAC signature matches a hand-computed reference for known inputs.
 *      - Payload contains test=true and event="partner.webhook.test".
 *      - Header set carries X-Vektrum-Test: true.
 *      - The helper uses the SAME signing scheme as production
 *        (src/lib/engine/partner-webhook.ts) — verified by string match
 *        of the canonical "${timestampS}.${bodyJson}" line.
 *
 *   B. STATIC-SOURCE tests on scripts/send-test-partner-webhook.ts:
 *      - The script does not import or call Stripe.
 *      - The script does not import production release-gate code.
 *      - The script does not call any function that mutates milestone,
 *        deal, release, billing_records, or audit_log rows.
 *      - The script does not POST to any production /api/* route.
 *
 * No real HTTP request is made. No real database is queried. No env vars
 * are required to run this test.
 *
 * Run:  npx tsx tests/partner-webhook-test-event.test.ts
 */

import fs from 'fs'
import path from 'path'
import { createHmac } from 'crypto'
import { fileURLToPath } from 'url'

import {
  buildTestPayload,
  signWebhook,
  buildHeaders,
} from '../src/lib/partner-webhook/test-event'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

// ─── Test runner ──────────────────────────────────────────────────────────────

const results: { name: string; passed: boolean; error?: string }[] = []

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    results.push({ name, passed: true })
  } catch (e) {
    results.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) })
  }
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

/**
 * Strip TS/JS comments and string literals so the safety regexes only see
 * executable code. Without this, mentions of forbidden symbols inside the
 * script's own SAFETY GUARANTEES comment block would trigger false positives.
 *
 * Order matters: line comments first, then block comments, then strings.
 */
function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, '')        // // line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')  // /* block comments */
    .replace(/`(?:\\.|[^`\\])*`/g, '``') // template literals
    .replace(/'(?:\\.|[^'\\])*'/g, "''") // single-quoted strings
    .replace(/"(?:\\.|[^"\\])*"/g, '""') // double-quoted strings
}

const SCRIPT_PATH      = path.join(ROOT, 'scripts/send-test-partner-webhook.ts')
const HELPER_PATH      = path.join(ROOT, 'src/lib/partner-webhook/test-event.ts')
const PRODUCTION_PATH  = path.join(ROOT, 'src/lib/engine/partner-webhook.ts')

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── A1. Payload shape ─────────────────────────────────────────────────────────

await test('PAYLOAD: event is "partner.webhook.test" and test flag is true', () => {
  const p = buildTestPayload({
    partnerId:   'partner-uuid-1',
    partnerName: 'Controlled Webhook Test Partner',
    nowMs:       1_700_000_000_000,
    nonce:       'deadbeefcafe',
  })
  assert(p.event === 'partner.webhook.test',
    `event must be 'partner.webhook.test' (distinct from production 'release.authorized'). Got: ${p.event}`)
  assert(p.test === true, 'payload.test must be exactly true.')
})

await test('PAYLOAD: ids are clearly fake (test_ prefix, no real UUID)', () => {
  const p = buildTestPayload({
    partnerId: 'p1', partnerName: 'x', nowMs: 1_700_000_000_000, nonce: 'aaaa',
  })
  for (const id of [p.release_id, p.deal_id, p.milestone_id]) {
    assert(id.startsWith('test_'), `Fake id must start with 'test_'. Got: ${id}`)
    // No UUID pattern (8-4-4-4-12 hex with dashes).
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    assert(!uuidRe.test(id), `Fake id must not look like a UUID. Got: ${id}`)
  }
  assert(p.idempotency_key.startsWith('test_'), 'idempotency_key must start with test_.')
})

await test('PAYLOAD: includes partner_id, partner_name, and human-readable test note', () => {
  const p = buildTestPayload({
    partnerId: 'partner-uuid-1', partnerName: 'Controlled Webhook Test Partner',
    nowMs: 1_700_000_000_000, nonce: 'aaaa',
  })
  assert(p.partner_id === 'partner-uuid-1', 'partner_id must be preserved.')
  assert(p.partner_name === 'Controlled Webhook Test Partner', 'partner_name must be preserved.')
  assert(/not a real release/i.test(p.note), 'note must explicitly state this is not a real release.')
  assert(/no money/i.test(p.note), 'note must explicitly state no money has moved.')
})

await test('PAYLOAD: emitted_at is ISO-8601 reflecting nowMs input', () => {
  const p = buildTestPayload({
    partnerId: 'p1', partnerName: 'x', nowMs: 1_700_000_000_000, nonce: 'aaaa',
  })
  assert(p.emitted_at === '2023-11-14T22:13:20.000Z',
    `emitted_at should reflect the injected nowMs. Got: ${p.emitted_at}`)
})

// ── A2. Signing — HMAC matches hand-computed reference ────────────────────────

await test('SIGNATURE: HMAC-SHA256 matches hand-computed hex for fixed inputs', () => {
  const body       = '{"event":"partner.webhook.test","test":true}'
  const secret     = 'whsec_test_controlled_verification_123456789'
  const timestampS = 1_700_000_000

  const got = signWebhook({ body, secret, timestampS })

  // Hand-compute the expected value the same way a partner would.
  const expectedHex = createHmac('sha256', secret).update(`${timestampS}.${body}`).digest('hex')

  assert(got.signedString === `${timestampS}.${body}`,
    `signedString must be "<ts>.<body>". Got: ${got.signedString}`)
  assert(got.hexDigest === expectedHex,
    `HMAC mismatch. Expected ${expectedHex}, got ${got.hexDigest}`)
  assert(got.headerValue === `t=${timestampS},sha256=${expectedHex}`,
    `Header value must be "t=<ts>,sha256=<hex>". Got: ${got.headerValue}`)
})

await test('SIGNATURE: partner using the supplied secret can verify the signature', () => {
  // Simulate the partner-side verification path end-to-end.
  const partnerSecret = 'whsec_test_controlled_verification_123456789'
  const payload       = buildTestPayload({
    partnerId: 'p1', partnerName: 'Controlled', nowMs: 1_700_000_000_000, nonce: 'cafef00d',
  })
  const body       = JSON.stringify(payload)
  const timestampS = 1_700_000_000
  const sig        = signWebhook({ body, secret: partnerSecret, timestampS })

  // ── Partner side ──────────────────────────────────────────────────────────
  // 1. Parse header.
  const m = sig.headerValue.match(/^t=(\d+),sha256=([0-9a-f]+)$/i)
  assert(m !== null, 'Header must match t=<ts>,sha256=<hex> shape.')
  const [, gotTs, gotHex] = m!
  // 2. Re-compute and compare.
  const expectedHex = createHmac('sha256', partnerSecret)
    .update(`${gotTs}.${body}`)
    .digest('hex')
  assert(gotHex === expectedHex, 'Partner-side recomputation must produce the same hex.')
  // 3. Replay-window check (partner picks 300s tolerance).
  const skewS = Math.abs(timestampS - Number(gotTs))
  assert(skewS === 0, 'Timestamp delivered must equal timestamp signed.')
})

await test('SIGNATURE: signing the same body with a different secret produces a different hex', () => {
  const body = '{"x":1}'
  const ts   = 1_700_000_000
  const a    = signWebhook({ body, secret: 'whsec_a', timestampS: ts })
  const b    = signWebhook({ body, secret: 'whsec_b', timestampS: ts })
  assert(a.hexDigest !== b.hexDigest, 'Different secrets must yield different signatures.')
})

await test('SIGNATURE: helper module uses identical canonical form to production webhook code', () => {
  // The helper file must contain the exact `${opts.timestampS}.${opts.body}` form.
  const helper = read(HELPER_PATH)
  assert(
    /\$\{opts\.timestampS\}\.\$\{opts\.body\}/.test(helper),
    'Helper must compose the signed string as `${opts.timestampS}.${opts.body}` to match production.',
  )
  assert(
    /createHmac\(['"]sha256['"]/.test(helper),
    'Helper must use HMAC-SHA256.',
  )
  // Production file must still use the identical canonical line shape.
  const prod = read(PRODUCTION_PATH)
  assert(
    /\$\{timestampS\}\.\$\{bodyJson\}/.test(prod),
    'Production partner-webhook.ts must still use `${timestampS}.${bodyJson}` — ' +
    'if this changes, helper and script will drift from production.',
  )
  assert(
    /t=\$\{timestampS\},sha256=\$\{hmac\}/.test(prod),
    'Production header format must remain `t=${timestampS},sha256=${hmac}`.',
  )
})

// ── A3. Headers ───────────────────────────────────────────────────────────────

await test('HEADERS: includes X-Vektrum-Test: true so partners can filter', () => {
  const payload = buildTestPayload({
    partnerId: 'p1', partnerName: 'x', nowMs: 1_700_000_000_000, nonce: 'aaaa',
  })
  const headers = buildHeaders({
    payload,
    signatureValue: 't=1700000000,sha256=abc',
    timestampS:     1_700_000_000,
  })
  assert(headers['X-Vektrum-Test'] === 'true', 'X-Vektrum-Test header must be exactly "true".')
  assert(headers['X-Vektrum-Event'] === 'partner.webhook.test',
    'X-Vektrum-Event must reflect the test event name.')
  assert(headers['X-Vektrum-Signature'] === 't=1700000000,sha256=abc',
    'X-Vektrum-Signature must equal the supplied signatureValue.')
  assert(/-1700000000$/.test(headers['X-Vektrum-DeliveryId']!),
    'X-Vektrum-DeliveryId must end with the timestamp.')
})

// ── B. STATIC SAFETY — script does not touch production money paths ──────────

// Code-only view: comments and string literals stripped so safety regexes
// only inspect executable code, not the script's own documentation that
// (correctly) names the forbidden constructs in order to forbid them.
const codeOnly = stripCommentsAndStrings(read(SCRIPT_PATH))

await test('SCRIPT SAFETY: does not import "stripe" or any Stripe module', () => {
  assert(!/from\s+['"]stripe['"]/.test(read(SCRIPT_PATH)),
    'Script must not import "stripe".')
  assert(!/from\s+['"]@\/lib\/stripe/.test(read(SCRIPT_PATH)),
    'Script must not import @/lib/stripe.')
  // After stripping strings, an actual Stripe(...) constructor call would
  // remain. A mention inside a string is allowed (e.g. console error text).
  assert(!/\bStripe\s*\(/.test(codeOnly), 'Script must not instantiate Stripe.')
})

await test('SCRIPT SAFETY: does not import release-gate or production release code', () => {
  // Imports are unaffected by string-stripping (paths inside import strings
  // become "" but the import keyword + "from" remains a recognizable shape).
  // Easiest check: no `from "...release-gate..."` survives in the original source.
  const src = read(SCRIPT_PATH)
  assert(!/from\s+['"][^'"]*release-gate[^'"]*['"]/.test(src),
    'Script must not import any module whose path contains "release-gate".')
  assert(!/from\s+['"]@\/lib\/engine\/partner-webhook['"]/.test(src),
    'Script must not import production partner-webhook (would risk pulling delivery code).')
  // Function-call check: after stripping strings, none of these symbols may
  // appear as a callable identifier.
  for (const fn of ['validateRelease', 'reserveReleaseFunds', 'executeRelease', 'deliverPartnerWebhook']) {
    const re = new RegExp(`\\b${fn}\\s*\\(`)
    assert(!re.test(codeOnly), `Script must not call ${fn}().`)
  }
})

await test('SCRIPT SAFETY: does not write to deals, milestones, releases, billing, or audit', () => {
  // Use codeOnly so .update() inside a sample console.log string does NOT trip
  // the check (the script prints a partner-side verification example).
  for (const verb of ['insert', 'update', 'delete', 'upsert']) {
    const re = new RegExp(`\\.${verb}\\s*\\(`)
    assert(!re.test(codeOnly),
      `Script must not call .${verb}() on any Supabase table — this is a read-only verification tool.`)
  }
  // Defense-in-depth: no .from('deals'/'milestones'/'releases'/...). We use the
  // ORIGINAL source for this check so the table-name string itself is what we match.
  const src = read(SCRIPT_PATH)
  for (const tbl of ['deals', 'milestones', 'releases', 'billing_records', 'transaction_receipts', 'audit_log', 'admin_audit_log']) {
    const re = new RegExp(`\\.from\\(\\s*['"]${tbl}['"]\\s*\\)`)
    assert(!re.test(src),
      `Script must not reference public.${tbl} — only public.partners (read-only) is allowed.`)
  }
  // Whitelist: it is allowed (and required) to read public.partners.
  assert(
    /\.from\(\s*['"]partners['"]\s*\)/.test(src),
    'Script should read from public.partners to look up the test partner.',
  )
})

await test('SCRIPT SAFETY: does not POST to any /api/* route on the Vektrum app', () => {
  // Match against ORIGINAL source — string-stripping would erase the very
  // thing we want to detect (URL inside a string literal).
  const src = read(SCRIPT_PATH)
  const apiCalls = src.match(/['"`][^'"`]*\/api\/[^'"`]*['"`]/g) ?? []
  assert(apiCalls.length === 0,
    `Script must not POST to any /api/* path. Found: ${apiCalls.join(', ')}`)
})

await test('SCRIPT SAFETY: does not READ Stripe / DocuSign env vars (only Supabase)', () => {
  // Stripe/DocuSign env-var NAMES must not appear as runtime reads (process.env.X).
  // A mention inside a comment is allowed (the safety header explicitly names
  // them in order to forbid them).
  for (const v of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
                   'DOCUSIGN_PRIVATE_KEY', 'DOCUSIGN_WEBHOOK_SECRET',
                   'DOCUSIGN_INTEGRATION_KEY']) {
    const re = new RegExp(`process\\.env\\.${v}\\b`)
    assert(!re.test(codeOnly),
      `Script must not read process.env.${v}. The verification tool only needs Supabase service-role access.`)
  }
  // CRON_SECRET is in the same family but is allowed to appear in the
  // forbid-list comment; verify it never appears as an actual read.
  assert(!/process\.env\.CRON_SECRET\b/.test(codeOnly),
    'Script must not read process.env.CRON_SECRET.')
})

await test('SCRIPT SAFETY: explicit safety comment block is present and intact', () => {
  const src = read(SCRIPT_PATH)
  assert(/SAFETY GUARANTEES/i.test(src),
    'Script header must contain a SAFETY GUARANTEES comment block.')
  assert(/release-gate/i.test(src) && /Stripe/i.test(src),
    'Safety block must explicitly enumerate release-gate and Stripe as off-limits ' +
    'so a future maintainer cannot remove a constraint without noticing.')
  assert(/event name is\s*[`'"]partner\.webhook\.test[`'"]/i.test(src),
    'Safety block must call out that the event name is partner.webhook.test, ' +
    'distinct from production release.authorized.')
})

// ─── Report ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — PARTNER WEBHOOK TEST-EVENT RESULTS')
console.log('════════════════════════════════════════════════════════════════════════')
for (const r of results) {
  if (r.passed) console.log(`  ✓  ${r.name}`)
  else          console.log(`  ✗  ${r.name}\n     ${r.error}`)
}
const passed = results.filter(r => r.passed).length
const failed = results.length - passed
console.log('════════════════════════════════════════════════════════════════════════')
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('════════════════════════════════════════════════════════════════════════')
console.log('')

if (failed > 0) process.exit(1)
}

main()
