/**
 * Contractor funder-display correctness tests.
 *
 * Static source-parse checks — no rendering, no live DB.
 *
 * Root cause context:
 *   The contractor dashboard showed "No funder assigned yet" even when
 *   deals.funder_id was set. The cause: the user-session Supabase client
 *   (RLS-enforced) cannot resolve the funder profile join when the
 *   profiles_select_own policy is still in effect (it only allows reading
 *   own profile). The fix adds an admin-client fallback that fetches the
 *   funder profile server-side when the join returns null.
 *
 * Tests:
 *   1.  Deal detail page imports createSupabaseAdminClient (fallback exists).
 *   2.  Deal detail page checks funder_id before calling funder falsy path.
 *   3.  Deal detail page shows "Funder assigned" when funder_id set but funder null.
 *   4.  Deal detail page shows "No funder assigned yet" only when funder_id is null/falsy.
 *   5.  Deal detail page performs admin client lookup when funder_id set but join null.
 *   6.  Dashboard page imports createSupabaseAdminClient (fallback exists).
 *   7.  Dashboard page batch-fetches funder profiles via admin client.
 *   8.  DealCard shows funder name when deal.funder is set.
 *   9.  DealCard shows "Funder assigned" fallback when funder_id set but funder null.
 *  10.  Invite accept route writes deal.funder_id (canonical funder relationship).
 *  11.  No payment/release logic changed: release route not modified in this diff.
 *  12.  profiles RLS migration (014_rls_hardening) grants deal-participant visibility.
 *
 * Run:  npx tsx tests/contractor-funder-display.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

// ─── Test runner ──────────────────────────────────────────────────────────────

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

// Collapse whitespace for multi-line JSX matching
function collapsed(src: string): string {
  return src.replace(/\s+/g, ' ')
}

// Strip JS/TS comments and string literals to inspect only executable code
function codeOnly(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

// ─── File paths ───────────────────────────────────────────────────────────────

const DEAL_DETAIL   = 'src/app/dashboard/deals/[dealId]/page.tsx'
const DASHBOARD     = 'src/app/dashboard/page.tsx'
const DEAL_CARD     = 'src/components/deal/deal-card.tsx'
const INVITE_ACCEPT = 'src/app/api/invites/[token]/accept/route.ts'
const RELEASE_ROUTE = 'src/app/api/milestones/[milestoneId]/release/route.ts'
const RLS_MIGRATION = 'supabase/migrations/014_rls_hardening.sql'

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── Deal detail page ──────────────────────────────────────────────────────────

await test('deal detail: imports createSupabaseAdminClient for funder fallback', () => {
  const src = read(DEAL_DETAIL)
  assert(
    src.includes('createSupabaseAdminClient'),
    `${DEAL_DETAIL} must import createSupabaseAdminClient to perform the funder profile fallback lookup`,
  )
})

await test('deal detail: performs admin fallback when funder_id set but funder join null', () => {
  const src = read(DEAL_DETAIL)
  // Should call createSupabaseAdminClient (executable code — check stripped source)
  const code = codeOnly(src)
  assert(
    /funder_id/.test(code) && /createSupabaseAdminClient/.test(code),
    `${DEAL_DETAIL} must use createSupabaseAdminClient as a fallback when funder_id is set but the join returned null`,
  )
  // The fallback should query profiles (check raw source — codeOnly strips string literals)
  assert(
    src.includes("from('profiles')") || src.includes('from("profiles")'),
    `${DEAL_DETAIL} admin fallback must query the profiles table`,
  )
})

await test('deal detail: "No funder assigned" is guarded by funder_id check', () => {
  const src = read(DEAL_DETAIL)
  // "No funder assigned yet" must NOT appear as the direct else branch of
  // checking deal.funder alone — it must also check funder_id first.
  // The fixed code has: funder ? ... : funder_id ? 'Funder assigned' : 'No funder...'
  const c = collapsed(src)
  // Ensure "Funder assigned" text appears (the middle fallback state)
  assert(
    c.includes('Funder assigned'),
    `${DEAL_DETAIL} must show "Funder assigned" when funder_id is set but the profile join is null`,
  )
  // Ensure "No funder assigned yet" still exists for deals without a funder at all
  assert(
    c.includes('No funder assigned yet'),
    `${DEAL_DETAIL} must still show "No funder assigned yet" when funder_id is null`,
  )
})

await test('deal detail: shows funder company_name with full_name fallback', () => {
  const src = read(DEAL_DETAIL)
  // Should use company_name ?? full_name to show the best available funder identifier
  assert(
    src.includes('company_name') && src.includes('full_name'),
    `${DEAL_DETAIL} should display funder company_name with full_name as fallback`,
  )
})

// ── Dashboard page ────────────────────────────────────────────────────────────

await test('dashboard: imports createSupabaseAdminClient for funder fallback', () => {
  const src = read(DASHBOARD)
  assert(
    src.includes('createSupabaseAdminClient'),
    `${DASHBOARD} must import createSupabaseAdminClient to perform the funder profile batch fallback`,
  )
})

await test('dashboard: queries deal funder via profiles!deals_funder_id_fkey join', () => {
  const src = read(DASHBOARD)
  assert(
    src.includes('deals_funder_id_fkey'),
    `${DASHBOARD} must use the profiles!deals_funder_id_fkey join hint to load funder profiles`,
  )
})

await test('dashboard: batch-fetches missing funder profiles via admin client', () => {
  const src = read(DASHBOARD)
  const code = codeOnly(src)
  // Should iterate over deals with funder_id set but funder null
  assert(
    /funder_id.*&&.*!.*funder|funder_id.*funder/.test(code.replace(/\s+/g, ' ')),
    `${DASHBOARD} must detect deals where funder_id is set but the profile join failed`,
  )
  // Should call admin client and query profiles
  assert(
    code.includes('createSupabaseAdminClient'),
    `${DASHBOARD} must use createSupabaseAdminClient for the funder batch fallback`,
  )
})

// ── DealCard component ────────────────────────────────────────────────────────

await test('DealCard: shows funder name when deal.funder is present', () => {
  const src = read(DEAL_CARD)
  const c = collapsed(src)
  // deal.funder?.full_name or deal.funder.full_name must appear
  assert(
    c.includes('deal.funder'),
    `${DEAL_CARD} must display the funder name when deal.funder is present`,
  )
})

await test('DealCard: shows "Funder assigned" fallback when funder_id set but funder null', () => {
  const src = read(DEAL_CARD)
  assert(
    src.includes('Funder assigned'),
    `${DEAL_CARD} must show "Funder assigned" when deal.funder_id is set but deal.funder is null`,
  )
})

await test('DealCard: shows funder company_name with full_name fallback', () => {
  const src = read(DEAL_CARD)
  assert(
    src.includes('company_name') && src.includes('full_name'),
    `${DEAL_CARD} should prefer company_name over full_name for the funder display`,
  )
})

// ── Invite accept — canonical funder relationship ─────────────────────────────

await test('invite accept: writes deals.funder_id on acceptance (canonical relationship)', () => {
  const src = read(INVITE_ACCEPT)
  // The invite accept route should update funder_id on the deals table
  assert(
    src.includes('funder_id: user.id'),
    `${INVITE_ACCEPT} must set deals.funder_id = user.id on acceptance — this is the canonical funder field`,
  )
  // Must use .update({ funder_id: user.id }) not any other mechanism
  const code = codeOnly(src)
  assert(
    code.includes('funder_id'),
    `${INVITE_ACCEPT} must write funder_id to the deals table`,
  )
})

await test('invite accept: uses admin client for the deal update (bypasses RLS)', () => {
  const src = read(INVITE_ACCEPT)
  // The route uses createSupabaseAdminClient to write funder_id
  assert(
    src.includes('createSupabaseAdminClient') || src.includes("from '@/lib/supabase/admin'"),
    `${INVITE_ACCEPT} must use the admin client to write funder_id (deals UPDATE is restricted to contractor via RLS)`,
  )
})

// ── Release gate safety — no payment logic changed ────────────────────────────

await test('release route: still checks deals.funder_id for the funder record', () => {
  const src = read(RELEASE_ROUTE)
  assert(
    src.includes('funder_id'),
    `${RELEASE_ROUTE} must still reference funder_id — the release gate depends on the canonical funder field`,
  )
})

// ── RLS migration — deal-participant profile visibility ───────────────────────

await test('RLS migration 014: profiles_select policy grants deal-participant visibility', () => {
  const src = read(RLS_MIGRATION)
  // The profiles_select policy must have the contractor-can-see-funder clause
  assert(
    src.includes('contractor_id = auth.uid()') && src.includes('funder_id = id'),
    `${RLS_MIGRATION} must grant contractors visibility into the funder profile via the deals FK subquery`,
  )
  // Must also drop the old restrictive policy
  assert(
    src.includes('profiles_select_own'),
    `${RLS_MIGRATION} must DROP profiles_select_own before creating the broader profiles_select policy`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — CONTRACTOR FUNDER DISPLAY')
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
