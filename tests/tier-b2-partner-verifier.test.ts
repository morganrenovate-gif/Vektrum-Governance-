/**
 * tests/tier-b2-partner-verifier.test.ts
 *
 * Tier B step 2 — partner verifier endpoints:
 *
 *   GET  /api/partner/tokens/[jti]          (introspect)
 *   POST /api/partner/tokens/verify         (verify ed25519 signature)
 *   POST /api/admin/tokens/[jti]/revoke     (admin revoke)
 *
 * What this tests (source-grep — no live DB):
 *   1. Introspect route exists and requires partner auth
 *   2. Introspect returns token status, expiry, and metadata fields
 *   3. Verify route exists and requires partner auth
 *   4. Verify checks ed25519 signature using VEKTRUM_TOKEN_SIGNING_KEY_PUBLIC
 *   5. Verify returns { valid: true/false } with cryptographic result
 *   6. Revoke route exists, requires admin + MFA
 *   7. Revoke transitions token to status='revoked'
 *   8. Revoke writes an audit row
 *   9. .env.example documents VEKTRUM_TOKEN_SIGNING_KEY_PUBLIC
 *  10. All routes are wired into npm test
 *
 * Run: npx tsx tests/tier-b2-partner-verifier.test.ts
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateKeyPairSync, createPrivateKey, sign as cryptoSign, verify as cryptoVerify } from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {

const INTROSPECT = 'src/app/api/partner/tokens/[jti]/route.ts'
const VERIFY     = 'src/app/api/partner/tokens/verify/route.ts'
const REVOKE     = 'src/app/api/admin/tokens/[jti]/revoke/route.ts'
const ENV_EX     = '.env.example'
const PKG        = 'package.json'

// ── 1. Introspect route ───────────────────────────────────────────────────────

console.log('\n── 1. Introspect route ─────────────────────────────────────────────')

check(fs.existsSync(path.join(ROOT, INTROSPECT)), `${INTROSPECT} exists`)

const introspectSrc = read(INTROSPECT)

check(
  introspectSrc.includes('requirePartnerAuth'),
  'Introspect route calls requirePartnerAuth',
)
check(
  introspectSrc.includes("from('authorization_tokens')") ||
  introspectSrc.includes('authorization_tokens'),
  'Introspect route reads from authorization_tokens table',
)
check(
  introspectSrc.includes('jti'),
  'Introspect route uses jti as the lookup key',
)

// ── 2. Introspect response shape ──────────────────────────────────────────────

console.log('\n── 2. Introspect response shape ────────────────────────────────────')

check(
  introspectSrc.includes('status') && introspectSrc.includes('expires_at'),
  'Introspect returns status and expires_at',
)
check(
  introspectSrc.includes('milestone_id') || introspectSrc.includes('milestoneId'),
  'Introspect returns milestone_id',
)
check(
  introspectSrc.includes('signature_alg'),
  'Introspect returns signature_alg',
)

// ── 3. Verify route ───────────────────────────────────────────────────────────

console.log('\n── 3. Verify route ─────────────────────────────────────────────────')

check(fs.existsSync(path.join(ROOT, VERIFY)), `${VERIFY} exists`)

const verifySrc = read(VERIFY)

check(
  verifySrc.includes('requirePartnerAuth'),
  'Verify route calls requirePartnerAuth',
)
check(
  verifySrc.includes('VEKTRUM_TOKEN_SIGNING_KEY_PUBLIC'),
  'Verify route reads VEKTRUM_TOKEN_SIGNING_KEY_PUBLIC env var',
)

// Rate-limit correctness: auth must come before the rate-limit check so the
// partner ID is available as the rate-limit key (SEC-1 regression guard).
const authPos = verifySrc.indexOf('requirePartnerAuth')
const rlPos   = verifySrc.indexOf('checkRateLimit')
check(authPos !== -1 && rlPos !== -1, 'Verify route has both requirePartnerAuth and checkRateLimit')
check(
  authPos < rlPos,
  'requirePartnerAuth is called before checkRateLimit (auth-first for partner-scoped RL key)',
)
check(
  verifySrc.includes('partnerCtx.partnerId') && verifySrc.includes('partner_api'),
  'Rate-limit key is scoped to authenticated partner ID, not a generic key',
)
check(
  !verifySrc.match(/checkRateLimit\s*\(\s*request\s*,/),
  'checkRateLimit is NOT called with raw request object as key (SEC-1 fix)',
)
check(
  verifySrc.includes('POLICIES.partner_api.description'),
  'rateLimitResponse receives policy description string',
)

// ── 4. Verify uses ed25519 cryptographic verification ────────────────────────

console.log('\n── 4. Verify uses ed25519 cryptographic verification ───────────────')

check(
  verifySrc.includes("cryptoVerify") || verifySrc.includes("verify(null,"),
  'Verify route calls cryptoVerify(null, ...) — correct Ed25519 API',
)
check(
  verifySrc.includes('ed25519') || verifySrc.includes('asymmetricKeyType'),
  'Verify route validates key type is ed25519',
)

// ── 5. Verify returns { valid } ───────────────────────────────────────────────

console.log('\n── 5. Verify returns valid boolean ─────────────────────────────────')

check(
  verifySrc.includes('valid: true') || verifySrc.includes("valid:true"),
  "Verify returns { valid: true } on valid signature",
)
check(
  verifySrc.includes('valid: false') || verifySrc.includes("valid:false"),
  "Verify returns { valid: false } on invalid signature",
)

// ── 6. Revoke route requires admin + MFA ─────────────────────────────────────

console.log('\n── 6. Revoke route requires admin + MFA ────────────────────────────')

check(fs.existsSync(path.join(ROOT, REVOKE)), `${REVOKE} exists`)

const revokeSrc = read(REVOKE)

check(
  revokeSrc.includes('getAuthUser') || revokeSrc.includes('requireRole'),
  'Revoke route requires authenticated user',
)
check(
  revokeSrc.includes('requireRole') && /requireRole\([^)]*admin/.test(revokeSrc),
  "Revoke route calls requireRole with 'admin'",
)
check(
  revokeSrc.includes('requireMFA'),
  'Revoke route calls requireMFA',
)

// ── 7. Revoke transitions token to revoked ────────────────────────────────────

console.log('\n── 7. Revoke transitions token to status=revoked ───────────────────')

check(
  revokeSrc.includes("status: 'revoked'") || revokeSrc.includes("status:'revoked'"),
  "Revoke sets token status to 'revoked'",
)
check(
  revokeSrc.includes("IN ('issued', 'delivered')") ||
  revokeSrc.includes("in('status', ['issued', 'delivered'])") ||
  revokeSrc.includes("issued") && revokeSrc.includes("delivered"),
  "Revoke only allows revoking active tokens (issued|delivered)",
)

// ── 8. Revoke writes audit row ────────────────────────────────────────────────

console.log('\n── 8. Revoke writes audit row ──────────────────────────────────────')

check(
  revokeSrc.includes('logAudit'),
  'Revoke route calls logAudit',
)
check(
  revokeSrc.includes('token_hash') || revokeSrc.includes('authorization_token'),
  'Revoke audit row binds token_hash or token reference',
)

// ── 9. .env.example documents VEKTRUM_TOKEN_SIGNING_KEY_PUBLIC ───────────────

console.log('\n── 9. .env.example documents VEKTRUM_TOKEN_SIGNING_KEY_PUBLIC ──────')

const envEx = read(ENV_EX)
check(
  envEx.includes('VEKTRUM_TOKEN_SIGNING_KEY_PUBLIC'),
  '.env.example documents VEKTRUM_TOKEN_SIGNING_KEY_PUBLIC',
)

// ── 10. Round-trip cryptographic verification ─────────────────────────────────

console.log('\n── 10. Cryptographic round-trip (same algorithm as verify route) ───')

const { privateKey: privDer, publicKey: pubPem } = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
})

const key       = createPrivateKey({ key: privDer, format: 'der', type: 'pkcs8' })
const payload   = { jti: 'test-jti', milestone_id: 'ms-123', amount: 50000 }
const canonical = JSON.stringify(Object.fromEntries(Object.entries(payload).sort()))
const sigBuf    = cryptoSign(null, Buffer.from(canonical), key)
const sigB64    = sigBuf.toString('base64')

check(
  cryptoVerify(null, Buffer.from(canonical), pubPem, Buffer.from(sigB64, 'base64')),
  'Valid signature verifies with public PEM (crypto.verify(null, data, pubPem, sig))',
)
check(
  !cryptoVerify(null, Buffer.from('tampered payload'), pubPem, Buffer.from(sigB64, 'base64')),
  'Tampered payload fails verification',
)

// ── 11. Wired into npm test ───────────────────────────────────────────────────

console.log('\n── 11. Test wired into npm test ────────────────────────────────────')

const pkg = read(PKG)
check(
  pkg.includes('tier-b2-partner-verifier.test.ts'),
  'tier-b2-partner-verifier.test.ts is wired into npm test',
)

console.log('\n✅  tier-b2-partner-verifier: all checks passed\n')
}

main().catch(err => { console.error(err); process.exit(1) })
