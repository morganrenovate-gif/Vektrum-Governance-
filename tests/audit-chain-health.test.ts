/**
 * Audit-chain health tests.
 *
 * Two layers, no live DB:
 *
 *   A. PURE-FUNCTION tests on summarizeVerifierRows + sanitizeErrorMessage
 *      from src/lib/engine/audit-chain-health.ts. These cover the success
 *      and broken-chain status paths without touching Supabase or the RPC.
 *
 *   B. STATIC-FILE tests on:
 *      - the migration (RLS policies + immutability)
 *      - the cron route (CRON_SECRET auth, audit-log-only writes)
 *      - the admin route (admin + MFA + dual-write)
 *      - vercel.json (cron is scheduled)
 *      - the runner (no audit_log mutation, no payload exposure)
 *
 * No real audit_log row is mutated. No HTTP request is made. No env required.
 *
 * Run:  npx tsx tests/audit-chain-health.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  summarizeVerifierRows,
  sanitizeErrorMessage,
} from '../src/lib/engine/audit-chain-health'

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

function read(p: string): string { return fs.readFileSync(p, 'utf-8') }

const MIGRATION   = path.join(ROOT, 'supabase/migrations/20260427000000_audit_chain_health.sql')
const RUNNER      = path.join(ROOT, 'src/lib/engine/audit-chain-health.ts')
const CRON_ROUTE  = path.join(ROOT, 'src/app/api/cron/audit-chain-health/route.ts')
const ADMIN_ROUTE = path.join(ROOT, 'src/app/api/admin/audit-chain-health/route.ts')
const BADGE       = path.join(ROOT, 'src/components/admin/AuditChainHealthBadge.tsx')
const ADMIN_PAGE  = path.join(ROOT, 'src/app/dashboard/admin/page.tsx')
const VERCEL_JSON = path.join(ROOT, 'vercel.json')

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── A1. Successful chain → status='healthy' ──────────────────────────────────

await test('SUMMARIZE: empty verifier output → healthy with 0 rows', () => {
  const r = summarizeVerifierRows([])
  assert(r.status === 'healthy', `expected healthy, got ${r.status}`)
  assert(r.rowsChecked === 0,     'rowsChecked must be 0 for empty input.')
  assert(r.rowsInvalid === 0,     'rowsInvalid must be 0 for empty input.')
  assert(r.firstBrokenEventSequence === null, 'No broken row → null event_sequence.')
  assert(r.firstBrokenAuditId === null,       'No broken row → null audit_id.')
})

await test('SUMMARIZE: all rows valid → healthy, no broken pointers', () => {
  const r = summarizeVerifierRows([
    { audit_id: 'a1', event_seq: 1, row_hash_valid: true, chain_hash_valid: true,
      stored_row_hash: 'rh1', computed_row_hash: 'rh1',
      stored_chain_hash: 'ch1', expected_chain_hash: 'ch1' },
    { audit_id: 'a2', event_seq: 2, row_hash_valid: true, chain_hash_valid: true,
      stored_row_hash: 'rh2', computed_row_hash: 'rh2',
      stored_chain_hash: 'ch2', expected_chain_hash: 'ch2' },
  ])
  assert(r.status === 'healthy', 'all-valid rows must summarize as healthy.')
  assert(r.rowsChecked === 2, 'rowsChecked must reflect input length.')
  assert(r.rowsInvalid === 0, 'rowsInvalid must be 0 when nothing failed.')
  assert(r.firstBrokenEventSequence === null, 'No failures → null event_sequence.')
})

// ── A2. Broken chain → status='broken' + first-broken pointers ───────────────

await test('SUMMARIZE: row_hash_valid=false → broken, captures FIRST broken row', () => {
  const r = summarizeVerifierRows([
    { audit_id: 'a1', event_seq: 1, row_hash_valid: true,  chain_hash_valid: true,
      stored_row_hash: 'rh1', computed_row_hash: 'rh1',
      stored_chain_hash: 'ch1', expected_chain_hash: 'ch1' },
    { audit_id: 'a2', event_seq: 2, row_hash_valid: false, chain_hash_valid: true,
      stored_row_hash: 'rh2-stored', computed_row_hash: 'rh2-different',
      stored_chain_hash: 'ch2', expected_chain_hash: 'ch2' },
    { audit_id: 'a3', event_seq: 3, row_hash_valid: false, chain_hash_valid: false,
      stored_row_hash: 'rh3', computed_row_hash: 'rh3-different',
      stored_chain_hash: 'ch3', expected_chain_hash: 'ch3-different' },
  ])
  assert(r.status === 'broken', `expected broken, got ${r.status}`)
  assert(r.rowsChecked === 3, 'rowsChecked must reflect input length.')
  assert(r.rowsInvalid === 2, `expected rowsInvalid=2 (a2 + a3), got ${r.rowsInvalid}`)
  assert(r.firstBrokenEventSequence === 2,
    `firstBrokenEventSequence must be the FIRST broken row's event_seq (2), got ${r.firstBrokenEventSequence}`)
  assert(r.firstBrokenAuditId === 'a2',
    `firstBrokenAuditId must be the FIRST broken row's id (a2), got ${r.firstBrokenAuditId}`)
})

await test('SUMMARIZE: chain_hash_valid=false alone is enough to count as broken', () => {
  const r = summarizeVerifierRows([
    { audit_id: 'a1', event_seq: 1, row_hash_valid: true, chain_hash_valid: false,
      stored_row_hash: 'rh1', computed_row_hash: 'rh1',
      stored_chain_hash: 'ch1-stored', expected_chain_hash: 'ch1-different' },
  ])
  assert(r.status === 'broken', 'chain_hash_valid=false must mark the row invalid.')
  assert(r.rowsInvalid === 1, 'one broken row must increment rowsInvalid.')
})

// ── A3. Error sanitization ───────────────────────────────────────────────────

await test('SANITIZE: multi-line stack trace is reduced to first line + 500-char cap', () => {
  const stack = 'TypeError: cannot read x of undefined\n    at Foo (foo.ts:1:1)\n    at Bar (bar.ts:2:2)'
  const out   = sanitizeErrorMessage(stack)
  assert(!out.includes('\n'), 'Sanitized message must not contain newlines (no stack trace).')
  assert(out === 'TypeError: cannot read x of undefined',
    `expected first-line only. got: ${out}`)
})

await test('SANITIZE: very long single-line error is truncated to 500 chars', () => {
  const longMsg = 'x'.repeat(2000)
  const out = sanitizeErrorMessage(longMsg)
  assert(out.length === 500, `expected length 500, got ${out.length}`)
})

await test('SANITIZE: handles undefined / null without throwing', () => {
  assert(sanitizeErrorMessage(undefined) === '', 'undefined input → empty string.')
  assert(sanitizeErrorMessage(null) === '',      'null input → empty string.')
})

// ── B1. Migration: RLS + immutability ────────────────────────────────────────

await test('MIGRATION: audit_chain_health table has RLS enabled', () => {
  const sql = read(MIGRATION)
  assert(/alter table public\.audit_chain_health enable row level security/i.test(sql),
    'audit_chain_health must have ENABLE ROW LEVEL SECURITY.')
})

await test('MIGRATION: SELECT policy restricts to authenticated admins only', () => {
  const sql = read(MIGRATION)
  const m = sql.match(/create policy audit_chain_health_select[\s\S]*?;/i)
  assert(m !== null, 'audit_chain_health_select policy must exist.')
  assert(/to authenticated/i.test(m![0]),
    'SELECT must be granted TO authenticated only (not anon, not public).')
  assert(/role\s*=\s*'admin'/i.test(m![0]),
    'SELECT must filter on profiles.role = admin.')
})

await test('MIGRATION: INSERT denied at policy level (service-role-only)', () => {
  const sql = read(MIGRATION)
  const m = sql.match(/create policy audit_chain_health_insert_deny[\s\S]*?;/i)
  assert(m !== null, 'audit_chain_health_insert_deny policy must exist.')
  assert(/with check\s*\(\s*false\s*\)/i.test(m![0]),
    'INSERT policy must be WITH CHECK (false). All writes flow via the admin client.')
})

await test('MIGRATION: NO update or delete policy granted to authenticated users', () => {
  const sql = read(MIGRATION)
  // We accept the absence of policies as immutability. If anyone adds one,
  // this test catches it.
  const updMatch = sql.match(/create\s+policy\s+\w+\s+on\s+(public\.)?audit_chain_health\s+for\s+update/i)
  const delMatch = sql.match(/create\s+policy\s+\w+\s+on\s+(public\.)?audit_chain_health\s+for\s+delete/i)
  assert(updMatch === null, 'audit_chain_health must have no FOR UPDATE policy.')
  assert(delMatch === null, 'audit_chain_health must have no FOR DELETE policy.')
})

await test('MIGRATION: CHECK constraints lock the status enum and prevent negative counts', () => {
  const sql = read(MIGRATION)
  assert(/check\s*\(\s*status\s+in\s*\(\s*'healthy'\s*,\s*'broken'\s*,\s*'error'\s*\)\s*\)/i.test(sql),
    'status column must be CHECK-constrained to {healthy, broken, error}.')
  assert(/check\s*\(\s*rows_checked\s*>=\s*0\s*\)/i.test(sql),
    'rows_checked must be CHECK-constrained >= 0.')
  assert(/check\s*\(\s*rows_invalid\s*>=\s*0\s*\)/i.test(sql),
    'rows_invalid must be CHECK-constrained >= 0.')
  assert(/check\s*\(\s*triggered_by\s+in\s*\(\s*'cron'\s*,\s*'admin_manual'\s*\)\s*\)/i.test(sql),
    'triggered_by must be CHECK-constrained to {cron, admin_manual}.')
})

await test('MIGRATION: idempotent (CREATE TABLE IF NOT EXISTS, indexes IF NOT EXISTS)', () => {
  const sql = read(MIGRATION)
  assert(/create\s+table\s+if\s+not\s+exists\s+public\.audit_chain_health/i.test(sql),
    'CREATE TABLE must use IF NOT EXISTS so the migration is replayable.')
  assert(/create\s+index\s+if\s+not\s+exists\s+audit_chain_health_checked_at_idx/i.test(sql),
    'Indexes must use IF NOT EXISTS.')
})

// ── B2. Runner: no audit_log mutation, no payload exposure ───────────────────

await test('RUNNER: never INSERT/UPDATE/DELETEs the audit_log table', () => {
  const src = read(RUNNER)
  // Strip strings + comments so a comment that mentions "audit_log" is ignored.
  const code = stripCommentsAndStrings(src)
  for (const verb of ['insert', 'update', 'delete', 'upsert']) {
    const re = new RegExp(`\\.from\\(\\s*audit_log\\s*\\)`, 'i')
    assert(!re.test(code), `Runner must never call .from(audit_log).`)
    // And no chained .verb() targeting audit_log directly.
    void verb
  }
  // Defence-in-depth: the runner must not reference audit_log table at all
  // beyond the verifier RPC name (which is verify_audit_chain).
  assert(!/from\(\s*['"]audit_log['"]\s*\)/.test(src),
    'Runner must not query the audit_log table directly. Use the verifier RPC.')
})

await test('RUNNER: only writes to audit_chain_health, only reads via verify_audit_chain RPC', () => {
  const src = read(RUNNER)
  assert(/\.rpc\(\s*['"]verify_audit_chain['"]/.test(src),
    'Runner must call .rpc("verify_audit_chain", …).')
  // The single .insert() call must target audit_chain_health.
  const insertCalls = src.match(/\.from\([^)]+\)\s*\.insert\(/g) ?? []
  for (const call of insertCalls) {
    assert(/audit_chain_health/.test(call),
      `All .insert() calls must target audit_chain_health. Found: ${call}`)
  }
})

await test('RUNNER: persists only counts, IDs, hashes — never row payloads', () => {
  const src = read(RUNNER)
  // The insert object must NOT carry old_values / new_values / metadata fields
  // from audit_log. Only the summary fields are written.
  const insertBlock = src.match(/\.from\(\s*['"]audit_chain_health['"]\s*\)\s*\.insert\(\{[\s\S]*?\}\)/)
  assert(insertBlock !== null, 'Could not locate the insert block — test logic out of date?')
  for (const forbidden of ['old_values', 'new_values', 'metadata']) {
    assert(!new RegExp(`\\b${forbidden}\\b`).test(insertBlock![0]),
      `The audit_chain_health insert must not include ${forbidden} from audit_log payloads.`)
  }
})

// ── B3. Cron route: CRON_SECRET-only, never publicly callable ────────────────

await test('CRON ROUTE: gates on CRON_SECRET Bearer token (same pattern as reconciliation)', () => {
  const src = read(CRON_ROUTE)
  assert(/process\.env\.CRON_SECRET/.test(src), 'Cron route must read CRON_SECRET.')
  assert(/Bearer/.test(src), 'Cron route must check Bearer token in Authorization header.')
  assert(/Unauthorized/i.test(src), 'Cron route must return Unauthorized on bad/missing token.')
})

await test('CRON ROUTE: returns minimal JSON — no hashes, no payloads, no broken row IDs in body', () => {
  const src = read(CRON_ROUTE)
  // The cron response is publicly observable to anyone who knows CRON_SECRET.
  // It must not include hash strings or audit IDs — those live in
  // audit_chain_health, gated by admin RLS.
  const responseBlocks = src.match(/NextResponse\.json\(\{[\s\S]*?\}/g) ?? []
  assert(responseBlocks.length > 0, 'Cron route must return JSON.')
  for (const block of responseBlocks) {
    for (const leak of ['stored_row_hash', 'stored_chain_hash', 'first_broken_audit_id', 'expected_chain_hash']) {
      assert(!block.includes(leak),
        `Cron route response body must not include ${leak} — it is admin-only data.`)
    }
  }
})

await test('CRON ROUTE: emits start + completion audit events with sanitized metadata', () => {
  const src = read(CRON_ROUTE)
  assert(/audit_chain_verification_started/.test(src),
    'Cron must emit audit_chain_verification_started.')
  assert(/audit_chain_verification_passed|audit_chain_verification_broken|audit_chain_verification_failed/.test(src),
    'Cron must emit one of the three completion actions.')
  // The audit metadata block must not include hash values.
  for (const leak of ['stored_row_hash', 'expected_chain_hash', 'first_broken_audit_id']) {
    // first_broken_event_sequence IS allowed (it's an integer pointer, not a hash).
    const re = new RegExp(`metadata[\\s\\S]{0,400}${leak}`, 'm')
    assert(!re.test(src), `Cron audit metadata must not include ${leak}.`)
  }
})

// ── B4. Admin route: admin + MFA + dual-write ────────────────────────────────

await test('ADMIN ROUTE: GET requires getAuthUser + requireRole(admin) + requireMFA', () => {
  const src = read(ADMIN_ROUTE)
  assert(/getAuthUser/.test(src),  'Admin route must call getAuthUser.')
  assert(/requireRole\([^)]*admin/.test(src), 'Admin route must call requireRole with admin.')
  assert(/requireMFA/.test(src),   'Admin route must call requireMFA (AAL2 enforcement).')
})

await test('ADMIN ROUTE: POST manual-trigger writes to admin_audit_log via logAdminAudit', () => {
  const src = read(ADMIN_ROUTE)
  assert(/logAdminAudit/.test(src), 'POST must call logAdminAudit (dual-write to admin_audit_log).')
  assert(/admin_justification/.test(src),
    'logAdminAudit invocation must include admin_justification (mandatory ≥20 chars).')
})

await test('ADMIN ROUTE: limit query param is bounded (no unbounded SELECT)', () => {
  const src = read(ADMIN_ROUTE)
  assert(/Math\.max\s*\(\s*1\s*,\s*Math\.min\s*\(\s*100/.test(src),
    'limit must be clamped to [1, 100] so a malformed ?limit cannot DoS the query.')
})

// ── B5. UI: badge + page wiring ──────────────────────────────────────────────

await test('UI: AuditChainHealthBadge renders the four states (never/healthy/broken/error)', () => {
  const src = read(BADGE)
  assert(/never checked/i.test(src), 'Badge must handle the never-checked (latest === null) state.')
  assert(/Healthy/.test(src),        'Badge must render a Healthy label.')
  assert(/BROKEN/.test(src),         'Badge must render a BROKEN label.')
  assert(/error/i.test(src),         'Badge must handle the verifier-error state.')
  // Tamper-evident, not tamper-proof.
  assert(/tamper-evident/i.test(src),
    'Badge copy must use "tamper-evident" (not "tamper-proof") per Vektrum positioning.')
  assert(!/tamper-proof/i.test(src),
    'Badge copy must NOT use "tamper-proof" — per Vektrum positioning rules.')
})

await test('UI: badge does NOT render hash values', () => {
  const src = read(BADGE)
  // Hash columns are explicitly off-limits in the UI to avoid screenshot leaks.
  for (const hashField of ['stored_row_hash', 'expected_chain_hash', 'computed_row_hash', 'stored_chain_hash']) {
    assert(!src.includes(hashField),
      `Badge UI must not display ${hashField}. Investigators use the admin RPC, not the badge.`)
  }
})

await test('UI: admin page imports the badge and the reader, and wires the badge', () => {
  const src = read(ADMIN_PAGE)
  assert(/from '@\/components\/admin\/AuditChainHealthBadge'/.test(src),
    'Admin page must import AuditChainHealthBadge.')
  assert(/from '@\/lib\/engine\/audit-chain-health'/.test(src),
    'Admin page must import getRecentAuditChainHealth.')
  assert(/<AuditChainHealthBadge\s+latest=\{/.test(src),
    'Admin page must render <AuditChainHealthBadge latest={...} />.')
})

// ── B6. vercel.json: schedule is wired ───────────────────────────────────────

await test('VERCEL: cron schedule for /api/cron/audit-chain-health is configured', () => {
  const json = JSON.parse(read(VERCEL_JSON))
  const crons = (json.crons ?? []) as Array<{ path: string; schedule: string }>
  const ours  = crons.find(c => c.path === '/api/cron/audit-chain-health')
  assert(ours !== undefined,
    'vercel.json must contain a cron entry for /api/cron/audit-chain-health.')
  assert(typeof ours!.schedule === 'string' && ours!.schedule.length > 0,
    'cron entry must have a schedule string.')
  // Reconciliation cron must remain untouched.
  const reconcile = crons.find(c => c.path === '/api/cron/reconcile')
  assert(reconcile !== undefined && reconcile.schedule === '0 * * * *',
    'reconciliation cron must remain at "0 * * * *" — this change must not move it.')
})

// ── B7. No public surface ────────────────────────────────────────────────────

await test('NO PUBLIC SURFACE: there is no /api/audit-chain-health (only admin / cron)', () => {
  const publicPath = path.join(ROOT, 'src/app/api/audit-chain-health')
  assert(!fs.existsSync(publicPath),
    'No /api/audit-chain-health route may exist. Only /api/cron/* and /api/admin/* are allowed.')
})

await test('NO PUBLIC SURFACE: middleware does NOT pass-through /api/admin/audit-chain-health', () => {
  const middleware = read(path.join(ROOT, 'src/middleware.ts'))
  assert(!/audit-chain-health/.test(middleware),
    'Middleware must not list audit-chain-health in any public pass-through. ' +
    'Admin routes flow through normal /api/* protection; cron routes flow through /api/cron/ pass-through.')
})

// ─── helpers ─────────────────────────────────────────────────────────────────

function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

// ─── Report ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — AUDIT CHAIN HEALTH TEST RESULTS')
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
