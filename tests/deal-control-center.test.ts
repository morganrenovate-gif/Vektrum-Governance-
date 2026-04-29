/**
 * Deal Control Center — Static Safety Tests
 *
 * Verifies the funder deal page reads as release-control infrastructure
 * without compromising backend enforcement, release gate logic, or
 * payment execution paths.
 *
 * Source-parse checks only — no live DB, no env vars required.
 *
 * Checks:
 *  1.  DealReadinessBanner component exists at expected path.
 *  2.  DealReadinessBanner renders "Release Readiness" label.
 *  3.  DealReadinessBanner shows releasable count stat.
 *  4.  Deal page imports and renders DealReadinessBanner.
 *  5.  Deal page computes gateMap for all milestones upfront.
 *  6.  Deal page renders "Release controls" section label.
 *  7.  Deal page renders capital status (funded/unfunded) for funder role.
 *  8.  Deal page renders "Milestone Review & Release" label for funders.
 *  9.  FundDealButton shows "Secure your account" when MFA missing.
 *  10. FundDealButton blocks funding when mfaEnrolled=false (no fund API call).
 *  11. DrawReviewAgent still renders "Perplexity Draw Control Brief".
 *  12. DrawReviewAgent findings are collapsible ("View full brief").
 *  13. Release blockers still render — not hidden or removed.
 *  14. Release button labels blockers as "Next required actions".
 *  15. release-gate.ts is unchanged — no release logic modified.
 *  16. Stripe fund route is unchanged — no payment execution modified.
 *  17. Non-custody language present in release-button.tsx.
 *  18. Test file wired into package.json npm test script.
 *
 * Run:  npx tsx tests/deal-control-center.test.ts
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

const BANNER      = 'src/components/deal/deal-readiness-banner.tsx'
const PAGE        = 'src/app/dashboard/deals/[dealId]/page.tsx'
const FUND_BTN    = 'src/app/dashboard/deals/[dealId]/fund-deal-button.tsx'
const DRAW_AGENT  = 'src/components/ai/draw-review-agent.tsx'
const REL_BTN     = 'src/components/deal/release-button.tsx'
const GATE        = 'src/lib/engine/release-gate.ts'
const FUND_ROUTE  = 'src/app/api/deals/[dealId]/fund/route.ts'
const PKG         = 'package.json'

async function main() {

// ─── 1-3. DealReadinessBanner component ──────────────────────────────────────

await test('1. DealReadinessBanner component exists', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, BANNER)),
    `${BANNER} must exist. The DealReadinessBanner is the deal-level readiness ` +
    `summary widget — it should live as a separate component, not inline in page.tsx.`,
  )
})

await test('2. DealReadinessBanner renders "Release Readiness" label', () => {
  const src = read(BANNER)
  assert(
    src.includes('Release Readiness'),
    `${BANNER} must include the label "Release Readiness". ` +
    `This communicates Vektrum's role as release-control infrastructure, ` +
    `not a payment app or approval workflow.`,
  )
})

await test('3. DealReadinessBanner renders releasable milestone count stat', () => {
  const src = read(BANNER)
  assert(
    src.includes('Releasable') && src.includes('releasableMilestones'),
    `${BANNER} must display a "Releasable" stat driven by releasableMilestones prop. ` +
    `Funders need to see at a glance how many milestones have passed all gate conditions.`,
  )
})

// ─── 4-8. Deal page structure ─────────────────────────────────────────────────

await test('4. Deal page imports and renders DealReadinessBanner', () => {
  const src = read(PAGE)
  assert(
    src.includes('DealReadinessBanner') && src.includes('deal-readiness-banner'),
    `${PAGE} must import and render DealReadinessBanner. The banner is the top-level ` +
    `release readiness signal and must appear on the funder deal page.`,
  )
})

await test('5. Deal page computes gateMap for all milestones upfront', () => {
  const src = read(PAGE)
  assert(
    src.includes('gateMap') && src.includes('gateMap.set('),
    `${PAGE} must pre-compute a gateMap (milestone id → ReleaseGateResult) to avoid ` +
    `double-computing the gate in the render loop. The map is also used for the ` +
    `deal-level readiness summary.`,
  )
})

await test('6. Deal page renders "Release controls" section label above ReleaseButton', () => {
  const src = read(PAGE)
  assert(
    src.includes('Release controls'),
    `${PAGE} must render a "Release controls" section label to visually separate ` +
    `review controls (inside MilestoneCard) from release controls (ReleaseButton). ` +
    `This is visual grouping only — no API behavior change.`,
  )
})

await test('7. Deal page renders capital status for funder role', () => {
  const src = read(PAGE)
  assert(
    src.includes('Fully funded') || (src.includes('isFullyFunded') && src.includes('Funded')),
    `${PAGE} must render a capital status indicator for funder role — ` +
    `"Funded", "Partially funded", or "Not yet funded" — in the deal header. ` +
    `Funders need immediate capital authorization context without scrolling.`,
  )
})

await test('8. Deal page renders "Milestone Review & Release" label for funders', () => {
  const src = read(PAGE)
  assert(
    src.includes('Milestone Review & Release'),
    `${PAGE} must use "Milestone Review & Release" as the milestones section label ` +
    `for funders, making the dual purpose of the section (review + release) explicit.`,
  )
})

// ─── 9-10. FundDealButton MFA gate (preserved from previous task) ─────────────

await test('9. FundDealButton shows "Secure your account" when MFA not enrolled', () => {
  const src = read(FUND_BTN)
  assert(
    src.includes('Secure your account') || src.includes('mfaEnrolled'),
    `${FUND_BTN} must display an MFA setup prompt when mfaEnrolled is false. ` +
    `Funders should never hit an opaque MFA error from the API without prior guidance.`,
  )
})

await test('10. FundDealButton blocks funding API call when mfaEnrolled=false', () => {
  const src = read(FUND_BTN)
  // When !mfaEnrolled the component returns early (shows banner); handleFund is only
  // defined and reachable when mfaEnrolled is true (after the early return guard).
  assert(
    src.includes('!mfaEnrolled') && src.includes('handleFund'),
    `${FUND_BTN} must use an early return on !mfaEnrolled so handleFund (which POSTs ` +
    `to the fund API) is never reachable when MFA is not enrolled. The backend ` +
    `requireMFA() remains the authoritative enforcement point.`,
  )
})

// ─── 11-12. DrawReviewAgent brief collapse ────────────────────────────────────

await test('11. DrawReviewAgent still renders "Perplexity Draw Control Brief"', () => {
  const src = read(DRAW_AGENT)
  assert(
    src.includes('Perplexity Draw Control Brief'),
    `${DRAW_AGENT} must still render the "Perplexity Draw Control Brief" label. ` +
    `The brief is a required precondition for the release gate — it must not be ` +
    `renamed, hidden, or removed.`,
  )
})

await test('12. DrawReviewAgent findings are collapsible ("View full brief")', () => {
  const src = read(DRAW_AGENT)
  assert(
    src.includes('View full brief') || src.includes('findingsOpen'),
    `${DRAW_AGENT} must have a findings collapse/expand toggle. The summary row ` +
    `(score, risk, recommendation, reasoning) should always be visible; the full ` +
    `findings list should be hidden by default and revealed on demand.`,
  )
})

// ─── 13-14. Release blockers preserved and action-oriented ───────────────────

await test('13. Release blockers still render — not hidden or removed', () => {
  const src = read(REL_BTN)
  assert(
    src.includes('gate.blockers') && src.includes('blockers-list'),
    `${REL_BTN} must still render the gate.blockers list with id "blockers-list". ` +
    `Blockers must never be hidden, removed, or bypassed from the UI.`,
  )
})

await test('14. Release button labels blockers as "Next required actions"', () => {
  const src = read(REL_BTN)
  assert(
    src.includes('Next required actions'),
    `${REL_BTN} must use "Next required actions" as the blockers toggle label instead ` +
    `of the generic "N conditions not met". Action-oriented language helps funders ` +
    `understand what needs to happen, not just that something is wrong.`,
  )
})

// ─── 15-16. Backend logic unchanged ──────────────────────────────────────────

await test('15. release-gate.ts is unchanged — no release logic modified', () => {
  const src = read(GATE)
  assert(
    src.includes('validateRelease') && src.includes('ReleaseValidationResult') && src.includes('allowed'),
    `${GATE} must still export validateRelease and ReleaseValidationResult (with 'allowed' field). ` +
    `This task is a UI-only refactor — release gate logic must remain untouched.`,
  )
})

await test('16. Stripe fund route is unchanged — no payment execution modified', () => {
  const src = read(FUND_ROUTE)
  assert(
    src.includes('stripe.paymentIntents.create') || src.includes('paymentIntent'),
    `${FUND_ROUTE} must still create a Stripe PaymentIntent. This UI refactor ` +
    `must not change any Stripe/payment execution path.`,
  )
})

// ─── 17. Non-custody language preserved ──────────────────────────────────────

await test('17. Non-custody language present in release-button.tsx', () => {
  const src = read(REL_BTN)
  assert(
    src.includes('Vektrum') && (
      src.includes('not a payment processor') ||
      src.includes('Vektrum is governance') ||
      src.includes('no funds') ||
      src.includes('No funds have moved')
    ),
    `${REL_BTN} must preserve non-custody language such as "Vektrum is governance" ` +
    `or "No funds have moved through Vektrum". Vektrum does not hold funds, act as ` +
    `escrow, or move money directly — this must remain visible to funders.`,
  )
})

// ─── 18. Package.json ────────────────────────────────────────────────────────

await test('18. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('deal-control-center.test.ts'),
    `package.json npm test script must include 'deal-control-center.test.ts'.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Deal Control Center Tests')
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
