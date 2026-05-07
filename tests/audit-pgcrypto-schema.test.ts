/**
 * Audit pgcrypto schema fix — Static Safety Tests
 *
 * Verifies that all audit hash functions use extensions.digest() instead of bare
 * digest(), and that the pgcrypto extension is created in the extensions schema.
 * This prevents SQLSTATE 42883 ("function digest(text, unknown) does not exist")
 * on Supabase instances where pgcrypto is installed in the extensions schema.
 *
 * Root cause reproduced: updating deals.funder_id fires trg_audit_deals →
 * audit_deals() INSERT into audit_log → trg_audit_log_hash → compute_audit_hash()
 * → bare digest() → 42883 → dealUpdateError → "Failed to assign you as funder."
 *
 * Source-parse checks only — no live DB, no env vars required.
 *
 * Checks:
 *  1.  Fix migration exists.
 *  2.  Fix migration creates pgcrypto WITH SCHEMA extensions.
 *  3.  compute_audit_hash() uses extensions.digest() — not bare digest().
 *  4.  compute_audit_hash() has no bare digest() call remaining.
 *  5.  verify_audit_chain() uses extensions.digest().
 *  6.  verify_audit_chain() has no bare digest() remaining.
 *  7.  compute_admin_audit_hash() uses extensions.digest().
 *  8.  compute_admin_audit_hash() has no bare digest() remaining.
 *  9.  verify_admin_audit_chain() uses extensions.digest().
 * 10.  verify_admin_audit_chain() has no bare digest() remaining.
 * 11.  The fix migration does not change hash algorithm or chain logic.
 *      (sha256 is still the algorithm; chain uses row_hash || prev_chain.)
 * 12.  audit_deals() trigger fires on funder_id change (causal root of the error).
 * 13.  audit_deals() is an AFTER UPDATE trigger on public.deals.
 * 14.  trg_audit_log_hash fires BEFORE INSERT on audit_log (connects the chain).
 * 15.  The signup defensive wrapper (20260429000000) is preserved.
 * 16.  No trigger, RLS policy, or table definition is changed by the fix migration.
 * 17.  Test wired into npm test in package.json.
 *
 * Run:  npx tsx tests/audit-pgcrypto-schema.test.ts
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

const FIX_MIG    = 'supabase/migrations/20260429000001b_pgcrypto_schema_fix.sql'
const IMMUT_MIG  = 'supabase/migrations/20260424000004_audit_log_immutability.sql'
const ADMIN_MIG  = 'supabase/migrations/20260424000007_admin_audit.sql'
const SIGNUP_DEF = 'supabase/migrations/20260429000000_signup_audit_defensive.sql'
const SCHEMA_016 = 'supabase/migrations/016_audit_compliance.sql'
const PKG        = 'package.json'

async function main() {

// ─── 1-2. Migration existence and pgcrypto placement ─────────────────────────

await test('1. Fix migration exists', () => {
  const src = read(FIX_MIG)
  assert(
    src.length > 100,
    `${FIX_MIG} must exist and be non-empty. ` +
    `This migration ensures pgcrypto is in the extensions schema and rewrites ` +
    `all four audit hash functions to use extensions.digest().`,
  )
})

await test('2. Fix migration creates pgcrypto WITH SCHEMA extensions', () => {
  const src = read(FIX_MIG)
  assert(
    src.includes('pgcrypto') && src.includes('extensions') &&
    (src.includes('WITH SCHEMA extensions') || src.includes('with schema extensions')),
    `${FIX_MIG} must run: CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions. ` +
    `Without WITH SCHEMA extensions, Supabase may install pgcrypto in a schema ` +
    `that is not on the search_path of the hash trigger functions.`,
  )
})

// ─── 3-4. compute_audit_hash() ────────────────────────────────────────────────

await test('3. compute_audit_hash() uses extensions.digest()', () => {
  const src = read(FIX_MIG)
  assert(
    src.includes('extensions.digest(') &&
    src.includes('compute_audit_hash'),
    `${FIX_MIG} must define compute_audit_hash() using extensions.digest(). ` +
    `Without this, the BEFORE INSERT trigger on audit_log fails with 42883 ` +
    `whenever any INSERT into audit_log is attempted.`,
  )
})

await test('4. compute_audit_hash() in fix migration has no bare digest() call', () => {
  const src = read(FIX_MIG)
  // Extract the compute_audit_hash function body to check for bare digest() calls.
  // A bare digest() would appear without the 'extensions.' prefix.
  const fnStart = src.indexOf('compute_audit_hash')
  const fnEnd   = src.indexOf('compute_admin_audit_hash')
  const fnBody  = fnStart > -1 && fnEnd > fnStart
    ? src.slice(fnStart, fnEnd)
    : src
  // Check that digest( appears only as extensions.digest(
  const bareDigestMatches = fnBody.match(/(?<!extensions\.)digest\s*\(/g)
  assert(
    !bareDigestMatches || bareDigestMatches.length === 0,
    `compute_audit_hash() in ${FIX_MIG} must not contain any bare digest() calls. ` +
    `Found: ${bareDigestMatches?.join(', ')}. Use extensions.digest() exclusively.`,
  )
})

// ─── 5-6. verify_audit_chain() ────────────────────────────────────────────────

await test('5. verify_audit_chain() uses extensions.digest()', () => {
  const src = read(FIX_MIG)
  assert(
    src.includes('verify_audit_chain') && src.includes('extensions.digest('),
    `${FIX_MIG} must define verify_audit_chain() using extensions.digest(). ` +
    `This function is called by the reconciliation cron and admin dashboard ` +
    `to verify chain integrity — it must use the same hash path as the trigger.`,
  )
})

await test('6. verify_audit_chain() in fix migration has no bare digest() call', () => {
  const src = read(FIX_MIG)
  const fnStart = src.indexOf('verify_audit_chain')
  const fnEnd   = src.indexOf('compute_admin_audit_hash')
  const fnBody  = fnStart > -1 && fnEnd > fnStart
    ? src.slice(fnStart, fnEnd)
    : src.slice(fnStart)
  const bareDigestMatches = fnBody.match(/(?<!extensions\.)digest\s*\(/g)
  assert(
    !bareDigestMatches || bareDigestMatches.length === 0,
    `verify_audit_chain() in ${FIX_MIG} must not contain any bare digest() calls. ` +
    `Found: ${bareDigestMatches?.join(', ')}. Use extensions.digest() exclusively.`,
  )
})

// ─── 7-8. compute_admin_audit_hash() ─────────────────────────────────────────

await test('7. compute_admin_audit_hash() uses extensions.digest()', () => {
  const src = read(FIX_MIG)
  assert(
    src.includes('compute_admin_audit_hash') && src.includes('extensions.digest('),
    `${FIX_MIG} must define compute_admin_audit_hash() using extensions.digest(). ` +
    `This function is the BEFORE INSERT trigger on admin_audit_log — it has the ` +
    `same digest dependency as compute_audit_hash().`,
  )
})

await test('8. compute_admin_audit_hash() in fix migration has no bare digest() call', () => {
  const src = read(FIX_MIG)
  const fnStart = src.indexOf('compute_admin_audit_hash')
  const fnEnd   = src.indexOf('verify_admin_audit_chain')
  const fnBody  = fnStart > -1 && fnEnd > fnStart
    ? src.slice(fnStart, fnEnd)
    : src.slice(fnStart)
  const bareDigestMatches = fnBody.match(/(?<!extensions\.)digest\s*\(/g)
  assert(
    !bareDigestMatches || bareDigestMatches.length === 0,
    `compute_admin_audit_hash() in ${FIX_MIG} must not contain any bare digest() calls. ` +
    `Found: ${bareDigestMatches?.join(', ')}. Use extensions.digest() exclusively.`,
  )
})

// ─── 9-10. verify_admin_audit_chain() ────────────────────────────────────────

await test('9. verify_admin_audit_chain() uses extensions.digest()', () => {
  const src = read(FIX_MIG)
  assert(
    src.includes('verify_admin_audit_chain') && src.includes('extensions.digest('),
    `${FIX_MIG} must define verify_admin_audit_chain() using extensions.digest(). ` +
    `This function is called by the admin audit review routes.`,
  )
})

await test('10. verify_admin_audit_chain() in fix migration has no bare digest() call', () => {
  const src = read(FIX_MIG)
  const fnStart = src.lastIndexOf('verify_admin_audit_chain')
  const fnBody  = fnStart > -1 ? src.slice(fnStart) : src
  const bareDigestMatches = fnBody.match(/(?<!extensions\.)digest\s*\(/g)
  assert(
    !bareDigestMatches || bareDigestMatches.length === 0,
    `verify_admin_audit_chain() in ${FIX_MIG} must not contain any bare digest() calls. ` +
    `Found: ${bareDigestMatches?.join(', ')}. Use extensions.digest() exclusively.`,
  )
})

// ─── 11. Hash algorithm and chain logic are preserved ─────────────────────────

await test('11. Fix migration preserves sha256 algorithm and chain logic', () => {
  const src = read(FIX_MIG)
  assert(
    src.includes("'sha256'"),
    `${FIX_MIG} must still use 'sha256' as the digest algorithm. ` +
    `Changing the algorithm would invalidate all existing row_hash and chain_hash values.`,
  )
  assert(
    src.includes('row_hash') && src.includes('chain_hash') && src.includes('COALESCE'),
    `${FIX_MIG} must preserve the row_hash and chain_hash chain structure. ` +
    `The Merkle-style chain logic (hash(row_hash || prev_chain)) must not be altered.`,
  )
})

// ─── 12-14. Causal chain: deals trigger → audit_log INSERT → hash trigger ─────

await test('12. audit_deals() fires on funder_id change (root of the error chain)', () => {
  const src = read(SCHEMA_016)
  assert(
    src.includes('funder_id') && src.includes('funder_assigned') &&
    src.includes('audit_deals'),
    `${SCHEMA_016} audit_deals() must fire on funder_id changes and write ` +
    `'funder_assigned' to audit_log. This is the first link in the causal chain ` +
    `that leads to compute_audit_hash() being called during invite acceptance.`,
  )
})

await test('13. audit_deals() is registered as an AFTER UPDATE trigger on deals', () => {
  const sql001 = read('supabase/migrations/001_schema.sql')
  assert(
    sql001.includes('trg_audit_deals') &&
    (sql001.includes('AFTER INSERT OR UPDATE') || sql001.includes('after insert or update')),
    `001_schema.sql must register trg_audit_deals as AFTER INSERT OR UPDATE on ` +
    `public.deals. Without this trigger, the causal chain from deals.update() ` +
    `to compute_audit_hash() would not exist.`,
  )
})

await test('14. trg_audit_log_hash fires BEFORE INSERT on audit_log', () => {
  const src = read(IMMUT_MIG)
  assert(
    src.includes('trg_audit_log_hash') && src.includes('BEFORE INSERT'),
    `${IMMUT_MIG} must create trg_audit_log_hash as a BEFORE INSERT trigger on ` +
    `audit_log. This trigger calls compute_audit_hash() and is the specific point ` +
    `where the digest() resolution failure causes the deal update to fail.`,
  )
})

// ─── 15. Signup defensive wrapper is preserved ───────────────────────────────

await test('15. Signup defensive wrapper (20260429000000) is preserved intact', () => {
  const src = read(SIGNUP_DEF)
  assert(
    src.includes('EXCEPTION WHEN OTHERS THEN') &&
    src.includes('RAISE WARNING') &&
    src.includes('audit_user_signup'),
    `${SIGNUP_DEF} must still define audit_user_signup() with the EXCEPTION WHEN ` +
    `OTHERS THEN RAISE WARNING wrapper. The pgcrypto fix resolves the root cause ` +
    `for the deal assignment path, but the signup wrapper should remain as ` +
    `defense-in-depth for the signup path.`,
  )
})

// ─── 16. Fix migration only changes function definitions ─────────────────────

await test('16. Fix migration does not change triggers, RLS, or tables', () => {
  const src = read(FIX_MIG)
  assert(
    !src.includes('CREATE TABLE') && !src.includes('ALTER TABLE') &&
    !src.includes('CREATE POLICY') && !src.includes('DROP POLICY') &&
    !src.includes('CREATE TRIGGER') && !src.includes('DROP TRIGGER'),
    `${FIX_MIG} must not create or modify tables, RLS policies, or triggers. ` +
    `It should only: create the pgcrypto extension and replace the four hash ` +
    `functions. Any broader change risks side effects on the audit chain and ` +
    `security posture.`,
  )
})

// ─── 17. Package.json ────────────────────────────────────────────────────────

await test('17. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('audit-pgcrypto-schema.test.ts'),
    `package.json npm test script must include 'audit-pgcrypto-schema.test.ts'.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Audit pgcrypto Schema Fix Tests')
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

main()
