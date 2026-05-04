/**
 * tests/dashboard-onboarding-empty-state.test.ts
 *
 * Pins the role-correct empty-state pass on the authenticated dashboard
 * (/dashboard) and the new-deal page (/dashboard/deals/new).
 *
 *   1. Funder empty state
 *      - title:   "No governed deals yet"
 *      - body:    references contract / funding agreement / draw schedule and
 *                 "release authorization"
 *      - CTA:     "Create governed deal" → /dashboard/deals/new
 *      - banned:  "once a contractor invites you" (contractor-led copy)
 *
 *   2. Contractor empty state
 *      - title:   "No projects yet"
 *      - body:    "submit project information for funder review"
 *      - CTA:     "Submit project information" → /dashboard/deals/new
 *      - banned:  "Create governed deal" (funder-only framing)
 *      - banned:  "control release" / "authorize their own release"
 *
 *   3. Unknown / missing role
 *      - explicit "Complete your profile to continue." prompt
 *      - safe CTA to /dashboard/settings (does NOT silently render funder)
 *
 *   4. Contractor new-deal page
 *      - eyebrow "Project Submission"
 *      - heading "Submit project information"
 *      - advisory heading "Submit project information for funder review"
 *      - body references "funder's selected payment rail executes"
 *      - draft note "draft until a funder verifies the deal"
 *      - labels Project Name / Proposed Contract Amount / Proposed Retainage Term
 *      - submit button "Submit project information"
 *      - banned "Your partner rail executes"
 *
 *   5. Funder new-deal page
 *      - heading "Create governed deal"
 *      - primary "Import from contract"
 *      - secondary "Manual entry" / "Enter details below"
 *
 *   6. Hard guardrails — no payment / release / Stripe transfer code path
 *      changed by this pass; dashboard page does not import release execution.
 *
 * Run: npx tsx tests/dashboard-onboarding-empty-state.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const DASHBOARD     = 'src/app/(app)/dashboard/page.tsx'
const NEW_DEAL_FORM = 'src/app/(app)/dashboard/deals/new/new-deal-form.tsx'
const PACKAGE_JSON  = 'package.json'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

// Slice the dashboard page into the contractor / funder / unknown render
// branches so banned-phrase checks can target the correct view. The first two
// occurrences of `profile.role === 'contractor'` and `profile.role === 'funder'`
// belong to the data-fetch function above the page render — the render
// branches are the SECOND occurrences, marked by their Dashboard eyebrow text.
function sliceBranches(src: string): {
  contractorBlock: string
  funderBlock:     string
  unknownBlock:    string
} {
  // Anchor on the role-specific PageHeader eyebrows that exist only inside the
  // render branches. Match case-insensitively — the institutional refactor uses
  // sentence case ("Contractor dashboard").
  const contractorIdx = src.search(/Contractor Dashboard/i)
  const funderIdx     = src.search(/Funder Dashboard/i)
  const adminIdx      = src.indexOf("if (profile.role === 'admin')")

  if (contractorIdx === -1 || funderIdx === -1 || adminIdx === -1) {
    fail('could not locate role-branch markers in dashboard page.tsx')
  }

  return {
    contractorBlock: src.slice(contractorIdx, funderIdx),
    funderBlock:     src.slice(funderIdx,     adminIdx),
    unknownBlock:    src.slice(adminIdx),
  }
}

async function main() {
  console.log('\ndashboard-onboarding-empty-state.test.ts\n')

  const dash = read(DASHBOARD)
  const form = read(NEW_DEAL_FORM)
  const pkg  = read(PACKAGE_JSON)

  const { contractorBlock, funderBlock, unknownBlock } = sliceBranches(dash)

  // ── 1. Funder empty state ──────────────────────────────────────────────
  console.log('1. Funder empty state')
  check(funderBlock.includes('No governed deals yet'),
    '  1a. funder empty-state title "No governed deals yet"')
  check(
    funderBlock.includes('Create your first governed deal') &&
    funderBlock.includes('contract, funding agreement, or draw schedule'),
    '  1b. funder body references contract / funding agreement / draw schedule',
  )
  check(
    funderBlock.includes('release authorization'),
    '  1c. funder body uses "release authorization" (not "before funds are authorized")',
  )
  check(
    funderBlock.includes('"Create governed deal"') &&
    funderBlock.includes('href: "/dashboard/deals/new"'),
    '  1d. funder primary CTA "Create governed deal" → /dashboard/deals/new',
  )
  check(
    !funderBlock.includes('once a contractor invites you'),
    '  1e. funder empty state does NOT contain "once a contractor invites you"',
  )

  // ── 2. Contractor empty state ──────────────────────────────────────────
  console.log('\n2. Contractor empty state')
  check(contractorBlock.includes('No projects yet'),
    '  2a. contractor empty-state title "No projects yet"')
  check(
    contractorBlock.includes('submit project information for funder review'),
    '  2b. contractor body mentions "submit project information for funder review"',
  )
  check(
    contractorBlock.includes('"Submit project information"') &&
    contractorBlock.includes('href: "/dashboard/deals/new"'),
    '  2c. contractor primary CTA "Submit project information" → /dashboard/deals/new',
  )
  check(
    !contractorBlock.includes('Create governed deal'),
    '  2d. contractor block does NOT include "Create governed deal" (funder framing)',
  )
  // The header CTA also follows the contractor language
  check(
    contractorBlock.includes('Submit project information'),
    '  2e. contractor PageHeader CTA uses "Submit project information"',
  )
  check(
    !contractorBlock.includes('Import from contract'),
    '  2f. contractor block does NOT advertise "Import from contract"',
  )
  // Authority guardrails — no copy implying contractors control / authorize release
  for (const banned of [
    'control release',
    'authorize release',
    'authorize your own release',
    'authorize their own release',
    'authorize own release',
    'release funds',
  ]) {
    check(
      !contractorBlock.toLowerCase().includes(banned),
      `  2g. contractor block does NOT contain "${banned}"`,
    )
  }

  // ── 3. Unknown / missing role ──────────────────────────────────────────
  console.log('\n3. Unknown / missing role')
  check(
    unknownBlock.includes('Complete your profile to continue.'),
    '  3a. unknown-role view shows "Complete your profile to continue."',
  )
  check(
    unknownBlock.includes('/dashboard/settings'),
    '  3b. unknown-role view links to /dashboard/settings (safe CTA)',
  )
  check(
    unknownBlock.includes('Sign out') &&
    unknownBlock.includes('/auth/logout'),
    '  3c. unknown-role view preserves Sign out CTA → /auth/logout',
  )
  // No silent fall-through to funder view: the unknown block must not contain
  // funder-only labels.
  check(
    !unknownBlock.includes('Create governed deal') &&
    !unknownBlock.includes('Capital Summary') &&
    !unknownBlock.includes('Action Queue'),
    '  3d. unknown-role view does NOT silently render funder copy/components',
  )

  // ── 4. Contractor new-deal page ────────────────────────────────────────
  console.log('\n4. Contractor new-deal page copy')
  check(form.includes('Project Submission'),                '  4a. eyebrow "Project Submission"')
  check(form.includes('"Submit project information"'),     '  4b. heading "Submit project information"')
  check(form.includes('Submit project information for funder review'),
    '  4c. advisory heading "Submit project information for funder review"')
  check(
    form.includes('funder’s selected payment') ||
    form.includes("funder's selected payment") ||
    form.includes('funder&rsquo;s selected payment'),
    '  4d. body mentions "funder\'s selected payment rail executes"',
  )
  check(
    form.includes('draft until a funder verifies'),
    '  4e. draft note: "draft until a funder verifies the deal"',
  )
  // Labels (renamed from funder-side terms)
  check(
    form.includes('"Project Name"') && form.includes('"Deal Title"'),
    '  4f. label "Project Name" present (alongside "Deal Title" for funder branch)',
  )
  check(
    form.includes('"Proposed Contract Amount (USD)"') &&
    form.includes('"Total Contract Amount (USD)"'),
    '  4g. label "Proposed Contract Amount" present (alongside "Total Contract Amount")',
  )
  check(
    form.includes('"Proposed Retainage Term"') &&
    form.includes('"Contract Retainage Term"'),
    '  4h. label "Proposed Retainage Term" present (alongside "Contract Retainage Term")',
  )
  check(
    form.includes('Suggested milestone sequence') &&
    form.includes('Require milestones to be released in order'),
    '  4i. label "Suggested milestone sequence" present for contractor (alongside funder phrasing)',
  )
  check(
    form.includes('"Submit project information"'),
    '  4j. submit button uses "Submit project information"',
  )
  // Banned phrasing
  for (const banned of [
    'Your partner rail executes',
    'your partner rail executes',
    'Your partner rail',
    'partner rail executes',
  ]) {
    check(
      !form.includes(banned),
      `  4k. contractor copy does NOT contain "${banned}"`,
    )
  }

  // ── 5. Funder new-deal page ────────────────────────────────────────────
  console.log('\n5. Funder new-deal page copy')
  check(
    form.includes('"Create governed deal"'),
    '  5a. funder heading "Create governed deal"',
  )
  check(
    form.includes('Import from contract'),
    '  5b. primary path "Import from contract"',
  )
  // Manual-entry secondary path. The label was tightened during the
  // contract/funder setup pass from "Enter details below" → "Enter deal
  // details manually" to match the spec.
  check(
    form.includes('Manual entry') &&
    (form.includes('Enter deal details manually') || form.includes('Enter details below')),
    '  5c. secondary path "Manual entry" / "Enter deal details manually"',
  )
  check(
    form.includes('source of truth'),
    '  5d. funder advisory reinforces "source of truth"',
  )

  // ── 6. Hard guardrails — no release / payment / Stripe code added ──────
  console.log('\n6. Hard guardrails')
  // Dashboard page does not import release execution / Stripe transfer code.
  for (const forbidden of [
    'validateRelease',
    'authorizeRelease',
    'createTransfer',
    "'@/lib/stripe'",
    'stripe.transfers',
  ]) {
    check(!dash.includes(forbidden),
      `  6. dashboard does NOT import / call "${forbidden}"`)
  }

  // ── 7. Test wired into npm test ────────────────────────────────────────
  check(
    pkg.includes('dashboard-onboarding-empty-state.test.ts'),
    '7. dashboard-onboarding-empty-state.test.ts wired into npm test',
  )

  console.log('\n✓ All dashboard-onboarding-empty-state tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
