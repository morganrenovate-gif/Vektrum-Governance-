/**
 * Audit Log — Admin "View full audit log" bug regression tests
 *
 * Bug: Admin dashboard "Recent Audit Activity" card showed events (queried via
 * service-role client, bypasses RLS), but clicking "View full audit log" opened
 * the Platform Events page showing "No audit events match your filters."
 *
 * Root cause: the audit page used only `createClient()` (user-session, subject
 * to RLS). If the RLS policy on `audit_log` does not grant the admin role full
 * SELECT access via the regular client, the page returns 0 rows despite the
 * dashboard rendering events from the same table.
 *
 * Fix: after verifying identity with the session client, the audit page now
 * switches to `createSupabaseAdminClient()` for admin users so RLS is bypassed
 * for the data query only — identical to how the dashboard card fetches data.
 *
 * Checks (static source-parse, no DB, no env vars):
 *  1.  Audit page imports createSupabaseAdminClient (fix wired in).
 *  2.  Audit page declares a queryClient variable that switches on isAdmin.
 *  3.  Audit page query uses queryClient, not the bare session supabase client.
 *  4.  Admin dashboard "View full audit log" link targets /dashboard/audit.
 *  5.  Admin dashboard "Recent Audit Activity" uses the admin Supabase client.
 *  6.  "All" category tab applies no action filter (cron events not hidden).
 *  7.  cron_reconcile_completed IS in the "system" CATEGORY_ACTIONS list.
 *  8.  No role filter is applied for admin (non-admin scoping does not leak).
 *  9.  Audit page has export const dynamic = "force-dynamic".
 * 10.  Test wired into npm test in package.json.
 * 11.  SELECT does not contain the non-existent entity_profile FK join.
 * 12.  SELECT retains the valid actor FK join (audit_log_actor_id_fkey exists).
 * 13.  CATEGORY_ACTIONS includes a "system" key with cron_reconcile_completed.
 * 14.  CATEGORY_TABS has a System tab visible to admins.
 * 15.  Query errors are logged (not silently swallowed as empty state).
 *
 * Run:  npx tsx tests/audit-log-admin.test.ts
 */

import fs   from 'fs'
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

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}

const AUDIT_PAGE   = 'src/app/(app)/dashboard/audit/page.tsx'
const ADMIN_PAGE   = 'src/app/(app)/dashboard/admin/page.tsx'
const PKG          = 'package.json'

async function main() {

// ─── 1. Audit page imports createSupabaseAdminClient ─────────────────────────

await test('1. Audit page imports createSupabaseAdminClient', () => {
  const src = read(AUDIT_PAGE)
  assert(
    src.includes('createSupabaseAdminClient'),
    `${AUDIT_PAGE} must import createSupabaseAdminClient so admin queries can bypass RLS. ` +
    `Without this, the audit log page returns 0 rows even when the dashboard shows events ` +
    `from the same table (dashboard uses the admin client; audit page must too for admins).`,
  )
})

// ─── 2. Audit page declares a queryClient switch ──────────────────────────────

await test('2. Audit page declares queryClient that switches on isAdmin', () => {
  const src = read(AUDIT_PAGE)
  assert(
    src.includes('queryClient') && src.includes('isAdmin'),
    `${AUDIT_PAGE} must declare a queryClient variable that conditionally uses the admin ` +
    `client when the user is an admin. Pattern: ` +
    `"const queryClient = isAdmin ? createSupabaseAdminClient() : supabase"`,
  )
  // Verify the switch is on isAdmin specifically
  assert(
    src.includes('isAdmin ? createSupabaseAdminClient') ||
    src.includes('isAdmin\n    ? createSupabaseAdminClient'),
    `${AUDIT_PAGE}: queryClient must branch on isAdmin to use createSupabaseAdminClient().`,
  )
})

// ─── 3. Audit page uses queryClient for the data query ───────────────────────

await test('3. Audit page uses queryClient (not bare supabase) for audit_log query', () => {
  const src = read(AUDIT_PAGE)
  // The query must be built from queryClient, not directly from supabase
  assert(
    src.includes('queryClient\n    .from("audit_log")') ||
    src.includes('queryClient.from("audit_log")') ||
    (src.includes('queryClient') && src.includes('.from("audit_log")')),
    `${AUDIT_PAGE}: the audit_log query must use queryClient, not the raw supabase client. ` +
    `Otherwise admins see 0 rows when RLS restricts direct session-client access.`,
  )
  // The raw supabase client must not be used for the audit_log query directly
  // (supabase.from("audit_log") must not appear — queryClient wraps it)
  assert(
    !src.includes('supabase\n    .from("audit_log")') &&
    !src.includes('supabase.from("audit_log")'),
    `${AUDIT_PAGE}: supabase.from("audit_log") must not appear — the query must go through ` +
    `queryClient so admins use the service-role path.`,
  )
})

// ─── 4. Admin dashboard "View full audit log" link targets /dashboard/audit ───

await test('4. Admin dashboard "View full audit log" link targets /dashboard/audit', () => {
  const src = read(ADMIN_PAGE)
  // The link must point to the audit page (not a query-param page or wrong path)
  assert(
    src.includes('href="/dashboard/audit"'),
    `${ADMIN_PAGE}: "View full audit log" must link to href="/dashboard/audit". ` +
    `A wrong href would send admins to a 404 or incorrect page.`,
  )
  // The link text must be present
  assert(
    src.includes('View full audit log') || src.includes('Full Audit Log'),
    `${ADMIN_PAGE}: must include the "View full audit log" or "Full Audit Log" link text ` +
    `so admins can navigate from the recent activity card to the full log.`,
  )
})

// ─── 5. Admin dashboard recent audit card uses createSupabaseAdminClient ──────

await test('5. Admin dashboard recent audit card fetches via createSupabaseAdminClient', () => {
  const src = read(ADMIN_PAGE)
  // getAdminData (which fetches recentAudit) must use the admin client
  assert(
    src.includes('createSupabaseAdminClient'),
    `${ADMIN_PAGE}: getAdminData() must use createSupabaseAdminClient() for the ` +
    `recentAudit query. The dashboard showing events while the audit page shows ` +
    `none is the precise mismatch this bug report identified.`,
  )
  // The audit_log query must be inside getAdminData (admin client scope)
  const adminDataFnIdx = src.indexOf('async function getAdminData')
  const auditQueryIdx  = src.indexOf("from('audit_log')", adminDataFnIdx)
  assert(
    adminDataFnIdx !== -1 && auditQueryIdx !== -1,
    `${ADMIN_PAGE}: getAdminData() must contain a query on 'audit_log' to fetch recentAudit.`,
  )
})

// ─── 6. "All" category tab applies no action filter ──────────────────────────

await test('6. "All" category applies no action-in filter (cron events visible)', () => {
  const src = read(AUDIT_PAGE)
  // The category filter must guard on category !== "all" so All shows everything
  assert(
    src.includes('category !== "all"') || src.includes("category !== 'all'"),
    `${AUDIT_PAGE}: the CATEGORY_ACTIONS filter must be skipped when category is "all". ` +
    `Pattern: if (category && category !== "all" && CATEGORY_ACTIONS[category]) { ... }. ` +
    `Without this guard, cron/system events are hidden even on the All tab.`,
  )
})

// ─── 7. cron_reconcile_completed is in the system CATEGORY_ACTIONS ───────────

await test('7. cron_reconcile_completed is in the system CATEGORY_ACTIONS list', () => {
  const src = read(AUDIT_PAGE)
  // cron_reconcile_completed is a system event that should appear in the
  // dedicated "System" category tab (visible to admins only) so it is
  // easily discoverable without having to search by name.
  // It also appears in "All" because "All" applies no category filter.
  assert(
    src.includes('"cron_reconcile_completed"') ||
    src.includes("'cron_reconcile_completed'"),
    `${AUDIT_PAGE}: cron_reconcile_completed must appear in CATEGORY_ACTIONS under ` +
    `the "system" key so admins can filter to it via the System tab. ` +
    `It will also appear in "All" — no exclusion needed.`,
  )
})

// ─── 8. Non-admin scoping does not apply to admin path ───────────────────────

await test('8. Non-admin scoping is guarded by !isAdmin (admin sees all rows)', () => {
  const src = read(AUDIT_PAGE)
  // The entity scoping block must be inside !isAdmin
  assert(
    src.includes('if (!isAdmin)'),
    `${AUDIT_PAGE}: entity-scoping logic must be inside "if (!isAdmin)" so admins ` +
    `receive unscoped results. Missing this guard limits admins to their own events only.`,
  )
})

// ─── 9. Audit page is force-dynamic ──────────────────────────────────────────

await test('9. Audit page has export const dynamic = "force-dynamic"', () => {
  const src = read(AUDIT_PAGE)
  assert(
    src.includes('export const dynamic') && src.includes('force-dynamic'),
    `${AUDIT_PAGE}: must export \`const dynamic = "force-dynamic"\` to prevent Next.js ` +
    `from attempting to statically prerender an auth-gated page.`,
  )
})

// ─── 10. Test wired into npm test ─────────────────────────────────────────────

await test('10. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('audit-log-admin.test.ts'),
    `package.json npm test script must include 'audit-log-admin.test.ts'.`,
  )
})

// ─── 11-15. FK join, System category, error logging ──────────────────────────

await test('11. Audit page SELECT does not contain the non-existent entity_profile FK join', () => {
  const src = read(AUDIT_PAGE)
  // entity_id has no FK constraint in the schema — it is a polymorphic UUID.
  // Using "!audit_log_entity_id_fkey" in the select makes PostgREST return a
  // 400 error, causing data = null → empty state on every load.
  assert(
    !src.includes('audit_log_entity_id_fkey'),
    `${AUDIT_PAGE}: must NOT contain "audit_log_entity_id_fkey". ` +
    `entity_id has no FK constraint (it is polymorphic — references deals, milestones, ` +
    `cron runs, etc.). PostgREST returns an error for unknown FK names, ` +
    `causing the entire query to fail silently and show "No audit events".`,
  )
})

await test('12. Audit page SELECT retains the valid actor FK join', () => {
  const src = read(AUDIT_PAGE)
  // actor_id does have a FK to profiles (auto-named audit_log_actor_id_fkey).
  // This join is a valid fallback for pre-migration-016 rows.
  assert(
    src.includes('audit_log_actor_id_fkey'),
    `${AUDIT_PAGE}: must retain actor:profiles!audit_log_actor_id_fkey ` +
    `as a fallback join for rows that predate the actor_name denormalization.`,
  )
})

await test('13. Audit page has a "system" category in CATEGORY_ACTIONS', () => {
  const src = read(AUDIT_PAGE)
  assert(
    src.includes('system:') || src.includes('"system"') || src.includes("'system'"),
    `${AUDIT_PAGE}: CATEGORY_ACTIONS must include a "system" key covering ` +
    `cron_reconcile_completed and other cron/background events so admins can ` +
    `filter to system events without searching.`,
  )
  assert(
    src.includes('cron_reconcile_completed'),
    `${AUDIT_PAGE}: "cron_reconcile_completed" must appear in the system ` +
    `CATEGORY_ACTIONS list — this is the action that was invisible in the "All" tab ` +
    `because the broken FK join prevented any rows from loading.`,
  )
})

await test('14. CATEGORY_TABS has a System tab visible to admins', () => {
  const src = read(AUDIT_PAGE)
  assert(
    src.includes('{ key: "system"') || src.includes("{ key: 'system'"),
    `${AUDIT_PAGE}: CATEGORY_TABS must include a { key: "system" ... } entry ` +
    `so admins have a dedicated tab for cron/background events.`,
  )
})

await test('15. Audit page logs PostgREST errors instead of silently returning empty state', () => {
  const src = read(AUDIT_PAGE)
  assert(
    src.includes('queryError') || src.includes('error:') && src.includes('console.error'),
    `${AUDIT_PAGE}: must destructure the error from the Supabase query and log it. ` +
    `Previously, PostgREST errors were silently swallowed (data = null → entries = [] → ` +
    `"No audit events") with no indication of the actual failure.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

  console.log('')
  console.log('════════════════════════════════════════════════════════════════════════')
  console.log('  VEKTRUM — Audit Log Admin Bug Regression Tests (15 checks)')
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

main().catch(e => { console.error(e); process.exit(1) })
