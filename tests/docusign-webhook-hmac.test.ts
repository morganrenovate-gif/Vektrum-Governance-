/**
 * DocuSign webhook HMAC gate tests
 *
 * Exercises:
 *   1. isHmacBypassAllowed() — all environment combinations
 *   2. verifyWebhookSignature() — correct, wrong secret, tampered body
 *
 * These tests run against the REAL production functions with no inlined logic.
 * The bypass gate is tested via synthetic env objects (no process.env mutation).
 *
 * Run:  npx tsx tests/docusign-webhook-hmac.test.ts
 */

import crypto from 'crypto'
import { verifyWebhookSignature, isHmacBypassAllowed } from '../src/lib/engine/docusign'

// ─── Test Runner (same pattern as release-gate.test.ts) ──────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSignature(body: Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64')
}

// ─── TESTS ────────────────────────────────────────────────────────────────────

async function main() {

// ── isHmacBypassAllowed: bypass requires BOTH conditions ──────────────────────

await test('BYPASS: NODE_ENV=development + DEV_BYPASS=true → allowed', () => {
  const result = isHmacBypassAllowed({
    NODE_ENV:                   'development',
    DOCUSIGN_WEBHOOK_DEV_BYPASS: 'true',
  })
  assert(result === true, 'Expected bypass to be allowed')
})

await test('BYPASS: NODE_ENV=development + DEV_BYPASS=false → NOT allowed', () => {
  const result = isHmacBypassAllowed({
    NODE_ENV:                   'development',
    DOCUSIGN_WEBHOOK_DEV_BYPASS: 'false',
  })
  assert(result === false, 'Expected bypass to be denied when flag is false')
})

await test('BYPASS: NODE_ENV=development + DEV_BYPASS absent → NOT allowed', () => {
  const result = isHmacBypassAllowed({ NODE_ENV: 'development' })
  assert(result === false, 'Expected bypass to be denied when flag is absent')
})

await test('BYPASS: NODE_ENV=production + DEV_BYPASS=true → NOT allowed (deployed env)', () => {
  // Next.js sets NODE_ENV=production for ALL Vercel deployments including preview.
  // Even if someone sets DEV_BYPASS=true in a deployed env file, it must not bypass.
  const result = isHmacBypassAllowed({
    NODE_ENV:                   'production',
    DOCUSIGN_WEBHOOK_DEV_BYPASS: 'true',
  })
  assert(result === false, 'production + DEV_BYPASS=true must still be denied')
})

await test('BYPASS: NODE_ENV=test + DEV_BYPASS=true → NOT allowed (non-dev env)', () => {
  // A CI runner or Jest environment may have NODE_ENV=test — must not bypass.
  const result = isHmacBypassAllowed({
    NODE_ENV:                   'test',
    DOCUSIGN_WEBHOOK_DEV_BYPASS: 'true',
  })
  assert(result === false, 'test env + DEV_BYPASS=true must be denied')
})

await test('BYPASS: NODE_ENV=staging + DEV_BYPASS=true → NOT allowed', () => {
  // NodeJS.ProcessEnv['NODE_ENV'] is typed as 'development' | 'production' | 'test'.
  // Real deployments may set arbitrary values like 'staging' — exercise that path
  // explicitly by widening the literal type. The function under test accepts
  // a plain `{ NODE_ENV?: string; ... }` so this is a safe cast.
  const result = isHmacBypassAllowed({
    NODE_ENV:                   'staging' as string,
    DOCUSIGN_WEBHOOK_DEV_BYPASS: 'true',
  })
  assert(result === false, 'staging env must be denied regardless of flag')
})

await test('BYPASS: both absent → NOT allowed', () => {
  const result = isHmacBypassAllowed({})
  assert(result === false, 'Expected bypass to be denied when both vars are absent')
})

// ── verifyWebhookSignature: correct signature passes ─────────────────────────

await test('HMAC: correct signature verifies', () => {
  const body      = Buffer.from('{"event":"envelope-completed","data":{}}')
  const secret    = 'test-secret-abc'
  const signature = makeSignature(body, secret)
  const valid     = verifyWebhookSignature(body, signature, secret)
  assert(valid === true, 'Expected valid signature to pass verification')
})

await test('HMAC: wrong secret → fails verification', () => {
  const body      = Buffer.from('{"event":"envelope-completed","data":{}}')
  const signature = makeSignature(body, 'real-secret')
  const valid     = verifyWebhookSignature(body, signature, 'wrong-secret')
  assert(valid === false, 'Expected wrong secret to fail verification')
})

await test('HMAC: tampered body → fails verification', () => {
  const body      = Buffer.from('{"event":"envelope-completed","data":{}}')
  const secret    = 'test-secret-abc'
  const signature = makeSignature(body, secret)
  const tampered  = Buffer.from('{"event":"envelope-voided","data":{}}')
  const valid     = verifyWebhookSignature(tampered, signature, secret)
  assert(valid === false, 'Expected tampered body to fail verification')
})

await test('HMAC: truncated signature → fails verification', () => {
  const body      = Buffer.from('hello world')
  const secret    = 'test-secret'
  const signature = makeSignature(body, secret)
  const truncated = signature.slice(0, 10)
  let threw = false
  try {
    verifyWebhookSignature(body, truncated, secret)
  } catch {
    threw = true
  }
  // timingSafeEqual throws when buffers have different lengths —
  // that is the correct safe behavior (reject, don't silently pass).
  assert(threw, 'Expected timingSafeEqual to throw on length mismatch (correct fail-safe behavior)')
})

await test('HMAC: empty body with correct signature passes', () => {
  const body      = Buffer.alloc(0)
  const secret    = 'test-secret'
  const signature = makeSignature(body, secret)
  const valid     = verifyWebhookSignature(body, signature, secret)
  assert(valid === true, 'Expected empty-body signature to verify correctly')
})

await test('HMAC: empty body with wrong signature fails', () => {
  const body      = Buffer.alloc(0)
  const badSig    = makeSignature(Buffer.from('not empty'), 'test-secret')
  const valid     = verifyWebhookSignature(body, badSig, 'test-secret')
  assert(valid === false, 'Expected wrong signature on empty body to fail')
})

await test('HMAC: binary body verifies correctly', () => {
  const body      = Buffer.from([0x00, 0xff, 0x80, 0x7f, 0x01, 0xfe])
  const secret    = 'binary-test-secret'
  const signature = makeSignature(body, secret)
  const valid     = verifyWebhookSignature(body, signature, secret)
  assert(valid === true, 'Expected binary body to verify correctly')
})

// ─── Results ──────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.passed).length
const failed = results.filter(r => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — DOCUSIGN WEBHOOK HMAC GATE TEST RESULTS')
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
