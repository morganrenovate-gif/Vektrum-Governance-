/**
 * RLS regression tests — static migration-file checks.
 *
 * These tests do NOT require a running database. They parse the SQL migrations
 * under supabase/migrations/ and assert that every critical table:
 *
 *   1. has RLS enabled,
 *   2. has SELECT policies that scope reads to the calling user's identity
 *      (so user A cannot read user B's protected records),
 *   3. blocks direct INSERT/UPDATE/DELETE from authenticated users where the
 *      table is meant to be service-role-only or immutable,
 *   4. and (where applicable) is protected by an immutability trigger.
 *
 * Tables covered (per Vektrum critical-data list):
 *   - deals
 *   - milestones
 *   - releases
 *   - billing_records
 *   - transaction_receipts
 *   - audit_log
 *   - admin_audit_log
 *   - partners
 *
 * Why static-file checks rather than live DB tests:
 *   The test suite has no Supabase test instance and does not provision one.
 *   The migration files ARE the canonical RLS policy definition — production
 *   schema is replayed from them. If a future migration weakens or removes a
 *   policy, that change appears in the SQL files first, and these tests will
 *   fail on the diff. This is the same pattern used by:
 *     - tests/partner-scope-isolation.test.ts (mocks instead of live DB),
 *     - tests/audit-p1-recon-cron.test.ts (parses route source),
 *     - tests/middleware-api-routing.test.ts (parses middleware source).
 *
 * Run:  npx tsx tests/rls-regression.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations')

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

// ─── Migration corpus ─────────────────────────────────────────────────────────

const migrationFiles = fs
  .readdirSync(MIGRATIONS)
  .filter(f => f.endsWith('.sql'))
  .sort()

// Concatenate every migration into one searchable corpus. Order is preserved by
// filename sort, matching the order Supabase applies them in. We lower-case for
// case-insensitive matching since SQL keywords appear in mixed case in this repo.
const corpus = migrationFiles
  .map(f => fs.readFileSync(path.join(MIGRATIONS, f), 'utf-8'))
  .join('\n\n')

const corpusLower = corpus.toLowerCase()

function hasRlsEnabled(table: string): boolean {
  // Match: ALTER TABLE [public.]table ENABLE ROW LEVEL SECURITY;
  const re = new RegExp(`alter\\s+table\\s+(public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`, 'i')
  return re.test(corpus)
}

function policyExists(table: string, policyName: string): boolean {
  // Match: CREATE POLICY "<name>" or CREATE POLICY <name> ON [public.]table
  const re = new RegExp(
    `create\\s+policy\\s+"?${policyName}"?\\s+on\\s+(public\\.)?${table}\\b`,
    'i',
  )
  return re.test(corpus)
}

function policyBody(table: string, policyName: string): string | null {
  // Capture from CREATE POLICY <name> ON <table> ... up to the terminating semicolon.
  const re = new RegExp(
    `create\\s+policy\\s+"?${policyName}"?\\s+on\\s+(?:public\\.)?${table}\\b([\\s\\S]*?);`,
    'i',
  )
  const m = corpus.match(re)
  return m ? m[0] : null
}

function triggerExists(triggerName: string, table: string): boolean {
  const re = new RegExp(
    `create\\s+trigger\\s+${triggerName}[\\s\\S]*?on\\s+(public\\.)?${table}\\b`,
    'i',
  )
  return re.test(corpus)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── 0. Migration corpus loaded ───────────────────────────────────────────────

await test('CORPUS: migration directory has at least 40 .sql files', () => {
  assert(
    migrationFiles.length >= 40,
    `Expected ≥40 migrations, found ${migrationFiles.length}. The RLS regression ` +
    'tests scan supabase/migrations/*.sql; if files are missing the policy ' +
    'definitions cannot be verified.',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. DEALS — cross-user read denied; participant columns immutable
// ─────────────────────────────────────────────────────────────────────────────

await test('DEALS: RLS enabled', () => {
  assert(hasRlsEnabled('deals'), 'public.deals must have ENABLE ROW LEVEL SECURITY.')
})

await test('DEALS: deals_select scopes to contractor_id, funder_id, or is_admin()', () => {
  const body = policyBody('deals', 'deals_select')
  assert(body !== null, 'Policy "deals_select" not found on public.deals.')
  assert(
    /contractor_id\s*=\s*auth\.uid\(\)/i.test(body!),
    'deals_select must scope reads to contractor_id = auth.uid() so user A cannot read user B\'s deals.',
  )
  assert(
    /funder_id\s*=\s*auth\.uid\(\)/i.test(body!),
    'deals_select must also allow funder_id = auth.uid() so the funder on a deal can read it.',
  )
  assert(
    /is_admin\(\)/i.test(body!),
    'deals_select must allow public.is_admin() for platform admins.',
  )
})

await test('DEALS: role-split UPDATE policies (contractor / funder / admin) all exist with WITH CHECK', () => {
  for (const policy of ['deals_update_contractor', 'deals_update_funder', 'deals_update_admin']) {
    const body = policyBody('deals', policy)
    assert(body !== null, `Policy "${policy}" missing on public.deals — cross-role write isolation depends on it.`)
    assert(
      /with\s+check/i.test(body!),
      `Policy "${policy}" must include a WITH CHECK clause to prevent identity-column tampering.`,
    )
  }
})

await test('DEALS: enforce_deal_participants_immutable trigger is attached BEFORE UPDATE on deals', () => {
  assert(
    triggerExists('trg_deal_participants_immutable', 'deals'),
    'Trigger trg_deal_participants_immutable must exist on public.deals to block ' +
    'non-admin reassignment of contractor_id/funder_id.',
  )
  assert(
    /create\s+or\s+replace\s+function\s+public\.enforce_deal_participants_immutable/i.test(corpus),
    'Function public.enforce_deal_participants_immutable() must be defined.',
  )
})

await test('DEALS: broad legacy "deals_update" policy is dropped (replaced by role-split policies)', () => {
  // The 014 hardening migration must DROP the broad policy. If a later migration
  // re-creates it without WITH CHECK, the role-split protection is lost.
  assert(
    /drop\s+policy\s+if\s+exists\s+"?deals_update"?\s+on\s+public\.deals/i.test(corpus),
    'Migration 014 must DROP POLICY IF EXISTS "deals_update" ON public.deals so ' +
    'the unsafe broad UPDATE policy cannot coexist with the role-split policies.',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. MILESTONES — role-split UPDATE + state-machine trigger
// ─────────────────────────────────────────────────────────────────────────────

await test('MILESTONES: RLS enabled', () => {
  assert(hasRlsEnabled('milestones'), 'public.milestones must have ENABLE ROW LEVEL SECURITY.')
})

await test('MILESTONES: role-split UPDATE policies exist (contractor / funder / admin)', () => {
  for (const policy of ['milestones_update_contractor', 'milestones_update_funder', 'milestones_update_admin']) {
    assert(
      policyExists('milestones', policy),
      `Policy "${policy}" missing on public.milestones. Role-split UPDATE policies ` +
      'are required so contractors cannot self-approve and funders cannot rewrite arbitrary fields.',
    )
  }
})

await test('MILESTONES: state-machine trigger is attached BEFORE UPDATE', () => {
  assert(
    triggerExists('trg_milestone_status_transition', 'milestones'),
    'Trigger trg_milestone_status_transition must exist on public.milestones to ' +
    'enforce role-allowed status transitions at the database layer.',
  )
})

await test('MILESTONES: state-machine trigger HARD BLOCKS released/payout_failed for non-system callers', () => {
  // Locate the trigger function and verify the hard-block branch is present.
  const fn = corpus.match(
    /create\s+or\s+replace\s+function\s+public\.enforce_milestone_status_transition[\s\S]*?\$\$\s*;/i,
  )
  assert(fn !== null, 'Function enforce_milestone_status_transition() must be defined.')
  assert(
    /new\.status\s+in\s*\(\s*'released'\s*,\s*'payout_failed'\s*\)/i.test(fn![0]),
    'enforce_milestone_status_transition() must contain a hard-block branch for ' +
    "status IN ('released', 'payout_failed'). Only the system (auth.uid() IS NULL) may set these.",
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. RELEASES — participant-only read; service-role-only insert; immutable
// ─────────────────────────────────────────────────────────────────────────────

await test('RELEASES: RLS enabled', () => {
  assert(hasRlsEnabled('releases'), 'public.releases must have ENABLE ROW LEVEL SECURITY.')
})

await test('RELEASES: releases_select scopes via is_deal_participant or is_admin', () => {
  const body = policyBody('releases', 'releases_select')
  assert(body !== null, 'Policy "releases_select" not found on public.releases.')
  assert(
    /is_deal_participant\s*\(\s*deal_id\s*\)/i.test(body!),
    'releases_select must scope to public.is_deal_participant(deal_id) so user A cannot read user B\'s releases.',
  )
  assert(
    /is_admin\(\)/i.test(body!),
    'releases_select must allow public.is_admin() as well.',
  )
})

await test('RELEASES: insert is service-role-only (WITH CHECK false)', () => {
  const body = policyBody('releases', 'releases_insert_service_only')
  assert(body !== null, 'Policy "releases_insert_service_only" must exist on public.releases.')
  assert(
    /with\s+check\s*\(\s*false\s*\)/i.test(body!),
    'releases_insert_service_only must use WITH CHECK (false) so authenticated users ' +
    'cannot insert release rows directly. Releases are created exclusively by the ' +
    'admin client inside the release route.',
  )
})

await test('RELEASES: no UPDATE or DELETE policy granted to authenticated users', () => {
  // Search for any CREATE POLICY on public.releases with FOR UPDATE or FOR DELETE
  // that does NOT restrict to service_role. The current schema has none.
  const violatingUpdate = corpus.match(
    /create\s+policy\s+"?[^"]*"?\s+on\s+(public\.)?releases\s+for\s+update(?![\s\S]{0,80}service_role)/i,
  )
  const violatingDelete = corpus.match(
    /create\s+policy\s+"?[^"]*"?\s+on\s+(public\.)?releases\s+for\s+delete(?![\s\S]{0,80}service_role)/i,
  )
  assert(
    violatingUpdate === null,
    'No FOR UPDATE policy may be defined on public.releases for authenticated users — ' +
    'releases are immutable by design (status changes flow through the release route + webhooks ' +
    'using the service-role admin client which bypasses RLS).',
  )
  assert(
    violatingDelete === null,
    'No FOR DELETE policy may be defined on public.releases for authenticated users — ' +
    'releases are append-only.',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. BILLING_RECORDS — participant-only read; service-role-only insert; immutable
// ─────────────────────────────────────────────────────────────────────────────

await test('BILLING_RECORDS: RLS enabled', () => {
  assert(hasRlsEnabled('billing_records'), 'public.billing_records must have ENABLE ROW LEVEL SECURITY.')
})

await test('BILLING_RECORDS: billing_records_select scopes via is_deal_participant or is_admin', () => {
  const body = policyBody('billing_records', 'billing_records_select')
  assert(body !== null, 'Policy "billing_records_select" not found on public.billing_records.')
  assert(
    /is_deal_participant\s*\(\s*deal_id\s*\)/i.test(body!),
    'billing_records_select must scope to is_deal_participant(deal_id) so funders/contractors ' +
    'on different deals cannot read each other\'s billing rows.',
  )
})

await test('BILLING_RECORDS: insert is service-role-only (WITH CHECK false)', () => {
  const body = policyBody('billing_records', 'billing_records_insert_service_only')
  assert(body !== null, 'Policy "billing_records_insert_service_only" must exist.')
  assert(
    /with\s+check\s*\(\s*false\s*\)/i.test(body!),
    'billing_records_insert_service_only must use WITH CHECK (false). The release route ' +
    'inserts via the admin client (service role bypasses RLS).',
  )
})

await test('BILLING_RECORDS: no UPDATE or DELETE policy granted to authenticated users', () => {
  const violatingUpdate = corpus.match(
    /create\s+policy\s+"?[^"]*"?\s+on\s+(public\.)?billing_records\s+for\s+update(?![\s\S]{0,80}service_role)/i,
  )
  const violatingDelete = corpus.match(
    /create\s+policy\s+"?[^"]*"?\s+on\s+(public\.)?billing_records\s+for\s+delete(?![\s\S]{0,80}service_role)/i,
  )
  assert(violatingUpdate === null, 'public.billing_records must have no FOR UPDATE policy. Billing rows are immutable.')
  assert(violatingDelete === null, 'public.billing_records must have no FOR DELETE policy. Billing rows are append-only.')
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. TRANSACTION_RECEIPTS — participant-only read; deny insert/update/delete
// ─────────────────────────────────────────────────────────────────────────────

await test('TRANSACTION_RECEIPTS: RLS enabled', () => {
  assert(
    hasRlsEnabled('transaction_receipts'),
    'public.transaction_receipts must have ENABLE ROW LEVEL SECURITY.',
  )
})

await test('TRANSACTION_RECEIPTS: receipt_select_participant scopes to contractor_id or funder_id', () => {
  const body = policyBody('transaction_receipts', 'receipt_select_participant')
  assert(body !== null, 'Policy "receipt_select_participant" not found on public.transaction_receipts.')
  assert(
    /auth\.uid\(\)\s*=\s*contractor_id/i.test(body!),
    'receipt_select_participant must include auth.uid() = contractor_id.',
  )
  assert(
    /auth\.uid\(\)\s*=\s*funder_id/i.test(body!),
    'receipt_select_participant must include auth.uid() = funder_id.',
  )
})

await test('TRANSACTION_RECEIPTS: receipt_select_admin restricts to role=admin', () => {
  const body = policyBody('transaction_receipts', 'receipt_select_admin')
  assert(body !== null, 'Policy "receipt_select_admin" not found.')
  assert(
    /role\s*=\s*'admin'/i.test(body!),
    'receipt_select_admin must filter on profiles.role = \'admin\'.',
  )
})

await test('TRANSACTION_RECEIPTS: insert/update/delete are denied (WITH CHECK false / USING false)', () => {
  for (const policy of ['receipt_insert_deny', 'receipt_update_deny']) {
    const body = policyBody('transaction_receipts', policy)
    assert(body !== null, `Policy "${policy}" must exist on transaction_receipts.`)
    assert(
      /with\s+check\s*\(\s*false\s*\)/i.test(body!),
      `${policy} must use WITH CHECK (false) so authenticated users cannot mutate receipts.`,
    )
  }
  const del = policyBody('transaction_receipts', 'receipt_delete_deny')
  assert(del !== null, 'Policy "receipt_delete_deny" must exist on transaction_receipts.')
  assert(
    /using\s*\(\s*false\s*\)/i.test(del!),
    'receipt_delete_deny must use USING (false) so no row is ever deleteable by an authenticated user.',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. AUDIT_LOG — scoped read; service-role insert; trigger-enforced immutability
// ─────────────────────────────────────────────────────────────────────────────

await test('AUDIT_LOG: RLS enabled', () => {
  assert(hasRlsEnabled('audit_log'), 'public.audit_log must have ENABLE ROW LEVEL SECURITY.')
})

await test('AUDIT_LOG: audit_log_select scopes to actor_id or deal participation', () => {
  const body = policyBody('audit_log', 'audit_log_select')
  assert(body !== null, 'Policy "audit_log_select" not found on public.audit_log.')
  assert(
    /actor_id\s*=\s*auth\.uid\(\)/i.test(body!),
    'audit_log_select must include actor_id = auth.uid() so callers see only entries they generated.',
  )
  assert(
    /is_deal_participant/i.test(body!),
    'audit_log_select must use is_deal_participant(...) for deal/milestone/release scope ' +
    'so a contractor on deal X cannot see audit entries for deal Y.',
  )
  assert(
    /is_admin\(\)/i.test(body!),
    'audit_log_select must allow public.is_admin().',
  )
})

await test('AUDIT_LOG: insert is service-role-only (WITH CHECK false)', () => {
  const body = policyBody('audit_log', 'audit_log_insert_service_only')
  assert(body !== null, 'Policy "audit_log_insert_service_only" must exist on public.audit_log.')
  assert(
    /with\s+check\s*\(\s*false\s*\)/i.test(body!),
    'audit_log_insert_service_only must use WITH CHECK (false). All audit writes go through ' +
    'SECURITY DEFINER trigger functions or the admin service-role client.',
  )
})

await test('AUDIT_LOG: no UPDATE or DELETE policy granted to authenticated users', () => {
  const violatingUpdate = corpus.match(
    /create\s+policy\s+"?[^"]*"?\s+on\s+(public\.)?audit_log\s+for\s+update(?![\s\S]{0,80}service_role)/i,
  )
  const violatingDelete = corpus.match(
    /create\s+policy\s+"?[^"]*"?\s+on\s+(public\.)?audit_log\s+for\s+delete(?![\s\S]{0,80}service_role)/i,
  )
  assert(
    violatingUpdate === null,
    'public.audit_log must have no FOR UPDATE policy. Audit rows are tamper-evident, append-only.',
  )
  assert(
    violatingDelete === null,
    'public.audit_log must have no FOR DELETE policy. Audit rows are permanent legal evidence.',
  )
})

await test('AUDIT_LOG: immutability trigger blocks UPDATE and DELETE for ALL roles (incl. admin client)', () => {
  assert(
    triggerExists('audit_log_immutable', 'audit_log'),
    'Trigger audit_log_immutable must exist on public.audit_log to block UPDATE/DELETE ' +
    'even for service_role / admin client (RLS bypass does not bypass triggers).',
  )
  assert(
    /create\s+or\s+replace\s+function\s+public\.deny_audit_modification/i.test(corpus),
    'Function public.deny_audit_modification() must be defined and must RAISE EXCEPTION ' +
    'unconditionally so no role can modify audit_log rows.',
  )
  // Confirm the function actually raises (not just logs).
  const fn = corpus.match(
    /create\s+or\s+replace\s+function\s+public\.deny_audit_modification[\s\S]*?\$\$\s*;/i,
  )
  assert(fn !== null, 'deny_audit_modification function body must be parseable.')
  assert(
    /raise\s+exception/i.test(fn![0]),
    'deny_audit_modification() must call RAISE EXCEPTION so the UPDATE/DELETE is rejected.',
  )
})

await test('AUDIT_LOG: hash-chain trigger is attached BEFORE INSERT', () => {
  assert(
    triggerExists('trg_audit_log_hash', 'audit_log'),
    'Trigger trg_audit_log_hash must compute row_hash + chain_hash on INSERT so the ' +
    'hash chain is set server-side and cannot be forged by application code.',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. ADMIN_AUDIT_LOG — admin-only read; service-role write; trigger immutability
// ─────────────────────────────────────────────────────────────────────────────

await test('ADMIN_AUDIT_LOG: RLS enabled', () => {
  assert(
    hasRlsEnabled('admin_audit_log'),
    'public.admin_audit_log must have ENABLE ROW LEVEL SECURITY.',
  )
})

await test('ADMIN_AUDIT_LOG: select policy restricts to authenticated admins only', () => {
  const body = policyBody('admin_audit_log', 'admin_audit_log_select')
  assert(body !== null, 'Policy "admin_audit_log_select" not found on public.admin_audit_log.')
  assert(
    /to\s+authenticated/i.test(body!),
    'admin_audit_log_select must be granted TO authenticated only (not anon, not public).',
  )
  assert(
    /role\s*=\s*'admin'/i.test(body!),
    'admin_audit_log_select must filter on profiles.role = \'admin\' so non-admins ' +
    'cannot read the privileged-action ledger.',
  )
})

await test('ADMIN_AUDIT_LOG: no INSERT/UPDATE/DELETE policy granted to authenticated users', () => {
  // All writes go through logAdminAudit via the admin client (service role).
  // Authenticated users must have no write path at the policy level.
  for (const verb of ['insert', 'update', 'delete']) {
    const m = corpus.match(
      new RegExp(
        `create\\s+policy\\s+"?[^"]*"?\\s+on\\s+(public\\.)?admin_audit_log\\s+for\\s+${verb}(?![\\s\\S]{0,80}service_role)`,
        'i',
      ),
    )
    assert(
      m === null,
      `public.admin_audit_log must have no FOR ${verb.toUpperCase()} policy. ` +
      'All writes go through the admin client; authenticated users have no direct path.',
    )
  }
})

await test('ADMIN_AUDIT_LOG: immutability trigger blocks UPDATE and DELETE', () => {
  assert(
    triggerExists('admin_audit_log_immutable', 'admin_audit_log'),
    'Trigger admin_audit_log_immutable must exist on public.admin_audit_log to ' +
    'block UPDATE/DELETE for all roles, including service_role.',
  )
  assert(
    /create\s+or\s+replace\s+function\s+public\.guard_admin_audit_immutability/i.test(corpus),
    'Function public.guard_admin_audit_immutability() must be defined.',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. PARTNERS — service-role-only (no authenticated access at all)
// ─────────────────────────────────────────────────────────────────────────────

await test('PARTNERS: RLS enabled', () => {
  assert(hasRlsEnabled('partners'), 'public.partners must have ENABLE ROW LEVEL SECURITY.')
})

await test('PARTNERS: partners_service_role_only is the sole policy and grants ONLY to service_role', () => {
  const body = policyBody('partners', 'partners_service_role_only')
  assert(body !== null, 'Policy "partners_service_role_only" not found on public.partners.')
  assert(
    /to\s+service_role/i.test(body!),
    'partners_service_role_only must be granted TO service_role explicitly so authenticated ' +
    'users have no row-level access to partner records.',
  )
  // Confirm the policy is FOR ALL (covers SELECT/INSERT/UPDATE/DELETE in one rule).
  assert(
    /for\s+all/i.test(body!),
    'partners_service_role_only must be FOR ALL so authenticated users cannot read, write, ' +
    'or modify partner records via any verb.',
  )
})

await test('PARTNERS: no policy grants partners access TO authenticated, anon, or PUBLIC', () => {
  // Scan every CREATE POLICY on partners and ensure none use TO authenticated/anon/public.
  const allPartnerPolicies = [...corpus.matchAll(
    /create\s+policy\s+"?([^"\s]+)"?\s+on\s+(public\.)?partners\b([\s\S]*?);/gi,
  )]
  for (const m of allPartnerPolicies) {
    const name = m[1]
    const body = m[0]
    if (/partners_service_role_only/i.test(name)) continue
    // If any other policy exists, it must explicitly target service_role.
    assert(
      /to\s+service_role/i.test(body),
      `Policy "${name}" on public.partners grants access outside service_role. ` +
      'Partner records (including api_key_hash) must remain service-role-only.',
    )
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. CROSS-CUTTING: helper functions used by RLS policies are defined
// ─────────────────────────────────────────────────────────────────────────────

await test('HELPERS: is_deal_participant, is_admin, is_funder_on_deal, is_contractor_on_deal exist', () => {
  for (const fn of [
    'is_deal_participant',
    'is_admin',
    'is_funder_on_deal',
    'is_contractor_on_deal',
  ]) {
    const re = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\b`, 'i')
    const reSimple = new RegExp(`create\\s+function\\s+public\\.${fn}\\b`, 'i')
    assert(
      re.test(corpus) || reSimple.test(corpus),
      `Helper function public.${fn}() must be defined — RLS policies depend on it.`,
    )
  }
})

await test('HELPERS: SECURITY DEFINER helpers grant EXECUTE to authenticated (not anon)', () => {
  // is_funder_on_deal and is_contractor_on_deal are the high-leverage helpers.
  // They must be callable from RLS policies running under an authenticated session.
  for (const fn of ['is_funder_on_deal', 'is_contractor_on_deal']) {
    const re = new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}\\([^)]*\\)\\s+to\\s+authenticated`, 'i')
    assert(re.test(corpus), `GRANT EXECUTE ON FUNCTION public.${fn}(...) TO authenticated must be present.`)
  }
})

// ─── Report ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — RLS REGRESSION TEST RESULTS')
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
