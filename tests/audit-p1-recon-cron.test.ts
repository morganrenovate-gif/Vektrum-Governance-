/**
 * Audit logging — P1 commit 2: reconciliation issue + cron lifecycle
 *
 * Covers two routes:
 *
 *   /api/admin/reconciliation/[issueId]  (PATCH)
 *     This route is already fully audit-wired via requireAdminAudit (the
 *     dual-write helper). Tests below pin that contract so a future refactor
 *     cannot regress it.
 *
 *   /api/cron/reconcile  (GET/POST)
 *     This route was previously unaudited. Started/completed/failed events
 *     are now emitted as system-actor audit rows. Tests below pin the
 *     contract and assert no secrets/headers leak into metadata.
 *
 *   A. RECONCILIATION ISSUE PATCH — already audited (regression pins)
 *      A1. Imports requireAdminAudit
 *      A2. The four canonical action names exist as literals in code:
 *            - reconciliation_issue_acknowledged
 *            - reconciliation_issue_false_positive
 *            - reconciliation_issue_resolved
 *            - reconciliation_auto_fix_applied
 *      A3. The non-auto-fix audit invocation is ordered AFTER the persist
 *          step (failed updates must NEVER log a success event)
 *      A4. The audit invocation references entity_type 'reconciliation_issue'
 *
 *   B. CRON RECONCILE — three lifecycle audits
 *      B1. /api/cron/reconcile imports logAudit
 *      B2. Calls logAudit with action 'cron_reconcile_started' (system actor)
 *      B3. Calls logAudit with action 'cron_reconcile_completed' on success
 *      B4. Calls logAudit with action 'cron_reconcile_failed' on failure
 *      B5. Started event precedes runReconciliation; completed and failed
 *          events follow it
 *      B6. All three calls use system actor (actor_role: 'system', actor_id: null)
 *
 *   C. CRON METADATA SAFETY
 *      C1. None of the three cron audit blocks reference CRON_SECRET,
 *          authorization headers, request headers, tokens, env names, or
 *          full Error objects.
 *      C2. The failed event uses error_summary (single-line, truncated) —
 *          NOT raw stack traces or full Error objects.
 *
 * Run:  npx tsx tests/audit-p1-recon-cron.test.ts
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function src(rel: string) {
  return readFileSync(path.resolve(ROOT, rel), 'utf-8')
}

const RECON_ISSUE = src('src/app/api/admin/reconciliation/[issueId]/route.ts')
const CRON        = src('src/app/api/cron/reconcile/route.ts')

const results: { name: string; passed: boolean; error?: string }[] = []

function test(name: string, fn: () => void) {
  try {
    fn()
    results.push({ name, passed: true })
  } catch (e) {
    results.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) })
  }
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

/**
 * Walk balanced braces from a `await fnName(` opener and return the literal
 * source of that single audit call.
 */
function extractCallAt(source: string, fnName: string, fromIndex = 0): { call: string; end: number } {
  const opener = `await ${fnName}(`
  const idx = source.indexOf(opener, fromIndex)
  if (idx === -1) throw new Error(`${fnName}( not found from index ${fromIndex}`)
  let depth = 0
  let i = idx + opener.length
  for (; i < source.length; i++) {
    const ch = source[i]
    if (ch === '(' || ch === '{' || ch === '[') depth++
    else if (ch === ')' || ch === '}' || ch === ']') {
      if (depth === 0) break
      depth--
    }
  }
  return { call: source.slice(idx, i + 1), end: i + 1 }
}

/**
 * Find every `await fnName(...)` call body, in order.
 */
function extractAllCalls(source: string, fnName: string): string[] {
  const calls: string[] = []
  let cursor = 0
  while (true) {
    try {
      const { call, end } = extractCallAt(source, fnName, cursor)
      calls.push(call)
      cursor = end
    } catch {
      return calls
    }
  }
}

// ─── A. RECONCILIATION ISSUE PATCH (already audited — regression pins) ──────

test('A1: reconciliation issue route imports requireAdminAudit', () => {
  assert(
    RECON_ISSUE.includes('requireAdminAudit'),
    'reconciliation issue route does not use requireAdminAudit — dual-write contract not enforced',
  )
})

test('A2: reconciliation issue route declares all four canonical action names', () => {
  for (const action of [
    'reconciliation_issue_acknowledged',
    'reconciliation_issue_false_positive',
    'reconciliation_issue_resolved',
    'reconciliation_auto_fix_applied',
  ]) {
    assert(
      RECON_ISSUE.includes(`'${action}'`),
      `reconciliation issue route is missing canonical action name "${action}"`,
    )
  }
})

test('A3: non-auto-fix audit invocation is ordered AFTER the persist step', () => {
  // The bottom requireAdminAudit (the one that handles acknowledge / false_positive
  // / resolve) must come after the .update() call AND after the if (updateError)
  // guard. This prevents failed updates from logging a success event.
  const updateIdx        = RECON_ISSUE.indexOf("from('reconciliation_issues')\n    .update(")
  const guardIdx         = RECON_ISSUE.indexOf('if (updateError)')
  const auditCalls       = extractAllCalls(RECON_ISSUE, 'requireAdminAudit')
  // Find the LAST requireAdminAudit invocation in the file — that is the
  // non-auto-fix branch (auto-fix returns early before reaching it).
  const lastAuditIdx     = RECON_ISSUE.lastIndexOf('await requireAdminAudit(')

  assert(updateIdx > -1,    'expected the .update() call on reconciliation_issues')
  assert(guardIdx > -1,     'expected the if (updateError) guard')
  assert(auditCalls.length >= 2,
    'expected at least two requireAdminAudit calls (auto-fix + non-auto-fix)')
  assert(
    lastAuditIdx > guardIdx && guardIdx > updateIdx,
    'non-auto-fix audit must run after .update() AND after if (updateError) — failed updates must not log a success event',
  )
})

test('A4: reconciliation issue audit invocations target entity_type "reconciliation_issue"', () => {
  for (const call of extractAllCalls(RECON_ISSUE, 'requireAdminAudit')) {
    assert(
      call.includes("entityType:") && call.includes("'reconciliation_issue'"),
      `requireAdminAudit call does not set entityType 'reconciliation_issue':\n${call}`,
    )
  }
})

// ─── B. CRON RECONCILE — three lifecycle audits ──────────────────────────────

test('B1: cron route imports logAudit', () => {
  assert(
    CRON.includes("from '@/lib/engine/audit'") && CRON.includes('logAudit'),
    'cron route does not import logAudit',
  )
})

test('B2: cron emits action "cron_reconcile_started" (system actor)', () => {
  const calls = extractAllCalls(CRON, 'logAudit')
  const started = calls.find((c) => c.includes("'cron_reconcile_started'"))
  assert(started !== undefined, 'cron route does not emit cron_reconcile_started')
  assert(
    started.includes("actor_role:") && started.includes("'system'"),
    `cron_reconcile_started does not set actor_role 'system':\n${started}`,
  )
  assert(
    started.includes('actor_id:') && started.includes('null'),
    `cron_reconcile_started does not set actor_id null (system event):\n${started}`,
  )
  assert(
    started.includes("entity_type:") && started.includes("'reconciliation_run'"),
    `cron_reconcile_started does not set entity_type 'reconciliation_run'`,
  )
})

test('B3: cron emits action "cron_reconcile_completed" on success path', () => {
  const calls = extractAllCalls(CRON, 'logAudit')
  const completed = calls.find((c) => c.includes("'cron_reconcile_completed'"))
  assert(completed !== undefined, 'cron route does not emit cron_reconcile_completed')
  // Completed must include duration + counts (the safe success metadata)
  for (const field of ['duration_ms', 'releases_checked', 'transfers_checked', 'deals_checked', 'issues_found']) {
    assert(
      completed.includes(field),
      `cron_reconcile_completed metadata missing field "${field}":\n${completed}`,
    )
  }
})

test('B4: cron emits action "cron_reconcile_failed" with safe error_summary', () => {
  const calls = extractAllCalls(CRON, 'logAudit')
  const failed = calls.find((c) => c.includes("'cron_reconcile_failed'"))
  assert(failed !== undefined, 'cron route does not emit cron_reconcile_failed')
  // Must use error_summary (single-line, truncated), NOT raw error objects
  assert(
    failed.includes('error_summary'),
    `cron_reconcile_failed must include error_summary field — never a raw error object`,
  )
  // Truncation guard — must not pass result.error directly to the metadata
  // without taking a single line + slice
  assert(
    failed.includes('split(') && failed.includes('slice('),
    `cron_reconcile_failed error_summary must be normalised (split('\\n')[0].slice(...))`,
  )
})

test('B5: started precedes runReconciliation; completed/failed follow it', () => {
  const startedIdx     = CRON.indexOf("'cron_reconcile_started'")
  const reconcileIdx   = CRON.indexOf('await runReconciliation(')
  const completedIdx   = CRON.indexOf("'cron_reconcile_completed'")
  const failedIdx      = CRON.indexOf("'cron_reconcile_failed'")
  assert(startedIdx > -1 && reconcileIdx > -1 && completedIdx > -1 && failedIdx > -1,
    'expected all of started, runReconciliation, completed, failed to be present')
  assert(
    startedIdx < reconcileIdx,
    'cron_reconcile_started must be emitted BEFORE runReconciliation',
  )
  assert(
    completedIdx > reconcileIdx,
    'cron_reconcile_completed must be emitted AFTER runReconciliation',
  )
  assert(
    failedIdx > reconcileIdx,
    'cron_reconcile_failed must be emitted AFTER runReconciliation',
  )
})

test('B6: all three cron events use system actor', () => {
  const calls = extractAllCalls(CRON, 'logAudit')
  const cronCalls = calls.filter((c) =>
    c.includes("'cron_reconcile_started'") ||
    c.includes("'cron_reconcile_completed'") ||
    c.includes("'cron_reconcile_failed'"),
  )
  assert(cronCalls.length === 3,
    `expected exactly 3 cron lifecycle audit calls, found ${cronCalls.length}`)
  for (const c of cronCalls) {
    assert(
      c.includes("actor_role:") && c.includes("'system'"),
      `cron audit call does not set actor_role 'system':\n${c}`,
    )
    assert(
      c.includes('actor_id:') && c.includes('null'),
      `cron audit call does not set actor_id null:\n${c}`,
    )
  }
})

// ─── C. CRON METADATA SAFETY ─────────────────────────────────────────────────

test('C1: cron audit metadata never references secrets/headers/tokens', () => {
  const calls = extractAllCalls(CRON, 'logAudit')
  const cronCalls = calls.filter((c) =>
    c.includes("'cron_reconcile_started'") ||
    c.includes("'cron_reconcile_completed'") ||
    c.includes("'cron_reconcile_failed'"),
  )
  const forbidden = [
    'CRON_SECRET',
    'process.env',
    'authHeader',
    'authorization',
    'request.headers',
    'headers.get',
    'Bearer',
    'access_token',
    'refresh_token',
    'session_token',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
    'webhook_secret',
    'apiKey',
    'api_key:',
  ]
  for (const c of cronCalls) {
    for (const f of forbidden) {
      assert(
        !c.toLowerCase().includes(f.toLowerCase()),
        `cron audit call references forbidden token "${f}":\n${c}`,
      )
    }
  }
})

test('C2: cron failed event does not pass raw Error objects or full stacks', () => {
  const calls = extractAllCalls(CRON, 'logAudit')
  const failed = calls.find((c) => c.includes("'cron_reconcile_failed'"))
  assert(failed !== undefined, 'cron_reconcile_failed not present')
  // Must NOT spread the raw error or attach it as a value
  assert(
    !failed.includes('error: result.error') &&
    !failed.includes('error_object') &&
    !failed.includes('stack:'),
    `cron_reconcile_failed must not pass raw error/stack — use error_summary string only:\n${failed}`,
  )
})

// ─── Results ─────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — AUDIT P1 RECON+CRON TEST RESULTS')
console.log('═'.repeat(72))

for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}`)
  if (!r.passed) console.log(`       → ${r.error}`)
}

console.log('═'.repeat(72))
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('═'.repeat(72) + '\n')

if (failed > 0) process.exit(1)
