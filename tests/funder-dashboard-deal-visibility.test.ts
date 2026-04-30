/**
 * tests/funder-dashboard-deal-visibility.test.ts
 *
 * Static source-parse checks that the funder dashboard shows ALL accessible
 * deals — including draft / unfunded deals where funder_id matches but
 * funded_amount === 0 and no milestones are ready_for_review.
 *
 * Root cause of the bug: the old "Funded Deals" section filtered by
 * funded_amount > 0, so unfunded deals were fetched correctly from the DB
 * but never rendered — completely invisible on the dashboard.
 *
 * Checks:
 *  1.  Dashboard page file exists
 *  2.  Funder query filters by funder_id (correct identity scope)
 *  3.  "All Projects" section label exists (replaces old "Funded Deals" only view)
 *  4.  All deals rendered — deals.map() used for the all-projects grid, not funded.map()
 *  5.  Old funded_amount filter removed from section render (no silent exclusion)
 *  6.  Action Queue section still present (action-required highlight preserved)
 *  7.  Action Queue still filters by ready_for_review milestone status
 *  8.  Unfunded empty state does NOT gate deal visibility (no funded_amount check in render)
 *  9.  DealCard rendered for all-projects section
 * 10.  Contractor view unchanged — "Your Deals" still uses deals.map()
 * 11.  package.json wires this test file into npm test
 *
 * Run: npx tsx tests/funder-dashboard-deal-visibility.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

function read(rel: string): string {
  const full = path.resolve(ROOT, rel)
  if (!fs.existsSync(full)) throw new Error(`File not found: ${rel}`)
  return fs.readFileSync(full, 'utf-8')
}

function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel))
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

const DASHBOARD   = 'src/app/(app)/dashboard/page.tsx'
const PACKAGE_JSON = 'package.json'

async function main() {
  console.log('\nfunder-dashboard-deal-visibility.test.ts\n')

  // ── 1. File exists ────────────────────────────────────────────────────────────
  check(exists(DASHBOARD), '1. Dashboard page file exists')

  const page = read(DASHBOARD)

  // ── 2. Funder query uses funder_id filter ─────────────────────────────────────
  check(
    page.includes("query = query.eq('funder_id', userId)"),
    '2. Funder query filters by funder_id (correct identity scope)',
  )

  // ── 3. "All Projects" section label present ───────────────────────────────────
  check(
    page.includes('All Projects'),
    '3. Funder dashboard has "All Projects" section label',
  )

  // ── 4. All deals rendered (deals.map not funded.map in all-projects grid) ─────
  // The all-projects section must iterate over `deals`, not a funded-filtered subset.
  // Use the section comment "// ── Funder view" as a reliable landmark for the JSX block.
  const funderViewStart = page.indexOf('// ── Funder view')
  const funderViewBlock = page.slice(funderViewStart)
  check(
    funderViewBlock.includes('deals.map('),
    '4. Funder view iterates over all deals (deals.map), not only funded subset',
  )

  // ── 5. funded_amount filter NOT used to gate section render ───────────────────
  // The old bug: const funded = deals.filter((d) => d.funded_amount > 0)
  // then funded.map(...) in JSX — unfunded deals never appeared.
  // After fix: no funded.map() call in the funder view JSX.
  check(
    !funderViewBlock.includes('funded.map('),
    '5. Funder view does not use funded.map() — old funded-only filter removed',
  )

  // ── 6. Action Queue section still present ────────────────────────────────────
  check(
    funderViewBlock.includes('Action Queue'),
    '6. Action Queue section still present in funder view',
  )

  // ── 7. Action Queue still uses ready_for_review filter ───────────────────────
  check(
    funderViewBlock.includes('ready_for_review'),
    '7. Action Queue still filters milestones by ready_for_review status',
  )

  // ── 8. No funded_amount render gate in all-projects section ──────────────────
  // Specifically: the "All Projects" / all-deals section must not be wrapped in
  // a `funded.length > 0` or `funded_amount > 0` conditional that would hide it.
  // We check that the "All Projects" label is not inside a funded-only conditional.
  // Simple heuristic: "All Projects" appears in the source without funded.length guard
  // immediately before it (within 200 chars).
  const allProjectsIdx = page.indexOf('All Projects')
  const before200      = page.slice(Math.max(0, allProjectsIdx - 200), allProjectsIdx)
  check(
    !before200.includes('funded.length'),
    '8. "All Projects" section is not gated behind funded.length > 0 check',
  )

  // ── 9. DealCard used in all-projects section ──────────────────────────────────
  // Confirm DealCard is rendered inside the all-projects iteration context.
  // funderViewBlock contains deals.map(... <DealCard ...) — check both are present.
  check(
    funderViewBlock.includes('DealCard'),
    '9. DealCard is rendered in funder view (all-projects section)',
  )

  // ── 10. Contractor view unchanged — still uses deals.map ─────────────────────
  // Use the section comment "// ── Contractor view" as a reliable landmark.
  const contractorViewCommentStart = page.indexOf('// ── Contractor view')
  const contractorJsxBlock = contractorViewCommentStart >= 0
    ? page.slice(contractorViewCommentStart, funderViewStart)
    : ''
  check(
    contractorJsxBlock.includes('deals.map('),
    '10. Contractor view unchanged — still iterates over all deals with deals.map()',
  )

  // ── 11. Test wired into package.json ─────────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('funder-dashboard-deal-visibility.test.ts'),
    '11. This test file is wired into npm test in package.json',
  )

  console.log('\n✓ All funder-dashboard-deal-visibility tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
