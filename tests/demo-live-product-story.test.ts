/**
 * tests/demo-live-product-story.test.ts
 *
 * Static source-parse checks verifying that the demo-live pages mirror the
 * current production product story:
 *   - Deal Control Center / Release Readiness in funder view
 *   - Schedule of Values section
 *   - Milestone–SOV linkage display
 *   - Perplexity Draw Control Brief
 *   - Guided contractor workflow
 *   - Non-custody language
 *   - "AI informs, gate decides" framing
 *   - Demo safety (no live Stripe, no DB calls, reset covers new state)
 *
 * All checks are static file reads — no live DB, no HTTP calls.
 */

import fs from 'fs'
import path from 'path'

// ── File paths ────────────────────────────────────────────────────────────────

const ROOT          = path.resolve(process.cwd())
const HARBOR_PAGE   = path.join(ROOT, 'src/app/(marketing)/demo-live/deal/harbor/page.tsx')
const FUNDER_PAGE   = path.join(ROOT, 'src/app/(marketing)/demo-live/funder/page.tsx')
const CONTRACTOR    = path.join(ROOT, 'src/app/(marketing)/demo-live/contractor/page.tsx')
const DEMO_DATA     = path.join(ROOT, 'src/lib/demo-data/index.ts')
const RESET_ROUTE   = path.join(ROOT, 'src/app/api/demo/reset/route.ts')

function read(p: string): string {
  if (!fs.existsSync(p)) throw new Error(`File not found: ${p}`)
  return fs.readFileSync(p, 'utf-8')
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { throw new Error(`FAIL: ${msg}`) }
function check(condition: boolean, msg: string) {
  condition ? pass(msg) : fail(msg)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\ndemo-live-product-story.test.ts\n')

  const harbor     = read(HARBOR_PAGE)
  const funder     = read(FUNDER_PAGE)
  const contractor = read(CONTRACTOR)
  const demoData   = read(DEMO_DATA)

  // ── 1. Deal Control Center ─────────────────────────────────────────────────
  console.log('Deal Control Center')
  check(harbor.includes('Deal Control Center'), 'Harbor page includes "Deal Control Center"')
  check(harbor.includes('Release Readiness'), 'Harbor page includes "Release Readiness"')
  check(harbor.includes('GATE_CONDITIONS'), 'Harbor page defines GATE_CONDITIONS array')
  check(harbor.includes('Release Ready'), 'Harbor page shows "Release Ready" badge')

  // ── 2. 10-condition release gate in UI ────────────────────────────────────
  console.log('\n10-condition gate display')
  check(harbor.includes('Milestone status approved'), 'Gate condition 1 present')
  check(harbor.includes('No open change orders'), 'Gate condition 7 present')
  check(harbor.includes('Signed contract on file'), 'Gate condition 8 present')
  check(harbor.includes('Approved conditional lien waiver on file'), 'Gate condition 10 present')

  // ── 3. Perplexity Draw Control Brief — funder view ────────────────────────
  console.log('\nPerplexity Draw Control Brief')
  check(harbor.includes('Perplexity'), 'Harbor page references Perplexity')
  check(harbor.includes('Draw Control Brief'), 'Harbor page shows Draw Control Brief label')
  check(harbor.includes('harborDrawBrief'), 'Harbor page uses harborDrawBrief data')
  check(funder.includes('Perplexity'), 'Funder page references Perplexity')
  check(funder.includes('Draw Control Brief'), 'Funder page references Draw Control Brief')

  // ── 4. Draw Brief in demo-data ────────────────────────────────────────────
  console.log('\nDemo data — Draw Brief')
  check(demoData.includes('DemoDrawBrief'), 'DemoDrawBrief interface exists in demo-data')
  check(demoData.includes('harborDrawBrief'), 'harborDrawBrief export exists in demo-data')
  check(demoData.includes('Perplexity Computer'), 'harborDrawBrief generated_by is Perplexity Computer')
  check(demoData.includes('All 10 release conditions verified'), 'harborDrawBrief recommendation present')

  // ── 5. Schedule of Values ─────────────────────────────────────────────────
  console.log('\nSchedule of Values')
  check(harbor.includes('Schedule of Values'), 'Harbor page has SOV section')
  check(harbor.includes('harborSovLineItems'), 'Harbor page uses harborSovLineItems')
  check(harbor.includes('Contract Value'), 'SOV table has Contract Value column')
  check(harbor.includes('Drawn'), 'SOV table has Drawn column')
  check(harbor.includes('Remaining'), 'SOV table has Remaining column')

  // ── 6. SOV data in demo-data ──────────────────────────────────────────────
  console.log('\nDemo data — SOV line items')
  check(demoData.includes('DemoSovLineItem'), 'DemoSovLineItem interface exists')
  check(demoData.includes('harborSovLineItems'), 'harborSovLineItems export exists')
  check(demoData.includes('getFreshHarborSovItems'), 'getFreshHarborSovItems factory exists')
  // One item should be unlinked (milestone_id: null) — ms-hb-4 Building Envelope
  check(demoData.includes("milestone_id: null"), 'At least one SOV item is unlinked (null)')
  // One item should be linked to ms-hb-3
  check(demoData.includes("'ms-hb-3'"), 'SOV item linked to ms-hb-3')

  // ── 7. Milestone–SOV link advisory ────────────────────────────────────────
  console.log('\nMilestone–SOV link advisory')
  check(harbor.includes('SOV linked'), 'Harbor page shows "SOV linked" for linked milestones')
  check(harbor.includes('No SOV link'), 'Harbor page shows "No SOV link" advisory for unlinked milestones')
  check(harbor.includes('No milestone link'), 'SOV table flags items with no milestone link')

  // ── 8. Guided contractor workflow ─────────────────────────────────────────
  console.log('\nContractor guided workflow')
  check(contractor.includes('Required Steps'), 'Contractor page shows "Required Steps" workflow')
  check(contractor.includes('Contract on file'), 'Workflow step 1: Contract on file')
  check(contractor.includes('Schedule of Values submitted'), 'Workflow step 2: SOV')
  check(contractor.includes('Draw request submitted'), 'Workflow step 3: Draw request')
  check(contractor.includes('Upload supporting documents'), 'Workflow step 4: Evidence upload')
  check(contractor.includes('Request AI review'), 'Workflow step 5: AI review')
  check(contractor.includes('Next step'), 'Active "Next step" badge shown in workflow')
  check(contractor.includes('10-condition check'), 'Contractor sees 10-condition check language')

  // ── 9. Non-custody language ───────────────────────────────────────────────
  console.log('\nNon-custody language')
  check(
    harbor.includes('does not hold funds') || harbor.includes('not hold funds'),
    'Harbor page: non-custody "does not hold funds" disclaimer'
  )
  check(
    harbor.includes('does not') && harbor.includes('escrow'),
    'Harbor page: does not act as escrow'
  )
  check(
    harbor.includes('selected rail') || harbor.includes('payment rail'),
    'Harbor page: selected rail language'
  )

  // ── 10. AI framing — informs, gate decides ────────────────────────────────
  console.log('\nAI framing')
  check(
    harbor.includes('AI informs') || harbor.includes('AI Draw Review') || harbor.includes('draw review'),
    'Harbor page: AI review (not AI approval) language'
  )
  // Ensure no "AI approves" language
  check(
    !harbor.toLowerCase().includes('ai approves') && !harbor.toLowerCase().includes('ai approved'),
    'Harbor page: no "AI approves" language'
  )

  // ── 11. Demo safety — no live Stripe calls ────────────────────────────────
  console.log('\nDemo safety')
  check(!harbor.includes("from '@/lib/stripe'") && !harbor.includes("from 'stripe'"), 'Harbor page: no live Stripe import')
  check(!contractor.includes("from '@/lib/stripe'"), 'Contractor page: no live Stripe import')
  check(!funder.includes("from '@/lib/stripe'"), 'Funder page: no live Stripe import')

  // ── 12. Demo reset — covers new state ────────────────────────────────────
  console.log('\nDemo reset coverage')
  // The reset is frontend-only; verify the harbor page resets all new state
  check(harbor.includes('setReleaseEvents([])'), 'Harbor reset clears release events')
  check(harbor.includes('setOverrides({})'), 'Harbor reset clears overrides')
  check(harbor.includes('setNewlyReleased(new Set())'), 'Harbor reset clears newlyReleased')
  // Contractor reset
  check(contractor.includes('setReviewSubmitted(false)'), 'Contractor reset clears reviewSubmitted')

  // ── 13. Demo reset route — env-gated, no DB calls for SOV ─────────────────
  if (fs.existsSync(RESET_ROUTE)) {
    const reset = read(RESET_ROUTE)
    check(
      reset.includes('DEMO_MODE') || reset.includes('demo') || reset.includes('env'),
      'Demo reset route references env gating'
    )
    check(
      !reset.includes('milestone_sov_links') && !reset.includes('sov_line_items'),
      'Demo reset route does not call SOV DB tables (SOV is frontend-only in demo)'
    )
  } else {
    pass('Demo reset route not found — skipping (route may be nested)')
  }

  // ── 14. Funder page — Perplexity briefing in correct section ─────────────
  console.log('\nFunder page briefing')
  check(funder.includes('Perplexity Draw Control Briefing'), 'Funder page section title is "Perplexity Draw Control Briefing"')
  check(funder.includes('all 10 release conditions verified'), 'Funder briefing mentions all 10 conditions')
  check(funder.includes('score 91'), 'Funder briefing includes Harbor score 91')

  // ── 15. Harbor page — funder-only vs contractor-only sections ─────────────
  console.log('\nRole-specific sections')
  check(harbor.includes("from !== 'contractor'"), 'Deal Control Center gated to non-contractor views')
  check(harbor.includes("from === 'contractor'"), 'Contractor guided workflow gated to contractor view')

  console.log('\n✓ All demo-live-product-story tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
