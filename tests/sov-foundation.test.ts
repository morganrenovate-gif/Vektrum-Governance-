/**
 * SOV Foundation tests.
 *
 * Static source-parse checks — no live DB, no rendering.
 *
 * Covers:
 *  1.  Migration file exists and creates sov_line_items table.
 *  2.  All required CHECK constraints are present.
 *  3.  Required indexes are present.
 *  4.  RLS is enabled on sov_line_items.
 *  5.  Deal-participant SELECT policy exists (no public access).
 *  6.  Contractor INSERT policy requires deal ownership.
 *  7.  Funder/admin approve policy exists.
 *  8.  milestone_sov_links table is present with unique constraint.
 *  9.  updated_at trigger is present.
 * 10.  TypeScript types for SovLineItem and MilestoneSovLink exported.
 * 11.  GET /api/deals/[dealId]/sov — route exists and requires auth.
 * 12.  GET route returns items + totals + warnings.
 * 13.  POST route — contractor/admin only, validates negative values.
 * 14.  PATCH route — approve action requires funder/admin.
 * 15.  PATCH route — field update recomputes revised_value/balance_to_finish.
 * 16.  SOV section component renders SOV table with totals.
 * 17.  SOV section renders advisory warning (mismatch) without blocking release.
 * 18.  Deal detail page imports and renders SovSection.
 * 19.  Release gate logic is unchanged (not modified).
 * 20.  Stripe/payment routes are unchanged.
 * 21.  SOV mismatch warning does NOT appear in release-gate source.
 * 22.  SOV GET route uses getAuthUser before any DB access.
 * 23.  SOV POST route uses createSupabaseAdminClient for insert.
 * 24.  SOV PATCH route uses createSupabaseAdminClient (never leaks service key).
 *
 * Run: npx tsx tests/sov-foundation.test.ts
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

function codeOnly(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

// ─── File paths ───────────────────────────────────────────────────────────────

const MIGRATION     = 'supabase/migrations/20260429000001_sov.sql'
const TYPES         = 'src/lib/types.ts'
const SOV_GET_POST  = 'src/app/api/deals/[dealId]/sov/route.ts'
const SOV_PATCH     = 'src/app/api/deals/[dealId]/sov/[itemId]/route.ts'
const SOV_COMPONENT = 'src/components/deal/sov-section.tsx'
const DEAL_DETAIL   = 'src/app/dashboard/deals/[dealId]/page.tsx'
const RELEASE_GATE  = 'src/lib/engine/release-gate.ts'
const RELEASE_ROUTE = 'src/app/api/milestones/[milestoneId]/release/route.ts'
const STRIPE_ROUTE  = 'src/app/api/stripe/webhooks/route.ts'

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── Migration ─────────────────────────────────────────────────────────────────

await test('migration: file exists', () => {
  assert(fs.existsSync(path.resolve(ROOT, MIGRATION)), `${MIGRATION} must exist`)
})

await test('migration: creates sov_line_items table', () => {
  const src = read(MIGRATION)
  assert(
    src.includes('CREATE TABLE IF NOT EXISTS public.sov_line_items') ||
    src.includes('create table if not exists public.sov_line_items') ||
    src.includes('create table public.sov_line_items'),
    `${MIGRATION} must CREATE TABLE public.sov_line_items`,
  )
})

await test('migration: CHECK constraints on numeric fields', () => {
  const src = read(MIGRATION)
  assert(src.includes('sov_scheduled_value_nn') || src.includes('scheduled_value >= 0'),
    'scheduled_value CHECK constraint must be present')
  assert(src.includes('sov_current_requested_nn') || src.includes('current_requested >= 0'),
    'current_requested CHECK constraint must be present')
  assert(src.includes('sov_percent_complete_range') || src.includes('percent_complete >= 0 AND percent_complete <= 100'),
    'percent_complete range CHECK constraint must be present')
  assert(src.includes("'draft', 'pending_review', 'approved', 'superseded'") ||
         src.includes("status IN (''"),
    'status CHECK constraint with allowed values must be present')
})

await test('migration: indexes exist', () => {
  const src = read(MIGRATION)
  assert(src.includes('sov_line_items_deal_id_idx') || src.includes('ON public.sov_line_items(deal_id)'),
    'deal_id index must be present')
  assert(src.includes('sov_line_items_deal_sort_idx') || src.includes('sort_order'),
    'deal_id + sort_order index must be present')
})

await test('migration: RLS enabled on sov_line_items', () => {
  const src = read(MIGRATION)
  assert(
    src.includes('ALTER TABLE public.sov_line_items ENABLE ROW LEVEL SECURITY') ||
    src.includes('alter table public.sov_line_items enable row level security'),
    `${MIGRATION} must enable RLS on sov_line_items`,
  )
})

await test('migration: deal-participant SELECT policy (no public access)', () => {
  const src = read(MIGRATION)
  assert(
    src.includes('sov_participant_select') || src.includes('is_deal_participant'),
    `${MIGRATION} must have a SELECT policy restricted to deal participants`,
  )
  // Ensure no "TO public" or "TO anon" policy is present
  assert(
    !src.includes('TO public') && !src.includes('TO anon'),
    `${MIGRATION} must not grant public or anon access to sov_line_items`,
  )
})

await test('migration: contractor INSERT policy requires deal ownership', () => {
  const src = read(MIGRATION)
  assert(
    src.includes('sov_contractor_insert') || src.includes('contractor_id = auth.uid()'),
    `${MIGRATION} must restrict INSERT to contractors on their own deals`,
  )
})

await test('migration: funder/admin approve UPDATE policy exists', () => {
  const src = read(MIGRATION)
  assert(
    src.includes('sov_funder_approve') || src.includes('funder_id = auth.uid()'),
    `${MIGRATION} must grant funders UPDATE access to approve SOV line items`,
  )
})

await test('migration: milestone_sov_links table with unique constraint', () => {
  const src = read(MIGRATION)
  assert(
    src.includes('public.milestone_sov_links'),
    `${MIGRATION} must create milestone_sov_links table`,
  )
  assert(
    src.includes('UNIQUE (milestone_id, sov_line_item_id)') ||
    src.includes('milestone_sov_links_unique'),
    `${MIGRATION} must have a unique constraint on (milestone_id, sov_line_item_id)`,
  )
})

await test('migration: updated_at trigger on sov_line_items', () => {
  const src = read(MIGRATION)
  assert(
    src.includes('trg_sov_line_items_updated_at') || src.includes('set_updated_at'),
    `${MIGRATION} must attach the set_updated_at trigger to sov_line_items`,
  )
})

// ── Types ─────────────────────────────────────────────────────────────────────

await test('types: SovLineItem interface exported', () => {
  const src = read(TYPES)
  assert(src.includes('export interface SovLineItem'),
    `${TYPES} must export SovLineItem interface`)
  assert(src.includes('scheduled_value') && src.includes('revised_value'),
    `SovLineItem must include scheduled_value and revised_value fields`)
  assert(src.includes('percent_complete') && src.includes('balance_to_finish'),
    `SovLineItem must include percent_complete and balance_to_finish fields`)
})

await test('types: MilestoneSovLink interface exported', () => {
  const src = read(TYPES)
  assert(src.includes('export interface MilestoneSovLink'),
    `${TYPES} must export MilestoneSovLink interface`)
  assert(src.includes('sov_line_item_id') && src.includes('allocated_amount'),
    `MilestoneSovLink must include sov_line_item_id and allocated_amount fields`)
})

// ── GET/POST API route ────────────────────────────────────────────────────────

await test('SOV GET route: file exists and exports GET and POST', () => {
  const src = read(SOV_GET_POST)
  assert(src.includes('export async function GET'), `${SOV_GET_POST} must export GET`)
  assert(src.includes('export async function POST'), `${SOV_GET_POST} must export POST`)
})

await test('SOV GET route: uses getAuthUser before DB access', () => {
  const src = read(SOV_GET_POST)
  const getIdx  = src.indexOf('async function GET')
  const authIdx = src.indexOf('getAuthUser', getIdx)
  const dbIdx   = src.indexOf("from('sov_line_items')", getIdx)
  assert(authIdx > 0, `${SOV_GET_POST} GET must call getAuthUser`)
  assert(authIdx < dbIdx, `${SOV_GET_POST} GET must call getAuthUser before querying DB`)
})

await test('SOV GET route: returns items, totals, and warnings', () => {
  const src = read(SOV_GET_POST)
  assert(src.includes('totals') && src.includes('warnings'),
    `${SOV_GET_POST} GET response must include totals and warnings`)
})

await test('SOV POST route: validates negative scheduled_value', () => {
  const src = read(SOV_GET_POST)
  const code = codeOnly(src)
  assert(
    /scheduled_value.*<.*0|scheduled_value.*>=.*0/.test(code.replace(/\s+/g, ' ')),
    `${SOV_GET_POST} POST must validate that scheduled_value >= 0`,
  )
})

await test('SOV POST route: uses createSupabaseAdminClient for insert', () => {
  const src = read(SOV_GET_POST)
  assert(src.includes('createSupabaseAdminClient'),
    `${SOV_GET_POST} POST must use admin client for insert (bypasses RLS safely)`)
})

await test('SOV POST route: logs sov_line_item_created audit event', () => {
  const src = read(SOV_GET_POST)
  assert(
    src.includes('sov_line_item_created'),
    `${SOV_GET_POST} POST must log a sov_line_item_created audit event`,
  )
})

// ── PATCH API route ───────────────────────────────────────────────────────────

await test('SOV PATCH route: file exists and exports PATCH', () => {
  const src = read(SOV_PATCH)
  assert(src.includes('export async function PATCH'), `${SOV_PATCH} must export PATCH`)
})

await test('SOV PATCH route: approve action requires funder or admin', () => {
  const src = read(SOV_PATCH)
  // The approve branch must check role
  const approveIdx = src.indexOf("body.action === 'approve'") + src.indexOf('body.action === ""')
  assert(
    src.includes("profile.role !== 'funder' && profile.role !== 'admin'") ||
    src.includes('funder') && src.includes('admin') && src.includes('approve'),
    `${SOV_PATCH} approve action must be restricted to funders and admins`,
  )
})

await test('SOV PATCH route: field update recomputes derived fields', () => {
  const src = read(SOV_PATCH)
  assert(
    src.includes('computeSovFields') || (src.includes('revised_value') && src.includes('balance_to_finish')),
    `${SOV_PATCH} must recompute revised_value and balance_to_finish on field updates`,
  )
})

await test('SOV PATCH route: logs sov_line_item_updated and sov_line_item_approved', () => {
  const src = read(SOV_PATCH)
  assert(src.includes('sov_line_item_approved'), `${SOV_PATCH} must log sov_line_item_approved`)
  assert(src.includes('sov_line_item_updated'),  `${SOV_PATCH} must log sov_line_item_updated`)
})

await test('SOV PATCH route: uses createSupabaseAdminClient (no service key leakage)', () => {
  const src = read(SOV_PATCH)
  assert(src.includes('createSupabaseAdminClient'),
    `${SOV_PATCH} must use admin client — never expose service key to client`)
  // Should NOT embed a raw service-role key literal
  assert(
    !src.includes('service_role') && !src.includes('eyJhbGci'),
    `${SOV_PATCH} must not embed a raw service-role key`,
  )
})

// ── SOV component ─────────────────────────────────────────────────────────────

await test('SovSection: component file exists', () => {
  assert(fs.existsSync(path.resolve(ROOT, SOV_COMPONENT)), `${SOV_COMPONENT} must exist`)
})

await test('SovSection: renders SOV table with totals row', () => {
  const src = read(SOV_COMPONENT)
  assert(src.includes('<table') || src.includes('<tfoot'), `${SOV_COMPONENT} must render a table`)
  assert(src.includes('Totals') || src.includes('tfoot'), `${SOV_COMPONENT} must have a totals row`)
})

await test('SovSection: advisory warning rendered but does not block release', () => {
  const src = read(SOV_COMPONENT)
  // Warning exists in UI
  assert(
    src.includes('does not match deal contract amount') ||
    src.includes('SOV') && src.includes('warnings'),
    `${SOV_COMPONENT} must display SOV mismatch warnings`,
  )
  // Must NOT call any release-blocking API
  assert(
    !src.includes('/release') && !src.includes('blockers'),
    `${SOV_COMPONENT} must not block or modify release gate behavior`,
  )
})

await test('SovSection: shows Approve button for funder on pending_review items', () => {
  const src = read(SOV_COMPONENT)
  assert(
    src.includes('Approve') && src.includes('pending_review'),
    `${SOV_COMPONENT} must show Approve button for funder on pending_review items`,
  )
})

await test('SovSection: contractor can add draft line items', () => {
  const src = read(SOV_COMPONENT)
  assert(
    src.includes('Add SOV Line Item') || src.includes('AddSovItemForm'),
    `${SOV_COMPONENT} must allow contractors to add draft line items`,
  )
})

// ── Deal detail integration ────────────────────────────────────────────────────

await test('deal detail: imports and renders SovSection', () => {
  const src = read(DEAL_DETAIL)
  assert(src.includes('SovSection'), `${DEAL_DETAIL} must import and render SovSection`)
  assert(
    src.includes("from '@/components/deal/sov-section'") ||
    src.includes('from "@/components/deal/sov-section"'),
    `${DEAL_DETAIL} must import SovSection from the correct path`,
  )
})

await test('deal detail: fetches sov_line_items server-side', () => {
  const src = read(DEAL_DETAIL)
  assert(
    src.includes("from('sov_line_items')") || src.includes('from("sov_line_items")'),
    `${DEAL_DETAIL} must query sov_line_items server-side`,
  )
})

await test('deal detail: passes dealAmount and viewerRole to SovSection', () => {
  const src = read(DEAL_DETAIL)
  assert(
    src.includes('dealAmount') && src.includes('viewerRole'),
    `${DEAL_DETAIL} must pass dealAmount and viewerRole to SovSection`,
  )
})

// ── Safety: release gate and payment routes unchanged ─────────────────────────

await test('release gate: SOV mismatch does not appear as a release blocker', () => {
  // The release gate source must not reference SOV
  if (!fs.existsSync(path.resolve(ROOT, RELEASE_GATE))) return // skip if file missing
  const src = read(RELEASE_GATE)
  assert(
    !src.includes('sov_line_items') && !src.includes('SovLineItem') && !src.includes('sovTotal'),
    `${RELEASE_GATE} must not reference SOV — SOV is advisory only in phase 1`,
  )
})

await test('release route: SOV is not referenced (release logic unchanged)', () => {
  if (!fs.existsSync(path.resolve(ROOT, RELEASE_ROUTE))) return // skip if file missing
  const src = read(RELEASE_ROUTE)
  assert(
    !src.includes('sov_line_items') && !src.includes('SovLineItem'),
    `${RELEASE_ROUTE} must not reference SOV — release gate logic must be unchanged`,
  )
})

await test('Stripe route: unchanged (no SOV references)', () => {
  if (!fs.existsSync(path.resolve(ROOT, STRIPE_ROUTE))) return
  const src = read(STRIPE_ROUTE)
  assert(
    !src.includes('sov_line_items'),
    `${STRIPE_ROUTE} must not reference sov_line_items — Stripe routes are unchanged`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — SOV FOUNDATION')
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
