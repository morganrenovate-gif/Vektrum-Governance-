/**
 * tests/post-approval-ux-pass.test.ts
 *
 * Pins the post-approval UX clarity pass:
 *   - "Draft accepted" badge label in release-rules-review-card.tsx
 *   - ReleaseRulesNextStepCard copy + role gating
 *   - DealSetupProgress strip: 7 steps, progress bar, role-visibility
 *   - "Record funding commitment" label in fund-deal-button.tsx (not "Fund This Deal")
 *   - SOV empty-state softened copy when releaseRulesAccepted
 *   - Banned-phrase invariants across all new files
 *
 * Run: npx tsx tests/post-approval-ux-pass.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }
function contains(src: string, needle: string) { return src.includes(needle) }
function absent(src: string, needle: string) { return !src.includes(needle) }

// ─── Source files ─────────────────────────────────────────────────────────────

const REVIEW_CARD   = 'src/components/deal/release-rules-review-card.tsx'
const NEXT_STEP     = 'src/components/deal/release-rules-next-step-card.tsx'
const SETUP_PROG    = 'src/components/deal/deal-setup-progress.tsx'
const FUND_BTN      = 'src/app/(app)/dashboard/deals/[dealId]/fund-deal-button.tsx'
const SOV_SECTION   = 'src/components/deal/sov-section.tsx'
const DEAL_PAGE     = 'src/app/(app)/dashboard/deals/[dealId]/page.tsx'

const reviewCard = read(REVIEW_CARD)
const nextStep   = read(NEXT_STEP)
const setupProg  = read(SETUP_PROG)
const fundBtn    = read(FUND_BTN)
const sovSection = read(SOV_SECTION)
const dealPage   = read(DEAL_PAGE)

// ─── Banned phrases (must not appear in any new component) ────────────────────

const BANNED: string[] = [
  'AI approves',
  'Vektrum moves money',
  'funds are released automatically',
  'guaranteed extraction',
  'guarantees compliance',
]

console.log('\n── "Draft accepted" badge (release-rules-review-card) ──────────────────')

check(
  contains(reviewCard, "Draft accepted"),
  'Review card renders "Draft accepted" label for accepted status',
)
check(
  absent(reviewCard, ">{draft.status}<"),
  'Review card does not render bare status string for accepted state',
)

console.log('\n── ReleaseRulesNextStepCard ─────────────────────────────────────────────')

check(
  contains(nextStep, "releaseRulesAccepted"),
  'NextStepCard accepts releaseRulesAccepted prop',
)
check(
  contains(nextStep, "hasSovItems"),
  'NextStepCard accepts hasSovItems prop',
)
check(
  contains(nextStep, "sovApproved"),
  'NextStepCard accepts sovApproved prop',
)
check(
  contains(nextStep, "viewerRole"),
  'NextStepCard accepts viewerRole prop',
)
check(
  contains(nextStep, "return null"),
  'NextStepCard returns null when conditions not met',
)
check(
  contains(nextStep, "Draft accepted"),
  'NextStepCard variant A header reads "Draft accepted"',
)
check(
  contains(nextStep, "Create SOV from accepted draft"),
  'NextStepCard variant A shows funder CTA to create SOV from draft',
)
check(
  contains(nextStep, "Enter SOV manually"),
  'NextStepCard variant A shows manual entry fallback CTA',
)
check(
  contains(nextStep, "SOV pending approval"),
  'NextStepCard variant B surfaces SOV-pending-approval state',
)
check(
  contains(nextStep, "Review and approve SOV"),
  'NextStepCard variant B shows funder approve-SOV CTA',
)
// Contractor read-only paths
check(
  contains(nextStep, "Waiting for SOV setup"),
  'NextStepCard shows contractor read-only "Waiting for SOV setup" copy',
)
check(
  contains(nextStep, "Your funder is reviewing"),
  'NextStepCard shows contractor read-only waiting copy for variant B',
)
// Safety guardrail language
check(
  contains(nextStep, "Release authorization remains separate"),
  'NextStepCard includes release-authorization separation guardrail',
)
check(
  contains(nextStep, "release gate"),
  'NextStepCard references the deterministic release gate',
)

console.log('\n── DealSetupProgress component ──────────────────────────────────────────')

check(
  contains(setupProg, "contractFullySigned"),
  'DealSetupProgress accepts contractFullySigned prop',
)
check(
  contains(setupProg, "hasReleaseRulesDraft"),
  'DealSetupProgress accepts hasReleaseRulesDraft prop',
)
check(
  contains(setupProg, "releaseRulesAccepted"),
  'DealSetupProgress accepts releaseRulesAccepted prop',
)
check(
  contains(setupProg, "hasSovItems"),
  'DealSetupProgress accepts hasSovItems prop',
)
check(
  contains(setupProg, "sovApproved"),
  'DealSetupProgress accepts sovApproved prop',
)
check(
  contains(setupProg, "allMilestonesLinked"),
  'DealSetupProgress accepts allMilestonesLinked prop',
)
check(
  contains(setupProg, "releaseGateActive"),
  'DealSetupProgress accepts releaseGateActive prop',
)

// 7 steps present
const EXPECTED_STEPS = [
  'Contract signed',
  'Release rules drafted',
  'Release rules approved',
  'SOV created',
  'SOV approved',
  'Milestones linked',
  'Release gate active',
]
for (const step of EXPECTED_STEPS) {
  check(contains(setupProg, step), `DealSetupProgress includes step: "${step}"`)
}

check(
  contains(setupProg, "role=\"progressbar\""),
  'DealSetupProgress has accessible progressbar role',
)
check(
  contains(setupProg, "Deal setup progress"),
  'DealSetupProgress renders "Deal setup progress" heading',
)

console.log('\n── Fund-deal button label ───────────────────────────────────────────────')

check(
  contains(fundBtn, "Record funding commitment"),
  'FundDealButton label is "Record funding commitment"',
)
check(
  absent(fundBtn, "Fund This Deal"),
  'FundDealButton no longer uses "Fund This Deal" label',
)

console.log('\n── SOV section empty-state softening ────────────────────────────────────')

check(
  contains(sovSection, "releaseRulesAccepted"),
  'SovSection accepts releaseRulesAccepted prop',
)
check(
  contains(sovSection, "Draft release rules accepted"),
  'SovSection empty-state uses softened copy when releaseRulesAccepted',
)
check(
  contains(sovSection, "No Schedule of Values has been created yet"),
  'SovSection still shows default empty-state copy when releaseRulesAccepted=false',
)

console.log('\n── Deal page wiring ─────────────────────────────────────────────────────')

check(
  contains(dealPage, "DealSetupProgress"),
  'Deal page imports DealSetupProgress',
)
check(
  contains(dealPage, "ReleaseRulesNextStepCard"),
  'Deal page imports ReleaseRulesNextStepCard',
)
check(
  contains(dealPage, "releaseGateActive"),
  'Deal page computes releaseGateActive',
)
check(
  contains(dealPage, "releaseRulesAccepted={releaseRulesAccepted}"),
  'Deal page passes releaseRulesAccepted to SovSection',
)
check(
  contains(dealPage, "<DealSetupProgress"),
  'Deal page renders <DealSetupProgress>',
)
check(
  contains(dealPage, "<ReleaseRulesNextStepCard"),
  'Deal page renders <ReleaseRulesNextStepCard>',
)

console.log('\n── Banned-phrase guard ──────────────────────────────────────────────────')

const newFiles: [string, string][] = [
  [nextStep,   NEXT_STEP],
  [setupProg,  SETUP_PROG],
]
for (const [src, label] of newFiles) {
  for (const phrase of BANNED) {
    check(absent(src, phrase), `"${phrase}" absent from ${label}`)
  }
}

console.log('\n✅  post-approval-ux-pass: all checks passed\n')
