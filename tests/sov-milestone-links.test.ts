/**
 * SOV Milestone Links — Static Safety Tests
 *
 * Verifies that milestone–SOV link routes and UI components are correctly
 * implemented as an advisory draw-control layer without touching the release gate.
 *
 * Source-parse checks only — no live DB, no rendering, no env vars required.
 *
 * Checks:
 *  1.  GET route file exists for sov-links
 *  2.  POST route file exists for sov-links
 *  3.  DELETE route file exists for sov-links/[linkId]
 *  4.  POST route requires contractor or admin role
 *  5.  DELETE route requires contractor or admin role
 *  6.  POST route validates allocated_amount >= 0
 *  7.  POST route blocks duplicate links (409 on unique constraint code '23505')
 *  8.  POST route validates sov_line_item_id is required
 *  9.  POST route verifies SOV item belongs to same deal
 * 10.  GET route returns links with joined sov_line_item
 * 11.  POST route logs audit event 'milestone_sov_linked'
 * 12.  DELETE route logs audit event 'milestone_sov_unlinked'
 * 13.  MilestoneCard accepts sovItems and sovLinks props
 * 14.  MilestoneCard renders "SOV Line Items" section label
 * 15.  MilestoneCard renders advisory when no links exist
 * 16.  MilestoneCard renders advisory for unapproved SOV items
 * 17.  MilestoneCard renders advisory for over-allocated amount
 * 18.  MilestoneCard Link2 icon imported from lucide-react
 * 19.  Release gate does not reference milestone_sov_links
 * 20.  Stripe payment route does not reference milestone_sov_links
 * 21.  page.tsx fetches links with joined sov_line_item
 * 22.  page.tsx builds sovLinksMap per milestone
 * 23.  page.tsx passes sovLinks to MilestoneCard
 * 24.  page.tsx passes sovItems to MilestoneCard
 * 25.  Test file is wired into npm test in package.json
 *
 * Run: npx tsx tests/sov-milestone-links.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

// ─── Runner ───────────────────────────────────────────────────────────────────

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

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8')
}

function exists(relPath: string): boolean {
  return fs.existsSync(path.resolve(ROOT, relPath))
}

// ─── File paths ───────────────────────────────────────────────────────────────

const SOV_LINKS_ROUTE      = 'src/app/api/milestones/[milestoneId]/sov-links/route.ts'
const SOV_LINK_ID_ROUTE    = 'src/app/api/milestones/[milestoneId]/sov-links/[linkId]/route.ts'
const MILESTONE_CARD       = 'src/components/deal/milestone-card.tsx'
const GATE                 = 'src/lib/engine/release-gate.ts'
const STRIPE_ROUTE         = 'src/app/api/stripe/webhooks/route.ts'
const PAGE                 = 'src/app/dashboard/deals/[dealId]/page.tsx'
const PACKAGE_JSON         = 'package.json'

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── Route file existence ──────────────────────────────────────────────────────

await test('1. GET route file exists for sov-links', () => {
  assert(exists(SOV_LINKS_ROUTE), `${SOV_LINKS_ROUTE} must exist — GET handler for listing SOV links.`)
})

await test('2. POST route file exists for sov-links', () => {
  assert(exists(SOV_LINKS_ROUTE), `${SOV_LINKS_ROUTE} must exist — POST handler for creating SOV links.`)
})

await test('3. DELETE route file exists for sov-links/[linkId]', () => {
  assert(exists(SOV_LINK_ID_ROUTE), `${SOV_LINK_ID_ROUTE} must exist — DELETE handler for removing SOV links.`)
})

// ── Auth and role guards ──────────────────────────────────────────────────────

await test('4. POST route requires contractor or admin role', () => {
  const src = read(SOV_LINKS_ROUTE)
  assert(
    src.includes("role !== 'contractor'") || src.includes('role !== "contractor"'),
    `${SOV_LINKS_ROUTE} POST must guard against non-contractor, non-admin roles.`,
  )
})

await test('5. DELETE route requires contractor or admin role', () => {
  const src = read(SOV_LINK_ID_ROUTE)
  assert(
    src.includes("role !== 'contractor'") || src.includes('role !== "contractor"'),
    `${SOV_LINK_ID_ROUTE} DELETE must guard against non-contractor, non-admin roles.`,
  )
})

// ── Validation ────────────────────────────────────────────────────────────────

await test('6. POST route validates allocated_amount >= 0', () => {
  const src = read(SOV_LINKS_ROUTE)
  assert(
    src.includes('amount < 0') || src.includes('allocated_amount < 0'),
    `${SOV_LINKS_ROUTE} POST must reject negative allocated_amount values.`,
  )
})

await test('7. POST route blocks duplicate links (409 on unique constraint)', () => {
  const src = read(SOV_LINKS_ROUTE)
  assert(
    src.includes('23505') && src.includes('409'),
    `${SOV_LINKS_ROUTE} POST must return 409 when unique constraint '23505' fires (duplicate link attempt).`,
  )
})

await test('8. POST route validates sov_line_item_id is required', () => {
  const src = read(SOV_LINKS_ROUTE)
  assert(
    src.includes('sov_line_item_id'),
    `${SOV_LINKS_ROUTE} POST must validate that sov_line_item_id is present in the request body.`,
  )
})

await test('9. POST route verifies SOV item belongs to same deal', () => {
  const src = read(SOV_LINKS_ROUTE)
  assert(
    src.includes('deal_id') && src.includes('milestone.deal_id'),
    `${SOV_LINKS_ROUTE} POST must verify that the SOV line item belongs to the same deal as the milestone.`,
  )
})

// ── GET response shape ────────────────────────────────────────────────────────

await test('10. GET route returns links with joined sov_line_item', () => {
  const src = read(SOV_LINKS_ROUTE)
  assert(
    src.includes('sov_line_item:sov_line_items(*)') || src.includes("sov_line_item:sov_line_items"),
    `${SOV_LINKS_ROUTE} GET must join sov_line_items so the caller gets full SOV item data with each link.`,
  )
})

// ── Audit events ──────────────────────────────────────────────────────────────

await test('11. POST route logs audit event "milestone_sov_linked"', () => {
  const src = read(SOV_LINKS_ROUTE)
  assert(
    src.includes('milestone_sov_linked'),
    `${SOV_LINKS_ROUTE} POST must call logAudit with action 'milestone_sov_linked'.`,
  )
})

await test('12. DELETE route logs audit event "milestone_sov_unlinked"', () => {
  const src = read(SOV_LINK_ID_ROUTE)
  assert(
    src.includes('milestone_sov_unlinked'),
    `${SOV_LINK_ID_ROUTE} DELETE must call logAudit with action 'milestone_sov_unlinked'.`,
  )
})

// ── MilestoneCard props and UI ────────────────────────────────────────────────

await test('13. MilestoneCard accepts sovItems and sovLinks props', () => {
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('sovItems') && src.includes('sovLinks'),
    `${MILESTONE_CARD} must declare sovItems and sovLinks props to receive deal-level SOV data.`,
  )
})

await test('14. MilestoneCard renders "SOV Line Items" section label', () => {
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('SOV Line Items'),
    `${MILESTONE_CARD} must render an "SOV Line Items" section label inside the card.`,
  )
})

await test('15. MilestoneCard renders advisory when no links exist', () => {
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('No SOV line items linked') || src.includes('not linked to'),
    `${MILESTONE_CARD} must render an advisory message when no SOV line items are linked to the milestone.`,
  )
})

await test('16. MilestoneCard renders advisory for unapproved SOV items', () => {
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('not yet approved') || src.includes('not been approved'),
    `${MILESTONE_CARD} must render an advisory message when a linked SOV item has not been approved by the funder.`,
  )
})

await test('17. MilestoneCard renders advisory for over-allocated amount', () => {
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('overAllocated') || src.includes('exceeds milestone amount'),
    `${MILESTONE_CARD} must render an advisory warning when total SOV allocation exceeds the milestone amount.`,
  )
})

await test('18. MilestoneCard Link2 icon imported from lucide-react', () => {
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('Link2'),
    `${MILESTONE_CARD} must import and use the Link2 icon from lucide-react for the SOV link section label.`,
  )
})

// ── Safety: release gate and payment routes unchanged ─────────────────────────

await test('19. Release gate does not reference milestone_sov_links', () => {
  if (!exists(GATE)) return
  const src = read(GATE)
  assert(
    !src.includes('milestone_sov_links') && !src.includes('sovLinks'),
    `${GATE} must not reference milestone SOV links — SOV linkage is advisory only, not a release condition.`,
  )
})

await test('20. Stripe payment route does not reference milestone_sov_links', () => {
  if (!exists(STRIPE_ROUTE)) return
  const src = read(STRIPE_ROUTE)
  assert(
    !src.includes('milestone_sov_links') && !src.includes('sovLinks'),
    `${STRIPE_ROUTE} must not reference SOV links — payment execution is independent of the advisory SOV layer.`,
  )
})

// ── page.tsx integration ──────────────────────────────────────────────────────

await test('21. page.tsx fetches links with joined sov_line_item', () => {
  const src = read(PAGE)
  assert(
    src.includes('sov_line_item:sov_line_items(*)') || src.includes("sov_line_item:sov_line_items"),
    `${PAGE} must fetch milestone_sov_links with joined sov_line_items(*) so MilestoneCard gets full item data.`,
  )
})

await test('22. page.tsx builds sovLinksMap per milestone', () => {
  const src = read(PAGE)
  assert(
    src.includes('sovLinksMap'),
    `${PAGE} must build a sovLinksMap (milestone_id → MilestoneSovLink[]) to pass per-milestone links to MilestoneCard.`,
  )
})

await test('23. page.tsx passes sovLinks to MilestoneCard', () => {
  const src = read(PAGE)
  assert(
    src.includes('sovLinks={sovLinksMap'),
    `${PAGE} must pass sovLinks={sovLinksMap.get(milestone.id) ?? []} to each MilestoneCard.`,
  )
})

await test('24. page.tsx passes sovItems to MilestoneCard', () => {
  const src = read(PAGE)
  assert(
    src.includes('sovItems={sovItems}'),
    `${PAGE} must pass sovItems={sovItems} to each MilestoneCard so the add-link dropdown is populated.`,
  )
})

// ── Package.json ──────────────────────────────────────────────────────────────

await test('25. Test file is wired into npm test in package.json', () => {
  const src = read(PACKAGE_JSON)
  assert(
    src.includes('sov-milestone-links.test.ts'),
    `${PACKAGE_JSON} must include sov-milestone-links.test.ts in the test script.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — SOV MILESTONE LINKS')
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
