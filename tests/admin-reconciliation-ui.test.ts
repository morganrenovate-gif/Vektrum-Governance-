/**
 * Admin Reconciliation UI — Justification Safety Tests
 *
 * Static source-parse checks — no live DB, no env vars required.
 * Verifies that the ReconciliationPanel "Run Now" flow collects a
 * justification before calling the backend, and that the backend
 * route enforces and logs the justification.
 *
 * Checks:
 *  1.  ReconciliationPanel file exists.
 *  2.  Backend reconciliation route file exists.
 *  3.  "Run Now" button does NOT directly call the route — it sets a prompt flag.
 *  4.  Panel contains a justification input/textarea for the run prompt.
 *  5.  Panel enforces min 20 chars (MIN_JUSTIF_LEN = 20 or equivalent).
 *  6.  Confirm button is disabled until justification is valid (disabled={!justifValid}).
 *  7.  Panel sends X-Admin-Justification header in the fetch call.
 *  8.  Panel shows "Manual reconciliation runs are recorded in the admin audit log."
 *  9.  Panel shows "Enter a reason before running."
 * 10.  Panel clears justification and hides prompt on confirm (setShowRunPrompt(false)).
 * 11.  Backend route calls extractAdminJustification.
 * 12.  Backend route awaits logAdminAudit directly (not fire-and-forget via requireAdminAudit).
 * 12b. Backend route uses action 'manual_reconciliation_run'.
 * 12c. Backend route passes admin_justification into logAdminAudit.
 * 13.  Backend route requires admin role (requireRole).
 * 14.  Backend route requires MFA (requireMFA).
 * 15.  Backend route is read-only for GET (no insert/upsert in GET handler).
 * 16.  Panel does not import release-gate or Stripe execution code.
 * 17.  Panel does not render any secret env var values.
 *
 * Run:  npx tsx tests/admin-reconciliation-ui.test.ts
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

function read(p: string): string {
  return fs.readFileSync(path.resolve(ROOT, p), 'utf-8')
}

// Strip single-line comments for verb-safety checks
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, '')
    .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '')
    .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, '')
}

const PANEL   = 'src/components/admin/ReconciliationPanel.tsx'
const ROUTE   = 'src/app/api/admin/reconciliation/route.ts'

async function main() {

// ─── 1-2. File existence ──────────────────────────────────────────────────────

await test('1. ReconciliationPanel component file exists', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, PANEL)),
    `${PANEL} does not exist.`,
  )
})

await test('2. Backend reconciliation route file exists', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, ROUTE)),
    `${ROUTE} does not exist.`,
  )
})

// ─── 3. Run Now does not directly call route ──────────────────────────────────

await test('3. Run Now button does not directly call handleRunNow on click', () => {
  const src = read(PANEL)
  // The button's onClick must set the prompt flag, not call handleRunNow directly.
  // We check that onClick on the Run Now button references showRunPrompt, not handleRunNow.
  assert(
    src.includes('setShowRunPrompt(true)'),
    `${PANEL} Run Now button must set showRunPrompt(true) instead of directly calling handleRunNow.`,
  )
  // Verify handleRunNow is NOT the onClick handler on the initial Run Now button
  // (it should be on the confirmation button, not the trigger button)
  const runNowBtnSection = src.slice(
    src.indexOf('setShowRunPrompt(true)') - 200,
    src.indexOf('setShowRunPrompt(true)') + 200,
  )
  assert(
    !runNowBtnSection.includes('onClick={handleRunNow}'),
    `${PANEL} the initial Run Now button must not call handleRunNow directly — it should open the prompt.`,
  )
})

// ─── 4. Justification textarea ────────────────────────────────────────────────

await test('4. Panel contains a textarea for justification in the run prompt', () => {
  const src = read(PANEL)
  assert(
    src.includes('runJustif') && src.includes('<textarea'),
    `${PANEL} must contain a textarea bound to runJustif state for the justification input.`,
  )
})

// ─── 5. Min 20 chars enforced ─────────────────────────────────────────────────

await test('5. Panel enforces minimum 20-character justification', () => {
  const src = read(PANEL)
  assert(
    src.includes('MIN_JUSTIF_LEN') || src.includes('>= 20') || src.includes('length >= 20'),
    `${PANEL} must enforce a minimum justification length of 20 characters.`,
  )
})

// ─── 6. Confirm button disabled until valid ───────────────────────────────────

await test('6. Confirm button is disabled until justification meets minimum length', () => {
  const src = read(PANEL)
  assert(
    src.includes('disabled={!justifValid}') || src.includes('disabled={!justificationValid}'),
    `${PANEL} confirm button must be disabled when justification is too short (disabled={!justifValid}).`,
  )
})

// ─── 7. X-Admin-Justification header sent ────────────────────────────────────

await test('7. Panel sends X-Admin-Justification header in the fetch call', () => {
  const src = read(PANEL)
  assert(
    src.includes('X-Admin-Justification'),
    `${PANEL} must send the 'X-Admin-Justification' header when calling /api/admin/reconciliation.`,
  )
})

// ─── 8-9. Required copy strings ──────────────────────────────────────────────

await test('8. Panel includes admin audit log notice', () => {
  const src = read(PANEL)
  assert(
    src.includes('admin audit log'),
    `${PANEL} must inform the admin that manual runs are recorded in the admin audit log.`,
  )
})

await test('9. Panel includes "Enter a reason before running" instruction', () => {
  const src = read(PANEL)
  assert(
    src.includes('Enter a reason before running'),
    `${PANEL} must show "Enter a reason before running." to guide the admin.`,
  )
})

// ─── 10. Prompt cleared after confirm ────────────────────────────────────────

await test('10. Panel clears justification and hides prompt after confirm', () => {
  const src = read(PANEL)
  assert(
    src.includes("setShowRunPrompt(false)") && src.includes("setRunJustif('')"),
    `${PANEL} must call setShowRunPrompt(false) and setRunJustif('') to clean up after confirm.`,
  )
})

// ─── 11-14. Backend route guards ─────────────────────────────────────────────

await test('11. Backend route calls extractAdminJustification', () => {
  const src = read(ROUTE)
  assert(
    src.includes('extractAdminJustification'),
    `${ROUTE} must call extractAdminJustification — do not weaken this backend requirement.`,
  )
})

await test('12. Backend route calls logAdminAudit for the dual-write (awaited, not fire-and-forget)', () => {
  const src = read(ROUTE)
  // The route must await logAdminAudit directly so the audit_log write completes
  // before the response is returned. requireAdminAudit fires it fire-and-forget
  // which risks abandonment in serverless runtimes.
  assert(
    src.includes('logAdminAudit'),
    `${ROUTE} must call logAdminAudit to dual-write to audit_log + admin_audit_log.`,
  )
  // Must be awaited (not fire-and-forget) so the record lands before the response flushes
  assert(
    src.includes('await logAdminAudit'),
    `${ROUTE} must await logAdminAudit — unawaited calls risk abandonment in serverless runtimes.`,
  )
})

await test("12b. Backend route uses action 'manual_reconciliation_run' for the audit event", () => {
  const src = read(ROUTE)
  assert(
    src.includes('manual_reconciliation_run'),
    `${ROUTE} must use action 'manual_reconciliation_run' so the event is identifiable ` +
    `in the admin audit log and Recent Audit Activity.`,
  )
})

await test('12c. Backend route passes admin_justification into logAdminAudit', () => {
  const src = read(ROUTE)
  assert(
    src.includes('admin_justification'),
    `${ROUTE} must pass admin_justification into logAdminAudit so the justification is ` +
    `recorded in admin_audit_log.`,
  )
})

await test("13. Backend route requires admin role", () => {
  const src = read(ROUTE)
  assert(
    src.includes("requireRole") && src.includes("'admin'"),
    `${ROUTE} must call requireRole(profile, 'admin') — the reconciliation endpoint must not be accessible to non-admins.`,
  )
})

await test('14. Backend route requires MFA', () => {
  const src = read(ROUTE)
  assert(
    src.includes('requireMFA'),
    `${ROUTE} must call requireMFA — manual reconciliation is a privileged admin action.`,
  )
})

// ─── 15. GET handler is read-only ────────────────────────────────────────────

await test('15. GET handler in backend route has no write operations', () => {
  const src = read(ROUTE)
  // Extract just the GET function to avoid flagging POST insert
  const getStart  = src.indexOf('export async function GET')
  const postStart = src.indexOf('export async function POST')
  const getSection = postStart > getStart
    ? src.slice(getStart, postStart)
    : src.slice(getStart)
  const code = codeOnly(getSection)
  const forbidden = ['.insert(', '.upsert(', '.delete(']
  for (const verb of forbidden) {
    assert(
      !code.includes(verb),
      `${ROUTE} GET handler must be read-only — found write verb: ${verb}`,
    )
  }
})

// ─── 16. No release gate / Stripe execution imports ──────────────────────────

await test('16. ReconciliationPanel does not import release-gate or Stripe execution code', () => {
  const src = read(PANEL)
  const forbidden = ['release-gate', 'stripe', 'Stripe']
  for (const term of forbidden) {
    assert(
      !src.includes(`from '@/lib/engine/${term}'`) && !src.includes(`import Stripe`),
      `${PANEL} must not import release-gate or Stripe execution code — panel is UI only. Found: ${term}`,
    )
  }
})

// ─── 17. No secrets rendered ─────────────────────────────────────────────────

await test('17. Panel does not render secret env var values', () => {
  const src = read(PANEL)
  const forbidden = [
    'STRIPE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CRON_SECRET',
    'STRIPE_WEBHOOK_SECRET',
  ]
  for (const secret of forbidden) {
    assert(
      !src.includes(secret),
      `${PANEL} must not reference ${secret} — secrets must never appear in client components.`,
    )
  }
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Admin Reconciliation UI Justification Tests')
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
