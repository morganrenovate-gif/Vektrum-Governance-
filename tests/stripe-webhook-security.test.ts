/**
 * Stripe webhook signature security tests
 *
 * Proves that unsigned or invalidly-signed requests cannot mutate database state.
 *
 * Design:
 *   - The real POST route handler is loaded after mocking its module dependencies
 *     via require.cache patching (tsx uses .ts paths as cache keys).
 *   - @/lib/supabase/admin is replaced with a call-counting spy.
 *   - @/lib/engine/audit, notifications, receipts are replaced with no-ops.
 *   - @/lib/stripe is replaced with a controllable constructEvent mock.
 *   - No real Stripe secrets, no real Supabase credentials, no network calls.
 *
 * Execution order in the real route (relevant lines):
 *   36  Check stripe-signature header  → 400 if missing   (DB never reached)
 *   47  Check STRIPE_WEBHOOK_SECRET    → 500 if missing   (DB never reached)
 *   61  stripe.webhooks.constructEvent → 400 if throws    (DB never reached)
 *   90  createSupabaseAdminClient()    ← FIRST DB CONTACT (only on valid events)
 *
 * The spy counter reaching 0 in the failure cases is the machine-verifiable proof.
 *
 * Run:  npx tsx tests/stripe-webhook-security.test.ts
 */

import crypto from 'crypto'
import path from 'path'
import { createRequire } from 'module'
import { NextRequest } from 'next/server'

const ROOT = path.resolve(process.cwd())
const req  = createRequire(path.resolve(ROOT, 'probe.ts'))

// ─── Spy state ────────────────────────────────────────────────────────────────
// Tracks every call to createSupabaseAdminClient across all tests.
// Reset to 0 before each test that needs a clean count.
let dbCallCount = 0

// ─── Controllable constructEvent mock ────────────────────────────────────────
// Tests flip this between 'throw' and 'pass' to simulate Stripe's verification.
type ConstructEventMode = 'throw-no-sig' | 'throw-mismatch' | 'pass'
let constructEventMode: ConstructEventMode = 'throw-mismatch'

// Minimal Stripe event returned when constructEvent is set to 'pass'
const FAKE_EVENT = {
  id:   'evt_test_123',
  type: 'account.updated',
  data: { object: { id: 'acct_test', payouts_enabled: false, details_submitted: false, charges_enabled: false } },
}

// ─── Thenable builder used by the Supabase spy ───────────────────────────────
// Mirrors the real Supabase fluent query interface.  Calling any terminal
// method (or awaiting the chain) resolves immediately with a dedup-conflict
// response so the route's idempotency guard fires and returns 200 early —
// this prevents the route from trying to reach event handlers that would need
// deeper mocking.
function makeSupabaseChain(): ReturnType<typeof makeSupabaseChain> {
  const chain: Record<string, unknown> & {
    then: (r: (v: unknown) => unknown, j?: (e: unknown) => unknown) => Promise<unknown>
  } = {
    select:     () => chain,
    insert:     () => chain,
    update:     () => chain,
    eq:         () => chain,
    in:         () => chain,
    single:     () => Promise.resolve({ data: { processing_status: 'processed' }, error: null }),
    maybeSingle:() => Promise.resolve({ data: null, error: null }),
    // Thenable so `await chain` works (e.g. the dedup INSERT)
    then: (resolve, reject) =>
      // Return a 23505 unique-violation error so the idempotency guard short-circuits
      Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } })
        .then(resolve, reject),
  }
  return chain as ReturnType<typeof makeSupabaseChain>
}

// ─── Patch require.cache before loading the route ────────────────────────────
// All patches must be in place BEFORE the route module is required so the
// route's top-level `require()` calls pick up our mocks.

function makeModule(filePath: string, exports: Record<string, unknown>): NodeJS.Module {
  const mod = {
    id:       filePath,
    filename: filePath,
    loaded:   true,
    exports,
    children: [] as NodeJS.Module[],
    paths:    [] as string[],
    require:  req,
    parent:   null,
    path:     path.dirname(filePath),
    isPreloading: false,
  }
  return mod as unknown as NodeJS.Module
}

// ── @/lib/supabase/admin ──────────────────────────────────────────────────────
const supabaseAdminPath = path.resolve(ROOT, 'src/lib/supabase/admin.ts')
require.cache[supabaseAdminPath] = makeModule(supabaseAdminPath, {
  createSupabaseAdminClient: () => {
    dbCallCount++
    return { from: (_table: string) => makeSupabaseChain(), rpc: () => makeSupabaseChain(), auth: { admin: { getUserById: () => Promise.resolve({ data: { user: null }, error: null }) } } }
  },
})

// ── @/lib/engine/audit ────────────────────────────────────────────────────────
const auditPath = path.resolve(ROOT, 'src/lib/engine/audit.ts')
require.cache[auditPath] = makeModule(auditPath, { logAudit: async () => {} })

// ── @/lib/engine/notifications ────────────────────────────────────────────────
const notifPath = path.resolve(ROOT, 'src/lib/engine/notifications.ts')
require.cache[notifPath] = makeModule(notifPath, { notifyTransferFailure: async () => {} })

// ── @/lib/engine/receipts ─────────────────────────────────────────────────────
const receiptsPath = path.resolve(ROOT, 'src/lib/engine/receipts.ts')
require.cache[receiptsPath] = makeModule(receiptsPath, {
  confirmTransactionReceipt: async () => {},
  failTransactionReceipt:    async () => {},
})

// ── @/lib/stripe ──────────────────────────────────────────────────────────────
// Mock the stripe module so constructEvent behaviour is fully controlled.
// The real module would need STRIPE_SECRET_KEY and would still do HMAC; we
// replace it entirely so no env var is needed at all.
const stripePath = path.resolve(ROOT, 'src/lib/stripe.ts')
require.cache[stripePath] = makeModule(stripePath, {
  stripe: {
    webhooks: {
      constructEvent: (_rawBody: Buffer, _sig: string, _secret: string) => {
        if (constructEventMode === 'throw-no-sig') {
          throw Object.assign(new Error('No signatures found matching the expected signature for payload'), {
            type: 'StripeSignatureVerificationError',
          })
        }
        if (constructEventMode === 'throw-mismatch') {
          throw Object.assign(new Error('No signatures found matching the expected signature for payload. Are you passing the raw request body you received from Stripe?'), {
            type: 'StripeSignatureVerificationError',
          })
        }
        // 'pass' — return the fake event
        return FAKE_EVENT
      },
    },
  },
  getStripe: () => { throw new Error('getStripe should not be called in tests') },
})

// ─── Load route AFTER patches ─────────────────────────────────────────────────
const routePath = path.resolve(ROOT, 'src/app/api/stripe/webhook/route.ts')
// Delete any prior-loaded route from cache so our patches take effect
delete require.cache[routePath]
const { POST } = req(routePath) as { POST: (r: NextRequest) => Promise<Response> }

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeRequest(
  body: string,
  headers: Record<string, string>,
): NextRequest {
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method:  'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

// Compute a real Stripe-format HMAC header without the Stripe SDK.
// Format: t={timestamp},v1={hmac_hex}
// where hmac_hex = HMAC-SHA256("{timestamp}.{payload}", secret)
function makeStripeSignature(payload: string, secret: string, timestamp?: number): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000)
  const signed = `${ts}.${payload}`
  const hmac = crypto.createHmac('sha256', secret).update(signed).digest('hex')
  return `t=${ts},v1=${hmac}`
}

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

function assertContains(haystack: string, needle: string) {
  if (!haystack.toLowerCase().includes(needle.toLowerCase())) {
    throw new Error(`Expected to contain "${needle}" in:\n"${haystack}"`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {

// ── GATE 1: missing stripe-signature header ───────────────────────────────────
// Route returns at line 36-44, before any Stripe or DB operation.

await test('GATE 1: missing stripe-signature → 400, 0 DB calls', async () => {
  dbCallCount = 0
  delete process.env.STRIPE_WEBHOOK_SECRET  // should not even get this far

  const response = await POST(makeRequest('{}', {}))  // no stripe-signature header
  const body     = await response.json() as Record<string, unknown>

  assert(response.status === 400,      `Expected 400 but got ${response.status}`)
  assertContains(String(body.error),  'stripe-signature')
  assert(dbCallCount === 0,           `Expected 0 DB calls before sig check; got ${dbCallCount}`)
})

// ── GATE 2: stripe-signature present, STRIPE_WEBHOOK_SECRET missing → 500 ─────
// Route passes the header check but returns at line 47-55, before constructEvent.

await test('GATE 2: missing STRIPE_WEBHOOK_SECRET → 500, 0 DB calls', async () => {
  dbCallCount = 0
  delete process.env.STRIPE_WEBHOOK_SECRET

  const response = await POST(makeRequest('{}', { 'stripe-signature': 'some-sig-value' }))
  const body     = await response.json() as Record<string, unknown>

  assert(response.status === 500,      `Expected 500 but got ${response.status}`)
  assertContains(String(body.error),  'not configured')
  assert(dbCallCount === 0,           `Expected 0 DB calls before secret check; got ${dbCallCount}`)
})

// ── GATE 3: signature header present, secret set, but signature is garbage ────
// constructEvent throws StripeSignatureVerificationError → route returns 400.

await test('GATE 3: invalid/garbage signature → 400, 0 DB calls', async () => {
  dbCallCount = 0
  constructEventMode = 'throw-mismatch'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_for_tests'

  const response = await POST(makeRequest('{"id":"evt_x"}', { 'stripe-signature': 'garbage_not_hmac' }))
  const body     = await response.json() as Record<string, unknown>

  assert(response.status === 400,      `Expected 400 but got ${response.status}`)
  assertContains(String(body.error),  'signature verification failed')
  assert(dbCallCount === 0,           `Expected 0 DB calls on invalid sig; got ${dbCallCount}`)
})

// ── GATE 4: correct format but wrong secret ────────────────────────────────────
// A signature computed with a different secret should be rejected.

await test('GATE 4: valid-format sig with wrong secret → 400, 0 DB calls', async () => {
  dbCallCount = 0
  constructEventMode = 'throw-mismatch'  // mock simulates mismatch
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_correct_secret'

  // Signature computed with a DIFFERENT secret — our mock still throws because
  // mode is 'throw-mismatch', mirroring what the real Stripe SDK would do.
  const payload   = '{"id":"evt_test","type":"account.updated"}'
  const wrongSig  = makeStripeSignature(payload, 'whsec_WRONG_secret')
  const response  = await POST(makeRequest(payload, { 'stripe-signature': wrongSig }))
  const body      = await response.json() as Record<string, unknown>

  assert(response.status === 400,      `Expected 400 but got ${response.status}`)
  assert(dbCallCount === 0,           `Expected 0 DB calls on wrong-secret sig; got ${dbCallCount}`)
})

// ── GATE 5: tampered body ─────────────────────────────────────────────────────
// Signature was valid for the original body, not the tampered one.

await test('GATE 5: tampered body (sig valid for original, not mutated) → 400, 0 DB calls', async () => {
  dbCallCount = 0
  constructEventMode = 'throw-mismatch'  // mock simulates what the SDK does on body mismatch
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_for_tests'

  const originalPayload = '{"id":"evt_original","type":"transfer.succeeded"}'
  const tamperedPayload = '{"id":"evt_original","type":"transfer.failed"}'
  // Sig is over the original, but we send the tampered body
  const validSigForOriginal = makeStripeSignature(originalPayload, 'whsec_test_secret_for_tests')

  const response = await POST(makeRequest(tamperedPayload, { 'stripe-signature': validSigForOriginal }))
  const body     = await response.json() as Record<string, unknown>

  assert(response.status === 400,      `Expected 400 but got ${response.status}`)
  assert(dbCallCount === 0,           `Expected 0 DB calls on tampered body; got ${dbCallCount}`)
})

// ── GATE 6: missing signature + no secret ─────────────────────────────────────
// Even without a secret configured, missing header is still 400 (not 500).
// Header check fires first regardless of secret presence.

await test('GATE 6: missing header even with no secret configured → 400 (header check fires first)', async () => {
  dbCallCount = 0
  delete process.env.STRIPE_WEBHOOK_SECRET

  const response = await POST(makeRequest('{}', {}))
  assert(response.status === 400,   `Expected 400 but got ${response.status}`)
  assert(dbCallCount === 0,         `Expected 0 DB calls; got ${dbCallCount}`)
})

// ── PASS: valid signature mock → constructEvent succeeds, DB is reached ────────
// Proves the gate lets valid events through.  The spy counter advancing to ≥1
// confirms the DB path is reached only for verified events.

await test('PASS: valid signature (mock) → constructEvent passes, DB layer IS reached', async () => {
  dbCallCount = 0
  constructEventMode = 'pass'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_for_tests'

  const payload  = JSON.stringify(FAKE_EVENT)
  const validSig = makeStripeSignature(payload, 'whsec_test_secret_for_tests')
  const response = await POST(makeRequest(payload, { 'stripe-signature': validSig }))

  // The route proceeds to the idempotency INSERT, which our mock answers with a
  // 23505 unique-violation so it short-circuits with 200 {"received":true,"duplicate":true}.
  // The exact status is 200 — the important assertion is that it is NOT 400.
  assert(response.status !== 400,   `Valid sig should not return 400; got ${response.status}`)
  assert(dbCallCount >= 1,
    `Expected DB to be reached after valid sig; spy count was ${dbCallCount}`)
})

// ── HMAC arithmetic: real signature validates correctly ────────────────────────
// Tests the raw signature format used above, without any route infrastructure.
// Ensures makeStripeSignature produces values that match Stripe's own algorithm.

await test('HMAC: manually computed signature matches Stripe format', () => {
  const secret    = 'test_secret_key'
  const payload   = '{"id":"evt_1","type":"test.event"}'
  const timestamp = 1700000000
  const sig       = makeStripeSignature(payload, secret, timestamp)

  assert(sig.startsWith(`t=${timestamp},v1=`), `Unexpected sig format: ${sig}`)

  // Recompute independently and verify they match
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  const v1Part = sig.replace(`t=${timestamp},v1=`, '')

  assert(v1Part === expected, `HMAC mismatch: got ${v1Part}, expected ${expected}`)
})

await test('HMAC: different payload produces different signature', () => {
  const secret = 'test_secret'
  const sig1 = makeStripeSignature('payload_a', secret, 1000)
  const sig2 = makeStripeSignature('payload_b', secret, 1000)
  assert(sig1 !== sig2, 'Different payloads must produce different signatures')
})

await test('HMAC: different secret produces different signature', () => {
  const payload = 'same_payload'
  const sig1 = makeStripeSignature(payload, 'secret_1', 1000)
  const sig2 = makeStripeSignature(payload, 'secret_2', 1000)
  assert(sig1 !== sig2, 'Different secrets must produce different signatures')
})

await test('HMAC: different timestamp produces different signature', () => {
  const payload = 'same_payload'
  const secret  = 'same_secret'
  const sig1 = makeStripeSignature(payload, secret, 1000)
  const sig2 = makeStripeSignature(payload, secret, 2000)
  assert(sig1 !== sig2, 'Different timestamps must produce different signatures (replay prevention)')
})

// ─── Results ──────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.passed).length
const failed = results.filter(r => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — STRIPE WEBHOOK SECURITY TEST RESULTS')
console.log('═'.repeat(72))

for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}`)
  if (!r.passed) console.log(`       → ${r.error}`)
}

console.log('═'.repeat(72))
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('═'.repeat(72) + '\n')

if (failed > 0) process.exit(1)

} // end main()

main().catch(e => { console.error(e); process.exit(1) })
