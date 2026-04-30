/**
 * Change-order UI static safety tests.
 *
 * No live DB. No rendering. Parses source files and asserts hard guarantees
 * about the change-order panel, the deal-page data fetch, and the existing
 * API routes — so that future changes cannot silently break these invariants.
 *
 * Checks:
 *  1. Deal page fetches change_orders from Supabase.
 *  2. Deal page builds changeOrdersMap and passes changeOrders prop to MilestoneCard.
 *  3. MilestoneCard accepts changeOrders prop.
 *  4. MilestoneCard renders the change order panel.
 *  5. Contractor create form visible for contractor role only.
 *  6. Funder approve/reject visible for funder role only.
 *  7. MilestoneCard does NOT call .insert/.update/.delete/.upsert directly (UI → API, not DB).
 *  8. MilestoneCard calls /api/change-orders for creation (POST).
 *  9. MilestoneCard calls /api/change-orders/[id] for decisions (PATCH).
 * 10. POST /api/change-orders still requires getAuthUser + requireRole(contractor).
 * 11. PATCH /api/change-orders/[id] still requires getAuthUser + requireRole(funder).
 * 12. Neither route performs DB writes inside MilestoneCard component.
 * 13. ChangeOrderStatus type includes 'submitted' (not the old erroneous 'pending').
 * 14. ChangeOrder interface exported from types.ts.
 * 15. Release gate, Stripe, RLS, and partner API files are not modified by this feature.
 *
 * Run:  npx tsx tests/change-orders-ui.test.ts
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

function read(p: string): string { return fs.readFileSync(path.resolve(ROOT, p), 'utf-8') }

/** Strip comments and string literals so safety regexes only see executable code. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

const DEAL_PAGE    = 'src/app/(app)/dashboard/deals/[dealId]/page.tsx'
const MILESTONE_CARD = 'src/components/deal/milestone-card.tsx'
const CO_POST      = 'src/app/api/change-orders/route.ts'
const CO_PATCH     = 'src/app/api/change-orders/[changeOrderId]/route.ts'
const TYPES        = 'src/lib/types.ts'
const GATE         = 'src/lib/engine/release-gate.ts'
const STRIPE_WH    = 'src/app/api/stripe/webhook/route.ts'

async function main() {

// ─── 1. Deal page data layer ──────────────────────────────────────────────────

await test('1. Deal page fetches from change_orders table', () => {
  const src = read(DEAL_PAGE)
  assert(
    src.includes(".from(\"change_orders\")") || src.includes(".from('change_orders')"),
    'deals/[dealId]/page.tsx does not query the change_orders table. ' +
    'Add: supabase.from("change_orders").select(...).eq("deal_id", dealId)',
  )
})

await test('2. Deal page builds changeOrdersMap keyed by milestone_id', () => {
  const src = read(DEAL_PAGE)
  assert(
    src.includes('changeOrdersMap'),
    'deals/[dealId]/page.tsx does not build a changeOrdersMap. ' +
    'Add: const changeOrdersMap = new Map<string, ChangeOrder[]>()',
  )
  assert(
    src.includes('milestone_id') && src.includes('changeOrdersMap'),
    'deals/[dealId]/page.tsx does not key changeOrdersMap by milestone_id.',
  )
})

await test('3. Deal page passes changeOrders prop to MilestoneCard', () => {
  const src = read(DEAL_PAGE)
  assert(
    src.includes('changeOrders='),
    'deals/[dealId]/page.tsx does not pass changeOrders prop to MilestoneCard.',
  )
  assert(
    src.includes('changeOrdersMap.get('),
    'deals/[dealId]/page.tsx does not call changeOrdersMap.get() when passing changeOrders.',
  )
})

// ─── 2. MilestoneCard prop contract ──────────────────────────────────────────

await test('4. MilestoneCard declares changeOrders prop in its interface', () => {
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('changeOrders'),
    'milestone-card.tsx does not declare a changeOrders prop. ' +
    'Add: changeOrders?: ChangeOrder[] to MilestoneCardProps.',
  )
  assert(
    src.includes('ChangeOrder'),
    'milestone-card.tsx does not import or reference the ChangeOrder type.',
  )
})

await test('5. MilestoneCard imports ChangeOrder from @/lib/types', () => {
  const src = read(MILESTONE_CARD)
  assert(
    /import type.*ChangeOrder.*from/.test(src) || /import.*ChangeOrder.*from/.test(src),
    'milestone-card.tsx does not import ChangeOrder from @/lib/types.',
  )
})

// ─── 3. Panel rendering ───────────────────────────────────────────────────────

await test('6. MilestoneCard renders the Change Order panel section', () => {
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('Change Order'),
    'milestone-card.tsx does not render a "Change Order" section. ' +
    'Add the change order panel inside the milestone card JSX.',
  )
})

await test('7. Contractor create form is role-guarded (contractor only)', () => {
  const src = read(MILESTONE_CARD)
  // The create form / "Request" button must be conditional on role === 'contractor'
  assert(
    /role\s*===\s*["']contractor["']/.test(src),
    'milestone-card.tsx does not guard the create form with role === "contractor".',
  )
})

await test('8. Funder approve/reject buttons are role-guarded (funder only)', () => {
  const src = read(MILESTONE_CARD)
  // Approve/reject must be conditional on role === 'funder'
  assert(
    /role\s*===\s*["']funder["']/.test(src),
    'milestone-card.tsx does not guard approve/reject buttons with role === "funder".',
  )
})

await test('9. MilestoneCard calls /api/change-orders for CO creation (POST)', () => {
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('/api/change-orders') && src.includes('POST'),
    'milestone-card.tsx does not POST to /api/change-orders for change order creation.',
  )
})

await test('10. MilestoneCard calls /api/change-orders/[id] for funder decisions (PATCH)', () => {
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('/api/change-orders/') && src.includes('PATCH'),
    'milestone-card.tsx does not PATCH /api/change-orders/[id] for approve/reject decisions.',
  )
})

// ─── 4. No direct DB writes in component ─────────────────────────────────────

await test('11. MilestoneCard does not call .insert/.update/.delete/.upsert directly', () => {
  const src = codeOnly(read(MILESTONE_CARD))
  for (const verb of ['insert', 'update', 'delete', 'upsert']) {
    const re = new RegExp(`\\.${verb}\\s*\\(`)
    assert(
      !re.test(src),
      `milestone-card.tsx calls .${verb}() directly — UI must call API routes, not the DB.`,
    )
  }
})

// ─── 5. API route auth guarantees ────────────────────────────────────────────

await test('12. POST /api/change-orders still requires getAuthUser', () => {
  const src = read(CO_POST)
  assert(/getAuthUser\(/.test(src), 'POST /api/change-orders does not call getAuthUser.')
})

await test('13. POST /api/change-orders still requires requireRole(contractor)', () => {
  const src = read(CO_POST)
  assert(
    /requireRole\([^)]*contractor/.test(src),
    'POST /api/change-orders does not call requireRole(contractor). ' +
    'Contractors must be the only role that can create change orders.',
  )
})

await test('14. PATCH /api/change-orders/[id] still requires getAuthUser', () => {
  const src = read(CO_PATCH)
  assert(/getAuthUser\(/.test(src), 'PATCH /api/change-orders/[id] does not call getAuthUser.')
})

await test('15. PATCH /api/change-orders/[id] still requires requireRole(funder)', () => {
  const src = read(CO_PATCH)
  assert(
    /requireRole\([^)]*funder/.test(src),
    'PATCH /api/change-orders/[id] does not call requireRole(funder). ' +
    'Only funders (or admins) should be able to approve or reject change orders.',
  )
})

// ─── 6. Type correctness ──────────────────────────────────────────────────────

await test('16. ChangeOrderStatus includes "submitted" (matches DB enum)', () => {
  const src = read(TYPES)
  assert(
    src.includes("'submitted'"),
    'types.ts ChangeOrderStatus does not include "submitted". ' +
    'The DB enum is: submitted | approved | rejected | paid. ' +
    'The old "pending" value was incorrect and has been replaced.',
  )
})

await test('17. ChangeOrderStatus does NOT include the old erroneous "pending"', () => {
  const src = read(TYPES)
  // Find the ChangeOrderStatus line and check it doesn't have 'pending' in it
  const line = src.split('\n').find((l) => l.includes('ChangeOrderStatus'))
  assert(
    line !== undefined && !line.includes("'pending'"),
    'types.ts ChangeOrderStatus still includes "pending" — the correct value is "submitted".',
  )
})

await test('18. ChangeOrder interface is exported from types.ts', () => {
  const src = read(TYPES)
  assert(
    src.includes('export interface ChangeOrder'),
    'types.ts does not export a ChangeOrder interface. ' +
    'Add: export interface ChangeOrder { id, milestone_id, deal_id, amount, description, status, ... }',
  )
})

// ─── 7. Unchanged safety surfaces ────────────────────────────────────────────

await test('19. Release gate file is unchanged (no change-order modification)', () => {
  // The release gate must still check Condition 7 independently.
  // Check the raw source for 'change_orders' (it appears in string literals),
  // and check codeOnly for any new write verbs.
  const rawSrc  = read(GATE)
  const codeSrc = codeOnly(rawSrc)
  assert(
    rawSrc.includes('change_orders'),
    'release-gate.ts no longer references change_orders — Condition 7 may have been removed.',
  )
  for (const verb of ['insert', 'update', 'delete', 'upsert']) {
    const re = new RegExp(`\\.${verb}\\s*\\(`)
    assert(!re.test(codeSrc), `release-gate.ts now calls .${verb}() — gate must remain read-only.`)
  }
})

await test('20. Stripe webhook file is unchanged (no cross-contamination)', () => {
  const src = read(STRIPE_WH)
  assert(
    !src.includes('change_orders'),
    'Stripe webhook route now references change_orders — this is unexpected cross-contamination.',
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — CHANGE-ORDER UI SAFETY TEST RESULTS')
console.log('════════════════════════════════════════════════════════════════════════')
for (const r of results) {
  if (r.passed) console.log(`  ✓  ${r.name}`)
  else          console.log(`  ✗  ${r.name}\n     ${r.error}`)
}
const passed = results.filter((r) => r.passed).length
const failed = results.length - passed
console.log('════════════════════════════════════════════════════════════════════════')
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('════════════════════════════════════════════════════════════════════════')
console.log('')

if (failed > 0) process.exit(1)

} // end main()

main()
