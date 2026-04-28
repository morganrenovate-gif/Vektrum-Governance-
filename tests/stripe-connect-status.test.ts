/**
 * Stripe Connect Status Refresh — Static Safety Tests
 *
 * Source-parse checks — no live Stripe, no live DB, no env vars required.
 * Verifies that the manual Stripe status refresh is correctly implemented,
 * secure, and does not weaken existing webhook signature validation.
 *
 * Checks:
 *  1.  Refresh endpoint file exists at the expected path.
 *  2.  Refresh endpoint requires authentication (calls getAuthUser).
 *  3.  Refresh endpoint requires contractor role (requireRole contractor).
 *  4.  Refresh endpoint reads stripe_account_id from the profile, not request body.
 *  5.  Refresh endpoint calls stripe.accounts.retrieve() (live Stripe lookup).
 *  6.  Refresh endpoint updates only stripe_payouts_enabled (not arbitrary fields).
 *  7.  Refresh endpoint does not expose STRIPE_SECRET_KEY in the response.
 *  8.  Refresh endpoint uses the same readiness formula as the webhook handler
 *      (detailsSubmitted && payoutsEnabled && chargesEnabled).
 *  9.  Refresh endpoint is force-dynamic (no caching of Stripe state).
 * 10.  Refresh endpoint logs a 'stripe_status_refreshed' audit event.
 * 11.  Refresh endpoint returns 422 when no stripe_account_id exists.
 * 12.  Stripe webhook signature validation is intact (no weakening).
 * 13.  Webhook account.updated handler still updates stripe_payouts_enabled.
 * 14.  Refresh UI component file exists.
 * 15.  UI shows a "Refresh status" or "Refresh Stripe status" button.
 * 16.  UI only shows Refresh button for contractor role.
 * 17.  UI does not hardcode or expose STRIPE_SECRET_KEY.
 * 18.  Release gate and payment execution files are untouched.
 * 19.  Test wired into npm test in package.json.
 *
 * Run:  npx tsx tests/stripe-connect-status.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

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
  return fs.readFileSync(path.resolve(ROOT, p), 'utf-8')
}

const REFRESH_ROUTE  = 'src/app/api/contractor/stripe/status/refresh/route.ts'
const WEBHOOK_ROUTE  = 'src/app/api/stripe/webhook/route.ts'
const STRIPE_TAB     = 'src/components/settings/stripe-tab.tsx'
const GATE_FILE      = 'src/lib/engine/release-gate.ts'
const RELEASE_ROUTE  = 'src/app/api/milestones/[milestoneId]/release/route.ts'
const PKG            = 'package.json'

async function main() {

// ─── 1-11. Refresh endpoint ───────────────────────────────────────────────────

await test('1. Refresh endpoint file exists', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, REFRESH_ROUTE)),
    `${REFRESH_ROUTE} does not exist.`,
  )
})

await test('2. Refresh endpoint requires authentication (getAuthUser)', () => {
  const src = read(REFRESH_ROUTE)
  assert(
    src.includes('getAuthUser'),
    `${REFRESH_ROUTE} must call getAuthUser to authenticate the request.`,
  )
})

await test('3. Refresh endpoint requires contractor role', () => {
  const src = read(REFRESH_ROUTE)
  assert(
    src.includes("requireRole") && src.includes("'contractor'"),
    `${REFRESH_ROUTE} must call requireRole with 'contractor' to restrict access.`,
  )
})

await test('4. Refresh endpoint reads stripe_account_id from profile, not request body', () => {
  const src = read(REFRESH_ROUTE)
  // Must use profile.stripe_account_id (server-side, authenticated)
  assert(
    src.includes('profile.stripe_account_id'),
    `${REFRESH_ROUTE} must read stripe_account_id from the authenticated profile, not from the request body.`,
  )
  // Must NOT parse body for stripe_account_id
  const bodyPattern = /body.*stripe_account_id|stripe_account_id.*body|request\.json/
  assert(
    !bodyPattern.test(src),
    `${REFRESH_ROUTE} must not accept stripe_account_id from the request body (prevents account enumeration).`,
  )
})

await test('5. Refresh endpoint calls stripe.accounts.retrieve()', () => {
  const src = read(REFRESH_ROUTE)
  assert(
    src.includes('accounts.retrieve'),
    `${REFRESH_ROUTE} must call stripe.accounts.retrieve() to fetch live account status from Stripe.`,
  )
})

await test('6. Refresh endpoint updates stripe_payouts_enabled on the profile', () => {
  const src = read(REFRESH_ROUTE)
  assert(
    src.includes('stripe_payouts_enabled'),
    `${REFRESH_ROUTE} must update profiles.stripe_payouts_enabled after fetching from Stripe.`,
  )
  // Must write to 'profiles' table
  assert(
    src.includes("from('profiles')") && src.includes('.update('),
    `${REFRESH_ROUTE} must write the updated status to the profiles table.`,
  )
})

await test('7. Refresh endpoint does not expose STRIPE_SECRET_KEY in response', () => {
  const src = read(REFRESH_ROUTE)
  // STRIPE_SECRET_KEY may be referenced to check env (via getStripe) but
  // must never be serialized into the JSON response or logged directly
  const responsePattern = /NextResponse\.json\([^)]*STRIPE_SECRET_KEY/s
  assert(
    !responsePattern.test(src),
    `${REFRESH_ROUTE} must not include STRIPE_SECRET_KEY in the JSON response.`,
  )
  // The raw key value must never appear in template literals or string concat in the response
  assert(
    !src.includes('process.env.STRIPE_SECRET_KEY'),
    `${REFRESH_ROUTE} must use getStripe() helper, not process.env.STRIPE_SECRET_KEY directly.`,
  )
})

await test('8. Refresh endpoint uses detailsSubmitted && payoutsEnabled && chargesEnabled formula', () => {
  const src = read(REFRESH_ROUTE)
  // All three fields must be read from the Stripe account object
  assert(
    src.includes('details_submitted') && src.includes('payouts_enabled') && src.includes('charges_enabled'),
    `${REFRESH_ROUTE} must read details_submitted, payouts_enabled, and charges_enabled from the Stripe account ` +
    `(same formula as the account.updated webhook handler).`,
  )
})

await test('9. Refresh endpoint is force-dynamic (no response caching)', () => {
  const src = read(REFRESH_ROUTE)
  assert(
    src.includes("force-dynamic"),
    `${REFRESH_ROUTE} must export \`export const dynamic = 'force-dynamic'\` to prevent stale cached responses.`,
  )
})

await test("10. Refresh endpoint logs a 'stripe_status_refreshed' audit event", () => {
  const src = read(REFRESH_ROUTE)
  assert(
    src.includes('stripe_status_refreshed'),
    `${REFRESH_ROUTE} must log a 'stripe_status_refreshed' audit event via logAudit.`,
  )
  assert(
    src.includes('logAudit'),
    `${REFRESH_ROUTE} must import and call logAudit.`,
  )
})

await test('11. Refresh endpoint returns 422 when no stripe_account_id on profile', () => {
  const src = read(REFRESH_ROUTE)
  assert(
    src.includes('422'),
    `${REFRESH_ROUTE} must return HTTP 422 when the authenticated profile has no stripe_account_id.`,
  )
})

// ─── 12-13. Webhook safety ───────────────────────────────────────────────────

await test('12. Stripe webhook signature validation is intact', () => {
  const src = read(WEBHOOK_ROUTE)
  // Signature header check must still exist
  assert(
    src.includes('stripe-signature') && src.includes('constructEvent'),
    `${WEBHOOK_ROUTE} must still validate the Stripe-Signature header via constructEvent.`,
  )
  assert(
    src.includes('STRIPE_WEBHOOK_SECRET'),
    `${WEBHOOK_ROUTE} must still require STRIPE_WEBHOOK_SECRET.`,
  )
})

await test('13. Webhook account.updated handler still updates stripe_payouts_enabled', () => {
  const src = read(WEBHOOK_ROUTE)
  assert(
    src.includes('account.updated') && src.includes('stripe_payouts_enabled'),
    `${WEBHOOK_ROUTE} must still handle 'account.updated' and update stripe_payouts_enabled.`,
  )
})

// ─── 14-17. UI ───────────────────────────────────────────────────────────────

await test('14. Stripe settings tab component exists', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, STRIPE_TAB)),
    `${STRIPE_TAB} does not exist.`,
  )
})

await test('15. UI includes a Refresh status button', () => {
  const src = read(STRIPE_TAB)
  assert(
    src.includes('Refresh status') || src.includes('Refresh Stripe status'),
    `${STRIPE_TAB} must include a "Refresh status" or "Refresh Stripe status" button.`,
  )
  assert(
    src.includes('/api/contractor/stripe/status/refresh'),
    `${STRIPE_TAB} must call POST /api/contractor/stripe/status/refresh.`,
  )
})

await test('16. UI Refresh button is scoped to contractor role only', () => {
  const src = read(STRIPE_TAB)
  // The refresh button must be gated on profile.role === 'contractor'
  assert(
    src.includes("role === 'contractor'"),
    `${STRIPE_TAB} must only show the Refresh button when profile.role === 'contractor'.`,
  )
})

await test('17. UI does not expose STRIPE_SECRET_KEY', () => {
  const src = read(STRIPE_TAB)
  assert(
    !src.includes('STRIPE_SECRET_KEY'),
    `${STRIPE_TAB} must not reference STRIPE_SECRET_KEY — client components must never see Stripe secrets.`,
  )
})

// ─── 18. No release gate / execution changes ──────────────────────────────────

await test('18. Release gate and payment execution files are unchanged', () => {
  if (fs.existsSync(path.resolve(ROOT, GATE_FILE))) {
    const gateSrc = read(GATE_FILE)
    assert(
      !gateSrc.includes('stripe/status/refresh'),
      `${GATE_FILE} must not reference the status refresh endpoint — release gate logic must be independent.`,
    )
  }
  if (fs.existsSync(path.resolve(ROOT, RELEASE_ROUTE))) {
    const releaseSrc = read(RELEASE_ROUTE)
    assert(
      !releaseSrc.includes('stripe/status/refresh'),
      `${RELEASE_ROUTE} must not reference the status refresh endpoint — payment execution must be independent.`,
    )
  }
})

// ─── 19. Package.json ────────────────────────────────────────────────────────

await test('19. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('stripe-connect-status.test.ts'),
    `package.json npm test script must include 'stripe-connect-status.test.ts'.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Stripe Connect Status Refresh Tests')
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

} // end main()

main()
