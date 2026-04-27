/**
 * Admin safety tests — static source-pattern checks.
 *
 * These tests do NOT require a running Next.js server. They verify that
 * critical admin and Stripe-secret guards are present in source so that a
 * regression (someone removing an env gate or re-introducing a debug log)
 * is caught by `npm test`.
 *
 * Covered checks:
 *   1. Admin promote route requires admin role.
 *   2. Admin promote route is gated behind ADMIN_PROMOTION_ENABLED env var
 *      and defaults to disabled (gate is `!== 'true'`).
 *   3. Admin promote route blocks self-promotion.
 *   4. Admin promote route requires MFA (AAL2).
 *   5. /api/stripe/connect does not log any STRIPE_SECRET_KEY fragment.
 *   6. /api/stripe/diagnose does not include `key_prefix` in its response.
 *
 * Run:  npx tsx tests/admin-safety.test.ts
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

function src(...segments: string[]): string {
  return path.join(ROOT, 'src', ...segments)
}

function readSource(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required source file does not exist: ${filePath}`)
  }
  return fs.readFileSync(filePath, 'utf-8')
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

const PROMOTE_ROUTE  = src('app', 'api', 'admin', 'promote', 'route.ts')
const CONNECT_ROUTE  = src('app', 'api', 'stripe', 'connect', 'route.ts')
const DIAGNOSE_ROUTE = src('app', 'api', 'stripe', 'diagnose', 'route.ts')

// ── 1. Admin promote — admin role required ───────────────────────────────────

await test('ADMIN: promote route requires admin role', () => {
  const content = readSource(PROMOTE_ROUTE)
  assert(
    /requireRole\s*\(\s*profile\s*,\s*['"]admin['"]\s*\)/.test(content),
    `${PROMOTE_ROUTE} must call requireRole(profile, 'admin') before any privileged action.`,
  )
})

// ── 2. Admin promote — env gate present, defaults disabled ───────────────────

await test('ADMIN: promote route checks ADMIN_PROMOTION_ENABLED env gate', () => {
  const content = readSource(PROMOTE_ROUTE)
  assert(
    content.includes('ADMIN_PROMOTION_ENABLED'),
    `${PROMOTE_ROUTE} must reference ADMIN_PROMOTION_ENABLED to allow the route to be disabled.`,
  )
})

await test('ADMIN: ADMIN_PROMOTION_ENABLED gate defaults disabled (uses !== "true")', () => {
  const content = readSource(PROMOTE_ROUTE)
  // Pattern: process.env.ADMIN_PROMOTION_ENABLED !== 'true'
  // This guarantees that any value other than the string "true" — including
  // unset, empty string, "false", "True", "1" — denies the request.
  assert(
    /ADMIN_PROMOTION_ENABLED\s*!==\s*['"]true['"]/.test(content),
    `${PROMOTE_ROUTE} must gate with ADMIN_PROMOTION_ENABLED !== 'true' so the route ` +
    `is disabled by default. A loose check (truthy, ===, etc.) risks accidental enablement.`,
  )
})

// ── 3. Admin promote — self-promotion blocked ────────────────────────────────

await test('ADMIN: promote route blocks self-promotion', () => {
  const content = readSource(PROMOTE_ROUTE)
  // Pattern: body.userId === user.id  → block
  assert(
    /body\.userId\s*===\s*user\.id/.test(content),
    `${PROMOTE_ROUTE} must compare body.userId to user.id and reject self-promotion. ` +
    `Without this guard, a compromised admin can grant themselves persistence.`,
  )
})

// ── 4. Admin promote — MFA required ──────────────────────────────────────────

await test('ADMIN: promote route requires MFA (AAL2)', () => {
  const content = readSource(PROMOTE_ROUTE)
  assert(
    content.includes('requireMFA'),
    `${PROMOTE_ROUTE} must call requireMFA(...) so admin promotion cannot be performed ` +
    `from a session that has not completed TOTP verification.`,
  )
})

// ── 5. Stripe connect — no secret key fragment is logged ─────────────────────

await test('STRIPE: /api/stripe/connect does not log STRIPE_SECRET_KEY fragment', () => {
  const content = readSource(CONNECT_ROUTE)
  // Catches: console.log(... STRIPE_SECRET_KEY ...) and any slice/substring
  // call on the secret key inside a console.* call.
  const consoleLeak =
    /console\.[a-z]+\([^)]*STRIPE_SECRET_KEY[^)]*\)/i.test(content) ||
    /console\.[a-z]+\([^)]*STRIPE_SECRET_KEY\?\.\s*slice/i.test(content)
  assert(
    !consoleLeak,
    `${CONNECT_ROUTE} must not pass STRIPE_SECRET_KEY (or any slice/prefix of it) to a ` +
    `console.* call. Server logs are a sensitive surface; debug artifacts must be removed.`,
  )
})

// ── 6. Stripe diagnose — no `key_prefix` field in response ───────────────────

await test('STRIPE: /api/stripe/diagnose does not expose key_prefix in response', () => {
  const content = readSource(DIAGNOSE_ROUTE)
  // The route returns JSON twice (early-return on getStripe() failure, and the
  // success path). Neither return body should mention key_prefix.
  assert(
    !content.includes('key_prefix'),
    `${DIAGNOSE_ROUTE} must not include key_prefix in any NextResponse.json(...) body. ` +
    `Use boolean diagnostics (key_set, key_looks_like_live) instead — never any ` +
    `fragment of the secret itself.`,
  )
})

await test('STRIPE: /api/stripe/diagnose does not slice STRIPE_SECRET_KEY', () => {
  const content = readSource(DIAGNOSE_ROUTE)
  assert(
    !/STRIPE_SECRET_KEY\?\.\s*slice/.test(content),
    `${DIAGNOSE_ROUTE} must not slice STRIPE_SECRET_KEY into a string variable — ` +
    `even an unused slice risks accidental inclusion in a future response.`,
  )
})

// ── Report ───────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — ADMIN SAFETY TEST RESULTS')
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
