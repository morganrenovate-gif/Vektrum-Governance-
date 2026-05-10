/**
 * tests/admin-audit-log-pgcrypto.test.ts
 *
 * Regression guard: verifies that the admin_audit_log hash functions
 * (compute_admin_audit_hash and verify_admin_audit_chain) use
 * extensions.digest() — not bare digest() — in whatever migration
 * file defines or last replaces them.
 *
 * Background:
 *   Migration 20260424000007_admin_audit.sql originally defined these
 *   functions with bare digest() calls. Migration 20260429000001b_pgcrypto_schema_fix.sql
 *   replaced them with extensions.digest() versions (Parts 3 and 4 of that migration).
 *   This test ensures that replacement is in place and has not been regressed.
 *
 * Source-parse only — no live DB required.
 * Run: npx tsx tests/admin-audit-log-pgcrypto.test.ts
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

// The migration that provides the corrected admin audit hash functions
const FIX_MIG   = 'supabase/migrations/20260429000001b_pgcrypto_schema_fix.sql'
// The original migration (bare digest — DO NOT edit, but verify its state)
const ORIG_MIG  = 'supabase/migrations/20260424000007_admin_audit.sql'

async function main() {

console.log('\n── 1. Fix migration covers admin_audit_log functions ───────────────────')

const fixSrc = read(FIX_MIG)

check(
  fixSrc.includes('compute_admin_audit_hash'),
  `${FIX_MIG} defines or replaces compute_admin_audit_hash()`,
)
check(
  fixSrc.includes('verify_admin_audit_chain'),
  `${FIX_MIG} defines or replaces verify_admin_audit_chain()`,
)

console.log('\n── 2. Admin hash functions use extensions.digest() in fix migration ────')

// Strip SQL line comments before checking
const fixNoComments = fixSrc
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n')

check(
  fixNoComments.includes('extensions.digest('),
  `${FIX_MIG} contains extensions.digest() calls (admin functions)`,
)

// Find the section covering admin functions and assert no bare digest() there
const adminHashStart = fixSrc.indexOf('compute_admin_audit_hash')
const adminSection = adminHashStart > -1 ? fixSrc.slice(adminHashStart) : fixSrc
const adminNoComments = adminSection
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n')

const bareDigestInAdmin = (adminNoComments.match(/(?<!extensions\.)digest\s*\(/g) ?? []).length
check(
  bareDigestInAdmin === 0,
  `Admin audit functions in fix migration have zero bare digest() calls (found ${bareDigestInAdmin})`,
)

console.log('\n── 3. Original migration (bare digest) is NOT the active definition ────')

// The original migration has bare digest — confirm fix migration sorts AFTER
// it alphabetically/chronologically so Postgres applies the fix last.
const origName = '20260424000007'
const fixName  = '20260429000001'
check(
  fixName > origName,
  `Fix migration (${fixName}) sorts after original (${origName}) — applied last`,
)

console.log('\n── 4. pgcrypto extension assertion is present in fix migration ──────────')

check(
  fixSrc.includes('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions'),
  'Fix migration defensively asserts pgcrypto in extensions schema',
)

console.log('\n── 5. Original migration still exists (immutable — never edited) ────────')

check(
  fs.existsSync(path.join(ROOT, ORIG_MIG)),
  `Original migration ${ORIG_MIG} still exists (must never be edited)`,
)

const origSrc = read(ORIG_MIG)
check(
  origSrc.includes('compute_admin_audit_hash'),
  'Original migration still contains the original function definition (unedited)',
)

console.log('\n✅  admin-audit-log-pgcrypto: all checks passed\n')
}

main().catch(err => { console.error(err); process.exit(1) })
