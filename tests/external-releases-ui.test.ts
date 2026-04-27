/**
 * External-manual operator UI tests — static safety + visibility checks.
 *
 * No live DB. No rendering. These tests parse the route, panel, and admin
 * page sources and assert the hard guarantees from the approved plan:
 *
 *   - Admin route still requires admin + AAL2 MFA.
 *   - Admin route SELECT now joins partners (so partner_name is surfaced).
 *   - Panel is read-only: no <button>, <form>, onClick, fetch/POST/mutate.
 *   - Panel never renders partner secrets, Stripe keys, or webhook URLs.
 *   - Panel imports are presentational only (no Supabase, partner-webhook
 *     delivery, release-gate, or Stripe imports).
 *   - Admin page renders the panel AFTER the redirect('/dashboard') gate.
 *   - No public surface (no /api/(public) route, no middleware pass-through).
 *   - Wording is "tamper-evident", never "tamper-proof".
 *
 * Run:  npx tsx tests/external-releases-ui.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

function read(p: string): string { return fs.readFileSync(p, 'utf-8') }

const ROUTE      = path.join(ROOT, 'src/app/api/admin/ops/external-releases/route.ts')
const PANEL      = path.join(ROOT, 'src/components/admin/ExternalReleasesPanel.tsx')
const ADMIN_PAGE = path.join(ROOT, 'src/app/dashboard/admin/page.tsx')
const MIDDLEWARE = path.join(ROOT, 'src/middleware.ts')

// Strip JS/TS comments + string literals so safety regexes only see executable code.
function codeOnly(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── 1. Route auth: admin + MFA still enforced ────────────────────────────────

await test('ROUTE: GET still requires getAuthUser + requireRole(admin) + requireMFA', () => {
  const src = read(ROUTE)
  assert(/getAuthUser\(/.test(src),       'Admin route must call getAuthUser.')
  assert(/requireRole\([^)]*admin/.test(src),
    'Admin route must call requireRole with admin.')
  assert(/requireMFA\(/.test(src),
    'Admin route must call requireMFA (AAL2 enforcement).')
})

await test('ROUTE: SELECT joins partners so partner_name can be projected', () => {
  const src = read(ROUTE)
  assert(/partner:partners!deals_partner_id_fkey\s*\(\s*id\s*,\s*name\s*\)/.test(src),
    'Route SELECT must include `partner:partners!deals_partner_id_fkey ( id, name )` ' +
    'inside the deals subselect so the panel can render partner names.')
  assert(/partner_name:\s*r\.deals\?\.partner\?\.name/.test(src),
    'Route shape() must surface partner_name in the projected row.')
})

await test('ROUTE: still read-only — no .insert/.update/.delete/.upsert anywhere', () => {
  const src = codeOnly(read(ROUTE))
  for (const verb of ['insert', 'update', 'delete', 'upsert']) {
    const re = new RegExp(`\\.${verb}\\s*\\(`)
    assert(!re.test(src), `Admin ops route must not call .${verb}() — read-only by design.`)
  }
})

// ── 2. Panel: read-only + no secrets ─────────────────────────────────────────

await test('PANEL: contains no action affordances (button, form, onClick, mutating fetch)', () => {
  const src = read(PANEL)
  for (const tag of ['<button', '<form', 'onClick=', 'onSubmit=']) {
    assert(!src.includes(tag), `Panel must not contain ${tag} — UI is strictly read-only.`)
  }
  // No fetch / POST / mutating verbs in code (string-strip first so a comment
  // that mentions them is allowed).
  const code = codeOnly(src)
  assert(!/\bfetch\s*\(/.test(code), 'Panel must not call fetch() — read-only view.')
  for (const verb of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const re = new RegExp(`method:\\s*['\\"\`]${verb}`)
    assert(!re.test(code), `Panel must not issue ${verb} — read-only view.`)
  }
})

await test('PANEL: never renders partner secrets, Stripe keys, or webhook URLs', () => {
  // Strip comments + string literals so the panel's own SAFETY documentation
  // (which correctly names these symbols in order to forbid them) does not
  // false-positive. We're checking for actual code references.
  const src = codeOnly(read(PANEL))
  for (const forbidden of [
    'webhook_signing_secret',
    'api_key_hash',
    'webhook_url',
    'STRIPE_SECRET_KEY',
    'CRON_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]) {
    assert(!src.includes(forbidden),
      `Panel must not reference ${forbidden}. Operators see counts and IDs only.`)
  }
  // Bearer tokens never appear as a runtime value in a presentational view.
  assert(!/Bearer\s+/.test(src),
    'Panel must not construct or render a Bearer token string.')
})

await test('PANEL: imports are presentational only (no DB / no rail / no auth code)', () => {
  const src = read(PANEL)
  const forbiddenImports = [
    '@/lib/supabase',
    '@/lib/engine/release-gate',
    '@/lib/engine/partner-webhook',
    '@/lib/stripe',
    '@/lib/auth',
  ]
  for (const m of forbiddenImports) {
    const re = new RegExp(`from\\s+['"]${m}`, 'i')
    assert(!re.test(src), `Panel must not import ${m}. Presentational only.`)
  }
})

await test('PANEL: uses "tamper-evident" framing, never "tamper-proof"', () => {
  const src = read(PANEL)
  assert(!/tamper-proof/i.test(src),
    'Panel copy must NOT use "tamper-proof" — Vektrum positioning forbids it.')
})

await test('PANEL: surfaces all required columns from the requirements list', () => {
  // Requirements 3.* — release ID, deal title, milestone title, partner name,
  // amount, execution_status, age, payment reference status, proof status,
  // counterparties (contractor + funder).
  const src = read(PANEL)
  for (const field of [
    'release_id',
    'deal_title',
    'milestone_title',
    'partner_name',
    'amount',
    'execution_status',
    'payment_reference',
    'proof_document_id',
    'age_hours',
    'contractor_name',
    'funder_name',
  ]) {
    assert(src.includes(field),
      `Panel must reference field "${field}" so operators can see it.`)
  }
})

// ── 3. Admin page wiring ─────────────────────────────────────────────────────

await test('ADMIN PAGE: imports the panel and the in-process data helper', () => {
  const src = read(ADMIN_PAGE)
  assert(/from '@\/components\/admin\/ExternalReleasesPanel'/.test(src),
    'Admin page must import ExternalReleasesPanel.')
  assert(/getExternalReleasesData/.test(src),
    'Admin page must reference getExternalReleasesData (in-process projection).')
})

await test('ADMIN PAGE: renders <ExternalReleasesPanel /> AFTER the non-admin redirect gate', () => {
  const src = read(ADMIN_PAGE)
  const redirectIdx = src.search(/redirect\(\s*['"]\/dashboard['"]\s*\)/)
  const renderIdx   = src.search(/<ExternalReleasesPanel\s+data=\{/)
  assert(redirectIdx > -1, 'Admin page must contain a redirect("/dashboard") gate for non-admins.')
  assert(renderIdx > -1,   'Admin page must render <ExternalReleasesPanel data={...} />.')
  assert(redirectIdx < renderIdx,
    'The non-admin redirect gate must appear in source BEFORE the panel render.')
})

await test('ADMIN PAGE: getExternalReleasesData does not write or POST', () => {
  // Walk the admin page source and assert no .insert/.update/.delete in the
  // helper region. (The page already calls .from(...).select(...) for many
  // tables; this catch is defensive against future drift.)
  const src = codeOnly(read(ADMIN_PAGE))
  // Locate the helper body.
  const start = src.indexOf('async function getExternalReleasesData()')
  assert(start > -1, 'Could not locate getExternalReleasesData — test logic out of date.')
  // Body ends at the next top-level `async function` or end-of-file.
  const after = src.slice(start + 1)
  const next  = after.search(/\nasync\s+function\b/)
  const body  = next === -1 ? after : after.slice(0, next)
  for (const verb of ['insert', 'update', 'delete', 'upsert']) {
    const re = new RegExp(`\\.${verb}\\s*\\(`)
    assert(!re.test(body), `getExternalReleasesData must not call .${verb}() — read-only.`)
  }
  assert(!/\bfetch\s*\(/.test(body), 'getExternalReleasesData must not call fetch() — in-process only.')
})

// ── 4. No public surface ─────────────────────────────────────────────────────

await test('NO PUBLIC SURFACE: no /api/(public)/external-releases route exists', () => {
  for (const candidate of [
    'src/app/api/external-releases',
    'src/app/api/(public)/external-releases',
  ]) {
    const p = path.join(ROOT, candidate)
    assert(!fs.existsSync(p),
      `No external-releases route may exist outside /api/admin/. Found: ${candidate}`)
  }
})

await test('NO PUBLIC SURFACE: middleware does NOT pass-through external-releases paths', () => {
  const src = read(MIDDLEWARE)
  assert(!/external-releases/.test(src),
    'Middleware must not list external-releases in any public pass-through. ' +
    'Admin routes flow through the standard /api/* protection.')
})

// ─── Report ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — EXTERNAL-RELEASES UI TEST RESULTS')
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
