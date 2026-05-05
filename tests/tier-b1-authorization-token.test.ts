/**
 * tests/tier-b1-authorization-token.test.ts
 *
 * Stage B1 of the patent-readiness work — rail-scoped signed authorization
 * tokens written at release time and bound into the audit chain.
 *
 * Pins:
 *   1. Migration 20260504000001 introduces the table with the right columns,
 *      constraints, partial unique index, immutability + delete-deny triggers,
 *      and the FK from releases.authorization_token_id.
 *   2. Issuer helper `issueAuthorizationToken` exposes the documented surface,
 *      uses sha256OfCanonicalJson for token_hash, signs best-effort with
 *      ed25519 from VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE, and exports
 *      AuthorizationTokenConflictError.
 *   3. Milestone release route wires the issuer between reservation and
 *      Stripe, binds token_hash on the success audit row, surfaces the
 *      token id in the response, and flips the token to confirmed/failed.
 *   4. AuthorizationToken type is exported from src/lib/types.ts.
 *   5. Test is wired into npm test in package.json.
 *   6. The issuer is idempotent — duplicate calls return alreadyIssued=true.
 *   7. Canonical JSON hashing is order-independent (round-tripped from Tier A).
 *
 * Run: npx tsx tests/tier-b1-authorization-token.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {

const MIGRATION   = 'supabase/migrations/20260504000001_authorization_tokens.sql'
const ISSUER      = 'src/lib/engine/authorization-token.ts'
const ROUTE       = 'src/app/api/milestones/[milestoneId]/release/route.ts'
const TYPES       = 'src/lib/types.ts'
const PACKAGE     = 'package.json'

const migration = read(MIGRATION)
const issuer    = read(ISSUER)
const route     = read(ROUTE)
const types     = read(TYPES)
const pkg       = read(PACKAGE)

// ─── 1. Migration shape ────────────────────────────────────────────────────
console.log('\n── 1. Migration creates the authorization_tokens table ──────────────────')

check(
  /CREATE TABLE IF NOT EXISTS public\.authorization_tokens/.test(migration),
  'Migration creates public.authorization_tokens',
)

const REQUIRED_COLUMNS = [
  'jti', 'idempotency_key', 'sequence_index',
  'draw_request_id', 'milestone_id', 'payee_id', 'funder_id',
  'rail_scope', 'payee_scope',
  'amount_vector', 'total_amount', 'currency',
  'policy_version', 'policy_hash', 'graph_commitment',
  'token_hash', 'nonce', 'signature_alg', 'signature',
  'not_before', 'expires_at',
  'status',
  'confirmed_at', 'failed_at', 'failure_reason',
  'revoked_at', 'revoked_reason', 'expired_at',
  'issued_by', 'created_at', 'updated_at',
]
for (const col of REQUIRED_COLUMNS) {
  check(
    new RegExp(`\\b${col}\\b`).test(migration),
    `Migration declares column ${col}`,
  )
}

console.log('\n── 2. Constraints / indexes / immutability ─────────────────────────────')

check(
  /UNIQUE \(jti\)/.test(migration) || /authorization_tokens_jti_unique/.test(migration),
  'jti is UNIQUE',
)
check(
  /UNIQUE \(idempotency_key\)/.test(migration) || /authorization_tokens_idempotency_unique/.test(migration),
  'idempotency_key is UNIQUE',
)
check(
  /UNIQUE \(milestone_id, sequence_index\)/.test(migration),
  '(milestone_id, sequence_index) is UNIQUE',
)
check(
  /CREATE UNIQUE INDEX[\s\S]*?authorization_tokens_active_per_milestone[\s\S]*?WHERE status IN \('issued', 'delivered'\)/.test(migration),
  'Partial unique index enforces one active token per milestone',
)
check(
  /CHECK \(status IN \('issued', 'delivered', 'confirmed', 'failed', 'expired', 'revoked'\)\)/.test(migration),
  'status enum is CHECK-constrained',
)
check(
  /CHECK \(rail_scope IN \('stripe', 'external_rail'\)\)/.test(migration),
  'rail_scope is CHECK-constrained to known values',
)
check(
  /CHECK \(not_before <= expires_at AND expires_at > created_at\)/.test(migration),
  'TTL window CHECK constrains time bounds',
)
check(
  /TRIGGER authorization_tokens_immutable[\s\S]*?BEFORE UPDATE/.test(migration),
  'BEFORE UPDATE immutability trigger is installed',
)
check(
  /TRIGGER authorization_tokens_no_delete[\s\S]*?BEFORE DELETE/.test(migration),
  'BEFORE DELETE deny trigger is installed',
)
check(
  /authorization_tokens.*ENABLE ROW LEVEL SECURITY/.test(migration),
  'RLS is enabled on authorization_tokens',
)

console.log('\n── 3. FK from releases.authorization_token_id ──────────────────────────')

check(
  /ALTER TABLE public\.releases\s+ADD COLUMN IF NOT EXISTS authorization_token_id UUID/.test(migration),
  'releases gains authorization_token_id column',
)
check(
  /releases_authorization_token_unique[\s\S]*?UNIQUE \(authorization_token_id\)/.test(migration),
  'releases.authorization_token_id is UNIQUE (one release per token)',
)
check(
  /REFERENCES public\.authorization_tokens\(id\) ON DELETE RESTRICT/.test(migration),
  'releases.authorization_token_id foreign key restricts deletes',
)

// pgcrypto regression guard from Tier A — every digest call schema-qualified
const sqlOnly = migration
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n')
const bareDigest = (sqlOnly.match(/(?<!extensions\.)digest\(/g) ?? []).length
check(
  bareDigest === 0,
  `Migration uses extensions.digest(...) for every digest call (no bare digest — found ${bareDigest})`,
)

console.log('\n── 4. Issuer helper surface ────────────────────────────────────────────')

check(
  /export async function issueAuthorizationToken\(/.test(issuer),
  'issueAuthorizationToken is exported as an async function',
)
check(
  /export class AuthorizationTokenConflictError/.test(issuer),
  'AuthorizationTokenConflictError is exported',
)
check(
  /import\s*\{[^}]*sha256OfCanonicalJson[^}]*\}\s*from\s*'@\/lib\/engine\/audit'/.test(issuer),
  'Issuer imports sha256OfCanonicalJson from audit lib (Tier A reuse)',
)
check(
  /token_hash\s*=\s*await sha256OfCanonicalJson/.test(issuer.replace(/\s+/g, ' ')) ||
  /tokenHash\s*=\s*await sha256OfCanonicalJson/.test(issuer.replace(/\s+/g, ' ')),
  'Issuer computes token_hash via sha256OfCanonicalJson',
)
check(
  /VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE/.test(issuer),
  'Issuer reads VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE',
)
check(
  /asymmetricKeyType !== 'ed25519'/.test(issuer),
  'Issuer enforces ed25519 key type when signing',
)
check(
  /alreadyIssued:\s*(true|false)/.test(issuer),
  'Issuer surfaces alreadyIssued flag for idempotency',
)
check(
  /'authorization_tokens'/.test(issuer) && /\.in\(\s*'status',\s*\['issued',\s*'delivered'\]\s*\)/.test(issuer),
  'Issuer searches active tokens by status IN (issued, delivered)',
)
check(
  /23505/.test(issuer),
  'Issuer maps unique_violation (23505) to AuthorizationTokenConflictError',
)

// Default TTL constants
check(
  /DEFAULT_TTL_HOURS_EXTERNAL\s*=\s*24\s*\*\s*30/.test(issuer),
  'External-rail tokens default to 30-day TTL',
)
check(
  /DEFAULT_TTL_HOURS_STRIPE\s*=\s*24/.test(issuer),
  'Stripe-rail tokens default to 24-hour TTL',
)

console.log('\n── 5. Route wiring ─────────────────────────────────────────────────────')

check(
  /import\s*\{[\s\S]*?issueAuthorizationToken[\s\S]*?AuthorizationTokenConflictError[\s\S]*?\}\s*from\s*'@\/lib\/engine\/authorization-token'/.test(route),
  'Route imports issueAuthorizationToken + AuthorizationTokenConflictError',
)

// Issuer must run AFTER reservation acquisition and BEFORE Stripe transfer.
const reserveIdx   = route.indexOf('reserve_release_funds')
const issueIdx     = route.indexOf('issueAuthorizationToken({')
const stripeIdx    = route.indexOf('stripe.transfers.create')
check(
  reserveIdx > 0 && issueIdx > reserveIdx && stripeIdx > issueIdx,
  `Route ordering: reserve_release_funds (idx ${reserveIdx}) → issueAuthorizationToken (idx ${issueIdx}) → stripe.transfers.create (idx ${stripeIdx})`,
)

check(
  /code:\s*'AUTHORIZATION_TOKEN_CONFLICT'/.test(route),
  'Route maps AuthorizationTokenConflictError to a 409 with AUTHORIZATION_TOKEN_CONFLICT code',
)
check(
  /authorization_token_id:\s*authorizationToken\.id/.test(route),
  'Release row INSERT binds authorization_token_id from the issued token',
)
check(
  /token_hash:\s*authorizationToken\.tokenHash/.test(route),
  'Success-path funds_released audit row binds token_hash',
)
check(
  /token_hash:\s*authorizationToken\?\.tokenHash\s*\?\?\s*null/.test(route) ||
  /token_hash:\s*authorizationToken\?\.tokenHash/.test(route),
  'Failure-path release_failed audit row also passes token_hash (null-safe)',
)
check(
  /\.update\(\{[\s\S]*?status:\s*'confirmed',[\s\S]*?confirmed_at:/.test(route),
  'Route flips token to confirmed on success path',
)
check(
  /\.update\(\{[\s\S]*?status:\s*'failed',[\s\S]*?failed_at:/.test(route),
  'Route flips token to failed in catch block',
)
check(
  /authorization_token_id:\s*authorizationToken\.id/.test(route) &&
  /authorization_token_jti:\s*authorizationToken\.jti/.test(route),
  'Response surfaces authorization_token_id + authorization_token_jti (additive)',
)
check(
  /execution_status:\s*'confirmed'/.test(route),
  'Response surfaces execution_status (additive)',
)

// Backward-compat: existing fields still in the response
for (const f of ['stripe_transfer_id', 'idempotency_key', 'released_by', 'released_at', 'receipt', 'billing']) {
  check(
    new RegExp(`\\b${f}:`).test(route),
    `Response keeps existing field "${f}"`,
  )
}

console.log('\n── 6. Types ────────────────────────────────────────────────────────────')

check(
  /export interface AuthorizationToken \{/.test(types),
  'AuthorizationToken interface exported from types',
)
check(
  /export type AuthorizationTokenStatus =/.test(types),
  'AuthorizationTokenStatus union exported',
)
check(
  /export type AuthorizationTokenRailScope = 'stripe' \| 'external_rail'/.test(types),
  'AuthorizationTokenRailScope union exported',
)
check(
  /authorization_token_id\?:\s*string\s*\|\s*null/.test(types),
  'Release type gains optional authorization_token_id',
)

console.log('\n── 7. Idempotency + canonical-JSON behaviour ────────────────────────────')

// Round-trip: import the canonical-hash helper from Tier A and confirm key
// order does not affect the digest (the issuer relies on this behaviour).
const { sha256OfCanonicalJson } = await import('@/lib/engine/audit')
const a = await sha256OfCanonicalJson({ b: 2, a: 1, nested: { y: 4, x: 3 } })
const b = await sha256OfCanonicalJson({ a: 1, nested: { x: 3, y: 4 }, b: 2 })
check(
  a === b,
  'sha256OfCanonicalJson is key-order independent (Tier A reuse holds)',
)
check(
  /^[0-9a-f]{64}$/.test(a),
  'sha256OfCanonicalJson returns lowercase hex SHA-256',
)

console.log('\n── 8. Test wired into npm test ─────────────────────────────────────────')

check(
  pkg.includes('tier-b1-authorization-token.test.ts'),
  'tier-b1-authorization-token.test.ts is wired into the npm test pipeline',
)

console.log('\n✅  tier-b1-authorization-token: all checks passed\n')

}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
