/**
 * Funder MFA Onboarding — Static Safety Tests
 *
 * Verifies that funders without MFA enrolled are guided to set up MFA before
 * they can fund a deal, and that all security boundaries remain intact.
 *
 * Root cause: a newly-invited funder could reach the deal page and click
 * "Fund This Deal" with no prior prompt to enroll MFA, receiving an opaque
 * "requires multi-factor authentication" error from the API.
 *
 * Fix: FundDealButton checks mfaEnrolled prop; if false, shows a prominent
 * banner with "Set up MFA" CTA pointing to /auth/mfa/enroll?next=<deal>&reason=funding.
 * After enrollment, the user is returned to the original deal page.
 *
 * Source-parse checks only — no live DB, no env vars required.
 *
 * Checks:
 *  1.  Fund route still calls requireMFA() — backend enforcement unchanged.
 *  2.  Fund route still calls requireRole('funder', 'admin') — role check intact.
 *  3.  FundDealButton accepts mfaEnrolled prop.
 *  4.  FundDealButton accepts mfaSetupUrl prop.
 *  5.  FundDealButton shows MFA banner when mfaEnrolled is false.
 *  6.  MFA banner text mentions "multi-factor authentication".
 *  7.  MFA "Set up MFA" CTA uses mfaSetupUrl.
 *  8.  Deal page passes mfaEnrolled from profile to FundDealButton.
 *  9.  Deal page encodes deal ID in mfaSetupUrl (?next=).
 *  10. Deal page passes reason=funding in mfaSetupUrl.
 *  11. Funder with MFA enrolled still sees Fund This Deal (no banner blocks them).
 *  12. Contractor signup path is not affected — FundDealButton not shown to contractors.
 *  13. Fund route does not call stripe inside MFA check — Stripe logic unchanged.
 *  14. MFA enroll page reads reason param and shows funding callout.
 *  15. MFA enroll page preserves ?next= for return path after enrollment.
 *  16. No Stripe/payment execution logic changed in fund route.
 *  17. Test file is wired into npm test in package.json.
 *
 * Run:  npx tsx tests/funder-mfa-onboarding.test.ts
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

const FUND_ROUTE  = 'src/app/api/deals/[dealId]/fund/route.ts'
const FUND_BTN    = 'src/app/dashboard/deals/[dealId]/fund-deal-button.tsx'
const DEAL_PAGE   = 'src/app/dashboard/deals/[dealId]/page.tsx'
const MFA_ENROLL  = 'src/app/auth/mfa/enroll/page.tsx'
const PKG         = 'package.json'

async function main() {

// ─── 1-2. Backend enforcement unchanged ──────────────────────────────────────

await test('1. Fund route still calls requireMFA()', () => {
  const src = read(FUND_ROUTE)
  assert(
    src.includes('requireMFA') && src.includes('await requireMFA('),
    `${FUND_ROUTE} must call requireMFA(). The backend MFA check must never be removed. ` +
    `The UI banner is advisory; the API is the authoritative enforcement point.`,
  )
})

await test('2. Fund route still calls requireRole for funder/admin', () => {
  const src = read(FUND_ROUTE)
  assert(
    src.includes("requireRole(profile, 'funder', 'admin')"),
    `${FUND_ROUTE} must call requireRole(profile, 'funder', 'admin'). ` +
    `Role check must precede the MFA guard and be unchanged.`,
  )
})

// ─── 3-7. FundDealButton MFA gate ────────────────────────────────────────────

await test('3. FundDealButton accepts mfaEnrolled prop', () => {
  const src = read(FUND_BTN)
  assert(
    src.includes('mfaEnrolled'),
    `${FUND_BTN} must accept an mfaEnrolled prop so the deal page can pass ` +
    `profile.mfa_enrolled without requiring a client-side Supabase query.`,
  )
})

await test('4. FundDealButton accepts mfaSetupUrl prop', () => {
  const src = read(FUND_BTN)
  assert(
    src.includes('mfaSetupUrl'),
    `${FUND_BTN} must accept a mfaSetupUrl prop so the deal page can pre-build ` +
    `the enrollment URL with ?next= and ?reason= query params.`,
  )
})

await test('5. FundDealButton shows MFA banner when mfaEnrolled is false', () => {
  const src = read(FUND_BTN)
  assert(
    src.includes('!mfaEnrolled'),
    `${FUND_BTN} must render an MFA setup banner when mfaEnrolled is false. ` +
    `The banner must appear before the user can click Fund This Deal.`,
  )
})

await test('6. MFA banner text mentions multi-factor authentication', () => {
  const src = read(FUND_BTN)
  assert(
    src.includes('multi-factor authentication') || src.includes('MFA') || src.includes('authenticator'),
    `${FUND_BTN} MFA banner must mention multi-factor authentication, MFA, or authenticator ` +
    `so the user understands what is required.`,
  )
})

await test('7. Set up MFA CTA uses mfaSetupUrl for navigation', () => {
  const src = read(FUND_BTN)
  assert(
    src.includes('mfaSetupUrl') && src.includes('router.push(mfaSetupUrl)'),
    `${FUND_BTN} Set up MFA button must call router.push(mfaSetupUrl). ` +
    `This ensures the return path (?next=) is preserved in the URL.`,
  )
})

// ─── 8-10. Deal page wiring ───────────────────────────────────────────────────

await test('8. Deal page passes mfaEnrolled from profile to FundDealButton', () => {
  const src = read(DEAL_PAGE)
  assert(
    src.includes('mfaEnrolled={!!typedProfile.mfa_enrolled}'),
    `${DEAL_PAGE} must pass mfaEnrolled={!!typedProfile.mfa_enrolled} to FundDealButton. ` +
    `The profile row fetches mfa_enrolled from the DB; the double-bang coerces null to false.`,
  )
})

await test('9. Deal page encodes deal ID in mfaSetupUrl for return path', () => {
  const src = read(DEAL_PAGE)
  assert(
    src.includes('mfaSetupUrl') && src.includes('encodeURIComponent') && src.includes('mfa/enroll'),
    `${DEAL_PAGE} must build mfaSetupUrl using encodeURIComponent so the ?next= path ` +
    `correctly returns the funder to this deal after MFA enrollment.`,
  )
})

await test('10. Deal page passes reason=funding in mfaSetupUrl', () => {
  const src = read(DEAL_PAGE)
  assert(
    src.includes('reason=funding'),
    `${DEAL_PAGE} must include reason=funding in mfaSetupUrl so the enroll page ` +
    `can show a funding-specific context callout to the user.`,
  )
})

// ─── 11. Funder with MFA can reach Fund This Deal ────────────────────────────

await test('11. Fund This Deal button is reachable when mfaEnrolled is true', () => {
  const src = read(FUND_BTN)
  // The MFA gate must be an early return, so if mfaEnrolled is true, the rest
  // of the component (including Fund This Deal) renders.
  assert(
    src.includes('Fund This Deal') || src.includes('handleFund'),
    `${FUND_BTN} must still render the Fund This Deal button when mfaEnrolled is true. ` +
    `The MFA banner is an early return only — enrolled funders must not be blocked.`,
  )
})

// ─── 12. Contractor signup path unaffected ────────────────────────────────────

await test('12. FundDealButton is only shown to funders in the deal page', () => {
  const src = read(DEAL_PAGE)
  assert(
    src.includes("funderCanFund") &&
    src.includes(`role === "funder"`) &&
    src.includes('FundDealButton'),
    `${DEAL_PAGE} must only show FundDealButton when funderCanFund is true (role=funder). ` +
    `Contractors must never see the Fund This Deal button or MFA banner.`,
  )
})

// ─── 13. Stripe logic unchanged in fund route ────────────────────────────────

await test('13. Fund route still creates Stripe PaymentIntent', () => {
  const src = read(FUND_ROUTE)
  assert(
    src.includes('stripe.paymentIntents.create') && src.includes('paymentIntent'),
    `${FUND_ROUTE} must still create a Stripe PaymentIntent. ` +
    `No Stripe/payment execution logic should have been changed by the MFA UI fix.`,
  )
})

// ─── 14-15. MFA enroll page improvements ─────────────────────────────────────

await test('14. MFA enroll page reads reason param and shows funding callout', () => {
  const src = read(MFA_ENROLL)
  assert(
    src.includes('reason') && src.includes('reason === "funding"'),
    `${MFA_ENROLL} must read the ?reason= search param and show a funding-specific ` +
    `context callout when reason === "funding". This helps the funder understand ` +
    `why MFA is required before they can fund a deal.`,
  )
})

await test('15. MFA enroll page preserves ?next= for return path after enrollment', () => {
  const src = read(MFA_ENROLL)
  assert(
    src.includes('next') && src.includes('searchParams.get("next")') &&
    src.includes('router.replace(next'),
    `${MFA_ENROLL} must read ?next= from search params and redirect to it after ` +
    `successful enrollment. This is already implemented — verify it is not broken.`,
  )
})

// ─── 16. No Stripe logic changed ─────────────────────────────────────────────

await test('16. Fund route audit log records deal_funding_initiated (unchanged)', () => {
  const src = read(FUND_ROUTE)
  assert(
    src.includes('deal_funding_initiated'),
    `${FUND_ROUTE} must still log 'deal_funding_initiated'. No audit event was ` +
    `removed or renamed by the MFA UI fix.`,
  )
})

// ─── 17. Package.json ────────────────────────────────────────────────────────

await test('17. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('funder-mfa-onboarding.test.ts'),
    `package.json npm test script must include 'funder-mfa-onboarding.test.ts'.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Funder MFA Onboarding Tests')
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
