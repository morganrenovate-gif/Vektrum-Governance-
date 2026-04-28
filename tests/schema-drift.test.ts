/**
 * Schema-drift script static safety and coverage tests.
 *
 * Static source-parse checks — no live DB, no env vars required.
 * Verifies that scripts/check-schema-drift.mjs covers all critical areas
 * and has the correct security properties (read-only, no secret printing).
 *
 * Checks:
 *  1.  Script file exists at scripts/check-schema-drift.mjs.
 *  2.  Docs file exists at docs/ops/SCHEMA_DRIFT_CHECK.md.
 *  3.  Script uses @supabase/supabase-js (not service-role shortcut).
 *  4.  Script creates an admin client with SERVICE_ROLE_KEY.
 *  5.  Script creates an anon client with ANON_KEY (for RLS smoke).
 *  6.  Script never prints secret key values (no console.log of env var value).
 *  7.  Script has table existence checks (CRITICAL_TABLES array).
 *  8.  Script checks all 10 critical financial/gate tables.
 *  9.  Script has column existence checks (CRITICAL_COLUMNS).
 * 10.  Script checks retainage columns (retainage_percentage, retainage_held).
 * 11.  Script checks audit chain columns (row_hash, chain_hash).
 * 12.  Script checks execution_rail column (external rail).
 * 13.  Script has function probes (FUNCTION_PROBES).
 * 14.  Script probes reserve_release_funds with correct 3-arg signature.
 * 15.  Script probes verify_audit_chain.
 * 16.  Script probes is_funder_on_deal and is_contractor_on_deal.
 * 17.  Script checks PGRST202 for function-missing detection.
 * 18.  Script has RLS smoke checks (RLS_PROTECTED_TABLES).
 * 19.  Script includes billing_records and audit_log in RLS checks.
 * 20.  Script includes partners in RLS checks.
 * 21.  Script uses .limit(0) for table and column probes (no data returned).
 * 22.  Script has no INSERT, UPDATE, DELETE, or UPSERT calls.
 * 23.  Script exits 1 on failure (process.exit with failed count > 0).
 * 24.  Script exits 1 when required env vars are missing.
 * 25.  Script truncates the URL in output (does not print full URL).
 *
 * Run:  npx tsx tests/schema-drift.test.ts
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

// Strip comments and string literals for write-verb safety checks
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')         // block comments
    .replace(/\/\/[^\n]*/g, '')               // line comments
    .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, '') // single-quoted strings
    .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '') // double-quoted strings
    .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, '') // template literals
}

const SCRIPT  = 'scripts/check-schema-drift.mjs'
const OPS_DOC = 'docs/ops/SCHEMA_DRIFT_CHECK.md'

async function main() {

// ─── 1–2. File existence ──────────────────────────────────────────────────────

await test('1. Script file exists at scripts/check-schema-drift.mjs', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, SCRIPT)),
    `${SCRIPT} does not exist.`,
  )
})

await test('2. Docs file exists at docs/ops/SCHEMA_DRIFT_CHECK.md', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, OPS_DOC)),
    `${OPS_DOC} does not exist.`,
  )
})

// ─── 3–6. Client setup and security ──────────────────────────────────────────

await test('3. Script imports from @supabase/supabase-js', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('@supabase/supabase-js'),
    `${SCRIPT} must import from '@supabase/supabase-js'.`,
  )
})

await test('4. Script creates admin client with SERVICE_ROLE_KEY', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('SUPABASE_SERVICE_ROLE_KEY'),
    `${SCRIPT} must use SUPABASE_SERVICE_ROLE_KEY for the admin client.`,
  )
})

await test('5. Script creates anon client with ANON_KEY for RLS smoke', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('SUPABASE_ANON_KEY') || src.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    `${SCRIPT} must use the anon key to run RLS smoke checks.`,
  )
})

await test('6. Script does not print secret key values', () => {
  const src = read(SCRIPT)
  const forbidden = [
    'console.log(SUPABASE_SERVICE_ROLE_KEY',
    'console.log(SUPABASE_ANON_KEY',
    'console.log(NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'console.error(SUPABASE_SERVICE_ROLE_KEY',
    'process.stdout.write(SUPABASE_SERVICE_ROLE_KEY',
  ]
  for (const phrase of forbidden) {
    assert(
      !src.includes(phrase),
      `${SCRIPT} must not print secret values. Found: "${phrase}"`,
    )
  }
})

// ─── 7–8. Table checks ────────────────────────────────────────────────────────

await test('7. Script has CRITICAL_TABLES array', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('CRITICAL_TABLES'),
    `${SCRIPT} must define a CRITICAL_TABLES array.`,
  )
})

await test('8. Script checks all 10 critical financial/gate tables', () => {
  const src = read(SCRIPT)
  const required = [
    'deals',
    'milestones',
    'releases',
    'billing_records',
    'contracts',
    'lien_waivers',
    'retainage_releases',
    'change_orders',
    'reconciliation_runs',
    'audit_log',
  ]
  for (const table of required) {
    assert(
      src.includes(`'${table}'`) || src.includes(`"${table}"`),
      `${SCRIPT} must include '${table}' in table checks.`,
    )
  }
})

// ─── 9–12. Column checks ─────────────────────────────────────────────────────

await test('9. Script has CRITICAL_COLUMNS array', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('CRITICAL_COLUMNS'),
    `${SCRIPT} must define a CRITICAL_COLUMNS array.`,
  )
})

await test('10. Script checks retainage columns', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('retainage_percentage') && src.includes('retainage_held'),
    `${SCRIPT} must check retainage_percentage and retainage_held columns.`,
  )
})

await test('11. Script checks audit chain columns (row_hash, chain_hash)', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('row_hash') && src.includes('chain_hash'),
    `${SCRIPT} must check row_hash and chain_hash columns on audit_log.`,
  )
})

await test('12. Script checks execution_rail column (external rail)', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('execution_rail'),
    `${SCRIPT} must check the execution_rail column (migration 20260425000000).`,
  )
})

// ─── 13–17. Function probes ───────────────────────────────────────────────────

await test('13. Script has FUNCTION_PROBES array', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('FUNCTION_PROBES'),
    `${SCRIPT} must define a FUNCTION_PROBES array.`,
  )
})

await test('14. Script probes reserve_release_funds and increment_deal_financials with correct arg names', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('reserve_release_funds'),
    `${SCRIPT} must probe reserve_release_funds.`,
  )
  // reserve_release_funds: p_deal_id, p_gross, p_fee (010_billing + 20260424000006)
  assert(
    src.includes('p_deal_id') && src.includes('p_gross') && src.includes('p_fee'),
    `${SCRIPT} reserve_release_funds probe must use p_deal_id, p_gross, p_fee.`,
  )
  // increment_deal_financials was rewritten in retainage migration with renamed params
  assert(
    src.includes('p_released_amount') && src.includes('p_fee_amount'),
    `${SCRIPT} increment_deal_financials probe must use p_released_amount and p_fee_amount ` +
    `(retainage migration 20260424000006 renamed params from p_gross/p_fee).`,
  )
})

await test('15. Script probes verify_audit_chain', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('verify_audit_chain'),
    `${SCRIPT} must probe verify_audit_chain function.`,
  )
})

await test('16. Script probes is_funder_on_deal and is_contractor_on_deal', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('is_funder_on_deal') && src.includes('is_contractor_on_deal'),
    `${SCRIPT} must probe both is_funder_on_deal and is_contractor_on_deal.`,
  )
})

await test('17. Script detects PGRST202 for missing functions', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('PGRST202'),
    `${SCRIPT} must check for error code PGRST202 to detect missing functions.`,
  )
})

// ─── 18–20. RLS smoke checks ──────────────────────────────────────────────────

await test('18. Script has RLS_PROTECTED_TABLES list', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('RLS_PROTECTED_TABLES'),
    `${SCRIPT} must define a RLS_PROTECTED_TABLES array.`,
  )
})

await test('19. Script checks billing_records and audit_log for RLS', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('billing_records') && src.includes('audit_log'),
    `${SCRIPT} must include billing_records and audit_log in RLS smoke checks.`,
  )
})

await test('20. Script checks partners table for RLS', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('partners'),
    `${SCRIPT} must include partners in RLS smoke checks (API keys are stored here).`,
  )
})

// ─── 21–22. Read-only safety ──────────────────────────────────────────────────

await test('21. Script uses .limit(0) for table and column probes', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('.limit(0)'),
    `${SCRIPT} must use .limit(0) on table and column probes to avoid reading actual data.`,
  )
})

await test('22. Script has no write operations (INSERT, UPDATE, DELETE, UPSERT)', () => {
  const code = codeOnly(read(SCRIPT))
  const forbidden = ['.insert(', '.update(', '.delete(', '.upsert(']
  for (const verb of forbidden) {
    assert(
      !code.includes(verb),
      `${SCRIPT} must not contain ${verb} — schema check must be read-only.`,
    )
  }
})

// ─── 23–25. Exit behavior and output safety ───────────────────────────────────

await test('23. Script exits 1 when checks fail', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('process.exit(failed') || src.includes('process.exit(1'),
    `${SCRIPT} must call process.exit(1) or equivalent when checks fail.`,
  )
})

await test('24. Script exits 1 when required env vars are missing', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('missingEnv') || (src.includes('missing') && src.includes('process.exit(1')),
    `${SCRIPT} must exit 1 immediately when required env vars are absent.`,
  )
})

await test('25. Script truncates URL in output (does not print full value)', () => {
  const src = read(SCRIPT)
  assert(
    src.includes('.replace(') || src.includes('truncat') || src.includes('…'),
    `${SCRIPT} should truncate SUPABASE_URL in output rather than printing it in full.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Schema Drift Script Coverage Tests')
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
