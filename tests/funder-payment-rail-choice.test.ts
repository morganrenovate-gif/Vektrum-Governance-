/**
 * tests/funder-payment-rail-choice.test.ts
 *
 * Pins the funder onboarding payment-rail choice pass:
 *   - onboarding wizard shows three options (Stripe / external / set up later)
 *   - "Before you can fund deals" copy is gone
 *   - "Stripe holds capital" copy is gone
 *   - profiles.disbursement_rail migration exists with correct CHECK
 *   - Profile type includes disbursement_rail
 *   - dashboard funder redirect is gated on disbursement_rail (not stripe_account_id)
 *   - FundDealButton is rail-aware (4 branches: MFA, choose rail, external, stripe gate)
 *   - release routes have rail precondition
 *   - settings shell exposes the new Disbursement tab to funders only
 *   - API route validates rail values + role
 *   - banned-phrase invariants
 *
 * Run: npx tsx tests/funder-payment-rail-choice.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function exists(rel: string): boolean {
  try { fs.accessSync(path.resolve(ROOT, rel)); return true } catch { return false }
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }
function contains(src: string, needle: string) { return src.includes(needle) }
function absent(src: string, needle: string) { return !src.includes(needle) }
// JSX wraps long strings across lines with newlines+spaces; this normaliser
// matches the underlying rendered text rather than the source layout.
function flat(src: string) { return src.replace(/\s+/g, ' ') }
function containsFlat(src: string, needle: string) { return flat(src).includes(needle) }
function absentFlat(src: string, needle: string) { return !flat(src).includes(needle) }

// ─── Source files ─────────────────────────────────────────────────────────────

const MIGRATION       = 'supabase/migrations/20260503000000_funder_disbursement_rail.sql'
const TYPES           = 'src/lib/types.ts'
const ONBOARDING_PAGE = 'src/app/(app)/dashboard/funder/onboarding/page.tsx'
const WIZARD          = 'src/components/onboarding/funder-rail-choice-wizard.tsx'
const RAIL_API        = 'src/app/api/funder/disbursement-rail/route.ts'
const SETTINGS_SHELL  = 'src/components/settings/settings-shell.tsx'
const RAIL_TAB        = 'src/components/settings/disbursement-rail-tab.tsx'
const DASHBOARD_PAGE  = 'src/app/(app)/dashboard/page.tsx'
const FUND_BTN        = 'src/app/(app)/dashboard/deals/[dealId]/fund-deal-button.tsx'
const DEAL_PAGE       = 'src/app/(app)/dashboard/deals/[dealId]/page.tsx'
const RELEASE_ROUTE   = 'src/app/api/milestones/[milestoneId]/release/route.ts'
const RETAINAGE_ROUTE = 'src/app/api/deals/[dealId]/retainage/release/route.ts'
const STRIPE_WIZARD   = 'src/components/onboarding/stripe-onboarding-wizard.tsx'

// All new files must exist
for (const p of [MIGRATION, WIZARD, RAIL_API, RAIL_TAB]) {
  check(exists(p), `${p} exists`)
}

const migration       = read(MIGRATION)
const types           = read(TYPES)
const onboardingPage  = read(ONBOARDING_PAGE)
const wizard          = read(WIZARD)
const railApi         = read(RAIL_API)
const settingsShell   = read(SETTINGS_SHELL)
const railTab         = read(RAIL_TAB)
const dashboardPage   = read(DASHBOARD_PAGE)
const fundBtn         = read(FUND_BTN)
const dealPage        = read(DEAL_PAGE)
const releaseRoute    = read(RELEASE_ROUTE)
const retainageRoute  = read(RETAINAGE_ROUTE)

console.log('\n── Migration & schema ───────────────────────────────────────────────────')

check(
  contains(migration, 'ADD COLUMN IF NOT EXISTS disbursement_rail'),
  'Migration adds profiles.disbursement_rail column',
)
check(
  contains(migration, "'stripe'") &&
  contains(migration, "'external_rail'") &&
  contains(migration, "'not_configured'"),
  'Migration CHECK constraint enumerates the three valid rails',
)
check(
  contains(migration, 'CREATE INDEX'),
  'Migration adds an index on disbursement_rail',
)

console.log('\n── Profile type ─────────────────────────────────────────────────────────')

check(
  /disbursement_rail:\s*'stripe'\s*\|\s*'external_rail'\s*\|\s*'not_configured'\s*\|\s*null/.test(types),
  'Profile.disbursement_rail union type matches the migration',
)

console.log('\n── Funder onboarding page ───────────────────────────────────────────────')

check(
  contains(onboardingPage, 'FunderRailChoiceWizard'),
  'Funder onboarding page renders the new rail-choice wizard',
)
check(
  absent(onboardingPage, 'StripeOnboardingWizard'),
  'Funder onboarding page no longer mounts the Stripe-only wizard',
)
check(
  contains(onboardingPage, 'profile.disbursement_rail'),
  'Funder onboarding page reads disbursement_rail from the profile',
)
// One-shot: don't loop funders back into onboarding once a rail is chosen
check(
  /if\s*\(profile\.disbursement_rail\)\s*redirect\('\/dashboard'\)/.test(onboardingPage),
  'Funder onboarding page redirects to dashboard when a rail is already set',
)

console.log('\n── Rail-choice wizard copy ──────────────────────────────────────────────')

// Replacement copy
check(
  containsFlat(wizard, 'Choose how disbursement execution will be handled for your deals'),
  'Wizard uses replacement copy for first paragraph',
)
check(
  containsFlat(wizard, 'Your selected rail executes disbursement after required release conditions and authorization are complete'),
  'Wizard uses replacement copy for the rail-execution sentence',
)
check(
  contains(wizard, 'Choose your disbursement rail'),
  'Wizard heading reads "Choose your disbursement rail"',
)

// Three options with required copy
const REQUIRED_OPTIONS: Array<[string, string, string]> = [
  ['Stripe Connect',
   'Connect Stripe if you want Stripe to handle platform payment execution for eligible deals.',
   'Connect Stripe'],
  ['External or partner rail',
   'Use this if disbursements will be handled by a lender, title company, escrow partner, fund control provider, loan servicer, or another approved payment process.',
   'Use external rail'],
  ['Set up later',
   'Continue into Vektrum and configure the payment rail before any release can be executed.',
   'Set up later'],
]
for (const [title, body, cta] of REQUIRED_OPTIONS) {
  check(contains(wizard, title),       `Wizard option title present: "${title}"`)
  check(containsFlat(wizard, body),    `Wizard option body present:  "${body.slice(0, 50)}…"`)
  check(contains(wizard, cta),         `Wizard option CTA present:   "${cta}"`)
}

// data-rail-option attributes for the three options (testable hooks)
for (const id of ['stripe', 'external_rail', 'not_configured']) {
  check(
    contains(wizard, `data-rail-option={id}`) || contains(wizard, `data-rail-option="${id}"`),
    `Wizard exposes data-rail-option for ${id}`,
  )
}

// Old copy must not appear anywhere
const OLD_COPY = [
  'Before you can fund deals',
  'Stripe holds capital',
]
const NEW_FILES = [
  [wizard,         WIZARD],
  [onboardingPage, ONBOARDING_PAGE],
  [railTab,        RAIL_TAB],
] as const
for (const [src, label] of NEW_FILES) {
  for (const phrase of OLD_COPY) {
    check(absent(src, phrase), `Old copy "${phrase}" absent from ${label}`)
  }
}
// Stripe wizard (still used by contractors) must also drop "Before you can fund deals"
const stripeWizard = read(STRIPE_WIZARD)
check(
  absent(stripeWizard, 'Before you can fund deals'),
  'Stripe wizard no longer hard-codes the funder-blocking copy',
)
check(
  absent(stripeWizard, 'Stripe holds capital'),
  'Stripe wizard no longer claims Stripe holds capital',
)

console.log('\n── /api/funder/disbursement-rail ────────────────────────────────────────')

check(
  /export\s+async\s+function\s+POST/.test(railApi),
  'Rail API exposes POST',
)
check(
  contains(railApi, "ALLOWED_RAILS") &&
  contains(railApi, "'stripe'") &&
  contains(railApi, "'external_rail'") &&
  contains(railApi, "'not_configured'"),
  'Rail API validates against the three allowed values',
)
check(
  contains(railApi, "Only funders can set a disbursement rail"),
  'Rail API rejects non-funder roles with a 403',
)
check(
  contains(railApi, 'logAudit'),
  'Rail API audit-logs disbursement_rail_selected',
)
check(
  contains(railApi, 'createSupabaseAdminClient'),
  'Rail API uses the admin client for the profile update',
)

console.log('\n── Dashboard funder gate ────────────────────────────────────────────────')

// Funders should NOT be redirected to onboarding solely because they lack
// a Stripe account. They are only redirected when they have not yet chosen
// any disbursement rail.
check(
  /profile\.role === 'funder' && !profile\.disbursement_rail/.test(dashboardPage),
  'Dashboard funder onboarding redirect is gated on disbursement_rail',
)
check(
  absent(dashboardPage, "if (profile && !profile.stripe_account_id) {"),
  'Dashboard no longer combines contractor+funder Stripe gate into one branch',
)
check(
  contains(dashboardPage, 'Disbursement rail: External / partner rail'),
  'Dashboard surfaces external-rail status banner',
)
check(
  containsFlat(dashboardPage, 'Vektrum records authorization readiness. Disbursement is executed through the selected external rail'),
  'Dashboard external-rail banner uses the safe execution copy',
)
check(
  contains(dashboardPage, 'Payment rail not configured'),
  'Dashboard surfaces non-blocking banner for unconfigured funders',
)
check(
  containsFlat(dashboardPage, 'You can set up Stripe or select an external rail before release execution'),
  'Dashboard non-blocking banner uses the spec copy',
)
check(
  contains(dashboardPage, 'Choose rail'),
  'Dashboard non-blocking banner offers a "Choose rail" CTA',
)

console.log('\n── FundDealButton rail awareness ────────────────────────────────────────')

check(
  contains(fundBtn, 'disbursementRail'),
  'FundDealButton accepts disbursementRail prop',
)
check(
  contains(fundBtn, "'stripe' | 'external_rail' | 'not_configured' | null"),
  'FundDealButton typing matches the migration',
)
check(
  contains(fundBtn, 'External rail selected'),
  'FundDealButton renders the external-rail variant',
)
check(
  containsFlat(fundBtn, 'Choose your disbursement rail before recording funding commitments'),
  'FundDealButton renders the choose-rail prompt for unconfigured funders',
)
check(
  containsFlat(fundBtn, 'Connect your Stripe account before funding via Stripe Connect'),
  'FundDealButton renders the Stripe-not-yet-connected gate',
)
check(
  contains(fundBtn, 'Record funding commitment'),
  'FundDealButton primary CTA reads "Record funding commitment"',
)
check(
  !/>\s*Fund This Deal/.test(fundBtn) && !/Fund This Deal\s*—/.test(fundBtn),
  'FundDealButton no longer says "Fund This Deal" as a user-facing label',
)

// Deal page wires the prop through
check(
  contains(dealPage, 'disbursementRail={typedProfile.disbursement_rail ?? null}'),
  'Deal page passes disbursement_rail to FundDealButton',
)

console.log('\n── Release routes — rail precondition ───────────────────────────────────')

check(
  contains(releaseRoute, 'rail_not_configured'),
  'Milestone release route adds rail_not_configured precondition',
)
check(
  contains(releaseRoute, 'Disbursement rail not configured'),
  'Milestone release route returns the rail-required error message',
)
check(
  contains(retainageRoute, 'Disbursement rail not configured'),
  'Retainage release route adds the same precondition',
)

console.log('\n── Settings shell — funder Disbursement tab ─────────────────────────────')

check(
  contains(settingsShell, "DisbursementRailTab"),
  'Settings shell mounts DisbursementRailTab',
)
check(
  /id:\s*'disbursement'/.test(settingsShell),
  'Settings shell registers the disbursement tab id',
)
check(
  /visibleForRoles:\s*\['funder'\]/.test(settingsShell),
  'Disbursement tab is visible only for funders',
)
check(
  /visibleForRoles:\s*\['contractor'\]/.test(settingsShell),
  'Stripe Connect tab is visible only for contractors',
)
// Disbursement-rail tab content
check(
  contains(railTab, 'Stripe Connect'),
  'Rail tab includes Stripe Connect option',
)
check(
  contains(railTab, 'External or partner rail'),
  'Rail tab includes External rail option',
)
check(
  contains(railTab, 'Not configured'),
  'Rail tab includes Not configured option',
)
check(
  contains(railTab, '/api/funder/disbursement-rail'),
  'Rail tab POSTs to the rail API',
)
check(
  contains(railTab, '/api/stripe/connect'),
  'Rail tab still offers the existing Stripe Connect flow',
)

console.log('\n── Banned-phrase guard ──────────────────────────────────────────────────')

const BANNED: string[] = [
  'Vektrum moves money',
  'Vektrum holds funds',
  'Vektrum acts as escrow',
  'Stripe holds capital until every release condition is met',
  'funds are released automatically',
  'AI approves release',
]
const GUARDED: Array<[string, string]> = [
  [wizard,         WIZARD],
  [onboardingPage, ONBOARDING_PAGE],
  [railApi,        RAIL_API],
  [railTab,        RAIL_TAB],
  [fundBtn,        FUND_BTN],
  [dashboardPage,  DASHBOARD_PAGE],
]
for (const [src, label] of GUARDED) {
  for (const phrase of BANNED) {
    check(absent(src, phrase), `Banned phrase "${phrase}" absent from ${label}`)
  }
}

console.log('\n✅  funder-payment-rail-choice: all checks passed\n')
