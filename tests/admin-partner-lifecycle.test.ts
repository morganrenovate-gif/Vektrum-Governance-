/**
 * Admin partner key lifecycle — static safety and coverage tests.
 *
 * Static source-parse checks — no live DB, no auth, no rendering.
 * Verifies that the admin partner key lifecycle UI and API routes implement
 * all required security properties without exposing secrets.
 *
 * Checks:
 *  1.  Admin partner UI page exists at correct path.
 *  2.  Partner list API route (GET) exists.
 *  3.  Partner PATCH route exists.
 *  4.  GET /api/admin/partners does not SELECT api_key_hash.
 *  5.  GET /api/admin/partners does not SELECT webhook_signing_secret.
 *  6.  GET /api/admin/partners/[id] does not SELECT api_key_hash.
 *  7.  GET /api/admin/partners/[id] does not SELECT webhook_signing_secret.
 *  8.  UI page does not render api_key_hash in template output.
 *  9.  UI page does not render webhook_signing_secret in static template.
 * 10.  NewCredentialsModal shows one-time warning ("cannot be recovered").
 * 11.  NewCredentialsModal shows full key via CredentialBox — revealed on demand only.
 * 12.  POST route requires getAuthUser.
 * 13.  POST route requires requireRole('admin').
 * 14.  POST route requires requireMFA.
 * 15.  PATCH route requires getAuthUser.
 * 16.  PATCH route requires requireRole('admin').
 * 17.  PATCH route requires requireMFA.
 * 18.  PATCH route requires justification for destructive actions (min 20 chars).
 * 19.  PATCH route uses logAdminAudit for rotate_key and rotate_secret.
 * 20.  PATCH route uses logAdminAudit for revoke action.
 * 21.  generatePartnerApiKey produces vkp_live_ or vkp_test_ prefix.
 * 22.  generatePartnerApiKey stores SHA-256 hash, not plaintext key in DB.
 * 23.  INSERT to partners never includes fullKey — only hash and prefix.
 * 24.  Revoke action sets is_active=false, does not call .delete() on partners.
 * 25.  Deactivate toggle sets is_active=false, does not call .delete() on partners.
 * 26.  ConfirmInline for rotate/revoke has requireJustification prop.
 * 27.  Admin partner route is under /api/admin/ (not public surface).
 * 28.  No middleware pass-through added for partner admin routes.
 * 29.  Partner auth still checks api_key_hash via SHA-256 (not plaintext).
 * 30.  Revoke audit action name is 'partner_key_revoked' (distinct from deactivate).
 *
 * Run:  npx tsx tests/admin-partner-lifecycle.test.ts
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

/** Strip JS/TS comments and string literals to check for structural code patterns. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')          // block comments
    .replace(/\/\/[^\n]*/g, '')                // line comments
    .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, '')  // single-quoted strings
    .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '')  // double-quoted strings
    .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, '')  // template literals
}

const PAGE      = 'src/app/(app)/dashboard/admin/partners/page.tsx'
const LIST_ROUTE = 'src/app/api/admin/partners/route.ts'
const PATCH_ROUTE = 'src/app/api/admin/partners/[partnerId]/route.ts'
const PARTNER_AUTH = 'src/lib/auth/partner.ts'
const MIDDLEWARE   = 'src/middleware.ts'

async function main() {

// ─── 1–3. File existence ──────────────────────────────────────────────────────

await test('1. Admin partner UI page exists', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, PAGE)),
    `${PAGE} does not exist. Admin partner lifecycle UI is missing.`,
  )
})

await test('2. Partner list API route exists', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, LIST_ROUTE)),
    `${LIST_ROUTE} does not exist.`,
  )
})

await test('3. Partner PATCH route exists', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, PATCH_ROUTE)),
    `${PATCH_ROUTE} does not exist.`,
  )
})

// ─── 4–7. API routes never SELECT secret columns ─────────────────────────────

await test('4. GET /api/admin/partners does not SELECT api_key_hash', () => {
  const src = read(LIST_ROUTE)
  // Only .select() calls must not expose api_key_hash.
  // The POST route legitimately inserts api_key_hash — we only forbid it in SELECT.
  const selectBlocks = src.match(/\.select\([^)]+\)/g) ?? []
  for (const s of selectBlocks) {
    assert(
      !s.includes('api_key_hash'),
      `${LIST_ROUTE} has a .select() that includes api_key_hash. ` +
      'The hash is a security primitive — return only api_key_prefix for display.',
    )
  }
})

await test('5. GET /api/admin/partners does not SELECT webhook_signing_secret', () => {
  const src = read(LIST_ROUTE)
  // GET route must not select the secret — POST route inserts it but must not return it
  // We check the SELECT strings only; INSERT of new secret on POST is expected
  const selectBlock = src.match(/\.select\([^)]+\)/g) ?? []
  for (const s of selectBlock) {
    assert(
      !s.includes('webhook_signing_secret'),
      `${LIST_ROUTE} has a .select() that includes webhook_signing_secret. Remove it.`,
    )
  }
})

await test('6. GET /api/admin/partners/[id] does not SELECT api_key_hash', () => {
  const src = read(PATCH_ROUTE)
  // Only the SELECT strings should not include api_key_hash
  const selectBlocks = src.match(/\.select\([^)]+\)/g) ?? []
  for (const s of selectBlocks) {
    assert(
      !s.includes('api_key_hash'),
      `${PATCH_ROUTE} has a .select() that includes api_key_hash. Remove it.`,
    )
  }
})

await test('7. GET /api/admin/partners/[id] does not SELECT webhook_signing_secret', () => {
  const src = read(PATCH_ROUTE)
  const selectBlocks = src.match(/\.select\([^)]+\)/g) ?? []
  for (const s of selectBlocks) {
    assert(
      !s.includes('webhook_signing_secret'),
      `${PATCH_ROUTE} has a .select() that includes webhook_signing_secret. Remove it.`,
    )
  }
})

// ─── 8–11. UI — no static secret rendering; one-time modal ────────────────────

await test('8. UI page does not statically render api_key_hash', () => {
  const src = read(PAGE)
  // api_key_hash should never appear in JSX template output or data binding in the UI.
  // Note: it must also never be in the Partner interface type's rendered fields.
  // We allow it in comments or type imports but not in live JSX bindings.
  // Simplest safe check: the string is absent from the page entirely — the Partner
  // type should not even include it (the API route strips it before returning).
  assert(
    !src.includes('api_key_hash'),
    `${PAGE} references api_key_hash. The field must be stripped server-side ` +
    'before reaching the client. Remove it from the Partner interface and all JSX.',
  )
})

await test('9. UI page does not statically render webhook_signing_secret in Partner interface', () => {
  // The Partner interface must not include webhook_signing_secret.
  // The secret IS shown in NewCredentialsModal for one-time display of a newly
  // generated value — that is correct. We only forbid it appearing in the
  // Partner type (which would mean it comes from the list/fetch API).
  const src = read(PAGE)
  const partnerInterfaceMatch = src.match(/interface Partner\s*\{[\s\S]*?\}/)
  if (partnerInterfaceMatch) {
    assert(
      !partnerInterfaceMatch[0].includes('webhook_signing_secret'),
      `${PAGE} — the Partner interface includes webhook_signing_secret. ` +
      'Existing secrets must never be returned by the list API or rendered in the partner card.',
    )
  }
})

await test('10. NewCredentialsModal has "cannot be recovered" one-time warning', () => {
  const src = read(PAGE)
  assert(
    src.includes('cannot be recovered'),
    `${PAGE} NewCredentialsModal must warn "cannot be recovered" — ` +
    'admins must understand this is a one-time display.',
  )
})

await test('11. NewCredentialsModal shows credentials via CredentialBox (reveal on demand)', () => {
  // CredentialBox hides the value behind a reveal toggle — the raw secret is
  // never just printed in plaintext without the admin explicitly clicking reveal.
  const src = read(PAGE)
  assert(
    src.includes('CredentialBox'),
    `${PAGE} must use a CredentialBox component (or equivalent) to hide the ` +
    'one-time credential value behind a reveal toggle rather than printing it plaintext.',
  )
  assert(
    src.includes('revealed') || src.includes('Reveal') || src.includes('Eye'),
    `${PAGE} credential display must include a reveal/hide toggle so ` +
    'the secret is not visible by default.',
  )
})

// ─── 12–17. Route auth guards ─────────────────────────────────────────────────

await test('12. POST route requires getAuthUser', () => {
  const src = read(LIST_ROUTE)
  assert(
    src.includes('getAuthUser'),
    `${LIST_ROUTE} POST handler must call getAuthUser to authenticate the session.`,
  )
})

await test('13. POST route requires requireRole("admin")', () => {
  const src = read(LIST_ROUTE)
  assert(
    /requireRole\s*\([^)]*['"]admin['"]/.test(src),
    `${LIST_ROUTE} POST handler must call requireRole(..., 'admin').`,
  )
})

await test('14. POST route requires requireMFA', () => {
  const src = read(LIST_ROUTE)
  assert(
    src.includes('requireMFA'),
    `${LIST_ROUTE} POST handler must call requireMFA — admin partner creation ` +
    'requires AAL2 MFA authentication.',
  )
})

await test('15. PATCH route requires getAuthUser', () => {
  const src = read(PATCH_ROUTE)
  assert(
    src.includes('getAuthUser'),
    `${PATCH_ROUTE} must call getAuthUser on every handler.`,
  )
})

await test('16. PATCH route requires requireRole("admin")', () => {
  const src = read(PATCH_ROUTE)
  assert(
    /requireRole\s*\([^)]*['"]admin['"]/.test(src),
    `${PATCH_ROUTE} must call requireRole(..., 'admin').`,
  )
})

await test('17. PATCH route requires requireMFA', () => {
  const src = read(PATCH_ROUTE)
  assert(
    src.includes('requireMFA'),
    `${PATCH_ROUTE} must call requireMFA — partner credential operations ` +
    'require AAL2 MFA authentication.',
  )
})

// ─── 18–20. Justification + logAdminAudit for destructive actions ──────────────

await test('18. PATCH route requires justification (min 20 chars) for destructive actions', () => {
  const src = read(PATCH_ROUTE)
  assert(
    src.includes('justification') &&
    (src.includes('length < 20') || src.includes('minJustificationLen') || src.includes('.length < 20')),
    `${PATCH_ROUTE} must validate that justification has at least 20 characters ` +
    'for rotate_key, rotate_secret, and revoke operations.',
  )
})

await test('19. PATCH route uses logAdminAudit for rotate_key and rotate_secret', () => {
  const src = read(PATCH_ROUTE)
  assert(
    src.includes('logAdminAudit'),
    `${PATCH_ROUTE} must import and call logAdminAudit for rotate_key and rotate_secret — ` +
    'credential rotation must be dual-written to admin_audit_log with justification.',
  )
  assert(
    src.includes("'rotate_key'") || src.includes('"rotate_key"'),
    `${PATCH_ROUTE} must reference 'rotate_key' action string.`,
  )
  assert(
    src.includes("'rotate_secret'") || src.includes('"rotate_secret"'),
    `${PATCH_ROUTE} must reference 'rotate_secret' action string.`,
  )
})

await test('20. PATCH route uses logAdminAudit for revoke action', () => {
  const src = read(PATCH_ROUTE)
  // logAdminAudit must be called for revoke — check that it's present near partner_key_revoked
  assert(
    src.includes('logAdminAudit') && src.includes('partner_key_revoked'),
    `${PATCH_ROUTE} must call logAdminAudit with action 'partner_key_revoked'. ` +
    'Revocation must be dual-logged to admin_audit_log with mandatory justification.',
  )
  assert(
    src.includes('admin_justification'),
    `${PATCH_ROUTE} must pass admin_justification to logAdminAudit.`,
  )
})

// ─── 21–23. Key generation and storage ───────────────────────────────────────

await test('21. generatePartnerApiKey produces vkp_live_ or vkp_test_ prefix', () => {
  const src = read(PARTNER_AUTH)
  assert(
    src.includes('vkp_live_') || src.includes('vkp_${env}_'),
    `${PARTNER_AUTH} must generate keys with vkp_live_ or vkp_test_ prefix.`,
  )
  assert(
    src.includes('vkp_test_') || src.includes('vkp_${env}_'),
    `${PARTNER_AUTH} must generate test keys with vkp_test_ prefix.`,
  )
})

await test('22. generatePartnerApiKey derives SHA-256 hash from the full key', () => {
  const src = read(PARTNER_AUTH)
  assert(
    src.includes("'sha256'") || src.includes('"sha256"'),
    `${PARTNER_AUTH} must use SHA-256 to hash the partner key. ` +
    'Only the hash is stored — the plaintext key is shown once and discarded.',
  )
  assert(
    src.includes('createHash'),
    `${PARTNER_AUTH} must use createHash from the node:crypto module.`,
  )
})

await test('23. INSERT to partners stores hash and prefix, not plaintext fullKey', () => {
  const src = read(LIST_ROUTE)
  // The POST route must insert api_key_hash (the derived hash) and api_key_prefix
  // but must NOT insert the fullKey plaintext into the database.
  assert(
    src.includes('api_key_hash') && src.includes('api_key_prefix'),
    `${LIST_ROUTE} POST must insert api_key_hash and api_key_prefix into partners table.`,
  )
  // fullKey must NOT appear as a column in the insert — only hash and prefix
  const insertBlock = src.match(/\.insert\s*\(\s*\{[\s\S]*?\}\s*\)/)?.[0] ?? ''
  assert(
    !insertBlock.includes('fullKey'),
    `${LIST_ROUTE} INSERT must not include fullKey (plaintext). Only hash and prefix are stored.`,
  )
})

// ─── 24–25. Revoke and deactivate — no record deletion ────────────────────────

await test('24. Revoke action sets is_active=false — does not delete partner record', () => {
  const src = read(PATCH_ROUTE)
  // Revoke must update is_active to false (preserving the record and audit history)
  // and must not call .delete() on the partners table.
  assert(
    src.includes('is_active: false') || src.includes("is_active: 'false'"),
    `${PATCH_ROUTE} revoke action must set is_active to false.`,
  )
  // Check code-only (stripping strings) to ensure no .delete() call exists
  const code = codeOnly(src)
  const deleteOnPartners = /\.from\s*\(\s*\)\s*\.delete\s*\(/.test(code)
  assert(
    !deleteOnPartners,
    `${PATCH_ROUTE} must not call .delete() on any table — ` +
    'partner records and their audit history must be preserved.',
  )
})

await test('25. Deactivate toggle sets is_active=false — does not delete partner record', () => {
  // Toggle deactivation flows through the same PATCH route; same constraint applies.
  const src = read(PATCH_ROUTE)
  assert(
    src.includes('is_active'),
    `${PATCH_ROUTE} must handle is_active field updates.`,
  )
  // Verify no DELETE at the route level
  assert(
    !src.includes('.delete('),
    `${PATCH_ROUTE} must not have any .delete() call. Partner records must be retained.`,
  )
})

// ─── 26. UI justification in ConfirmInline ────────────────────────────────────

await test('26. ConfirmInline for destructive actions has requireJustification prop', () => {
  const src = read(PAGE)
  assert(
    src.includes('requireJustification'),
    `${PAGE} must pass requireJustification to the ConfirmInline for rotate key, ` +
    'rotate secret, and revoke — these are logged to admin_audit_log.',
  )
  // All three dangerous actions must have it
  const rotateKeyBlock = src.match(/confirmRotateKey.*?ConfirmInline[\s\S]*?\/>/)?.[0] ?? ''
  const rotateSecBlock = src.match(/confirmRotateSec.*?ConfirmInline[\s\S]*?\/>/)?.[0] ?? ''
  const revokeBlock    = src.match(/confirmRevoke.*?ConfirmInline[\s\S]*?\/>/)?.[0]    ?? ''

  const hasRotateKeyJustif = rotateKeyBlock.includes('requireJustification') || src.includes('rotateKeyJustif')
  const hasRotateSecJustif = rotateSecBlock.includes('requireJustification') || src.includes('rotateSecJustif')
  const hasRevokeJustif    = revokeBlock.includes('requireJustification')    || src.includes('revokeJustif')

  assert(hasRotateKeyJustif, `${PAGE} rotate-key confirm must use justification state.`)
  assert(hasRotateSecJustif, `${PAGE} rotate-secret confirm must use justification state.`)
  assert(hasRevokeJustif,    `${PAGE} revoke confirm must use justification state.`)
})

// ─── 27–28. No public surface ─────────────────────────────────────────────────

await test('27. Admin partner routes are under /api/admin/ (not public)', () => {
  // Verify both routes are under src/app/api/admin/ not src/app/api/ directly
  assert(
    fs.existsSync(path.resolve(ROOT, 'src/app/api/admin/partners/route.ts')),
    'Partner list route must be under /api/admin/partners/ — not a public endpoint.',
  )
  assert(
    fs.existsSync(path.resolve(ROOT, 'src/app/api/admin/partners/[partnerId]/route.ts')),
    'Partner PATCH route must be under /api/admin/partners/[partnerId]/ — not a public endpoint.',
  )
})

await test('28. Middleware has no pass-through for /api/admin/partners', () => {
  // The middleware must NOT add a bypass for /api/admin/partners —
  // these routes authenticate themselves via getAuthUser + requireRole + requireMFA.
  // A bypass would short-circuit all those checks.
  const src = read(MIDDLEWARE)
  assert(
    !src.includes('/api/admin/partners'),
    `${MIDDLEWARE} must not add a pass-through for /api/admin/partners. ` +
    'Admin partner routes enforce auth themselves.',
  )
})

// ─── 29–30. Partner auth integrity ────────────────────────────────────────────

await test('29. Partner auth compares SHA-256 hash of incoming key — not plaintext', () => {
  const src = read(PARTNER_AUTH)
  assert(
    src.includes('api_key_hash') && src.includes('sha256'),
    `${PARTNER_AUTH} must hash the incoming Bearer token with SHA-256 and look up by api_key_hash. ` +
    'Plaintext key comparison is forbidden.',
  )
  // Verify it uses .eq('api_key_hash', ...) not a plaintext lookup
  assert(
    src.includes("eq('api_key_hash'") || src.includes('eq("api_key_hash"'),
    `${PARTNER_AUTH} must look up the partner by .eq('api_key_hash', keyHash).`,
  )
})

await test('30. Revoke audit action is "partner_key_revoked" — distinct from toggle deactivate', () => {
  const src = read(PATCH_ROUTE)
  assert(
    src.includes('partner_key_revoked'),
    `${PATCH_ROUTE} must use 'partner_key_revoked' as the audit action for revoke — ` +
    'this is distinct from a temporary is_active toggle so ops can see partnership terminations.',
  )
  // The toggle (is_active update) must use a different action name
  assert(
    src.includes('partner_updated'),
    `${PATCH_ROUTE} must use 'partner_updated' (or similar) for non-revoke updates ` +
    "so 'partner_key_revoked' is a clean signal for terminated partnerships.",
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Admin Partner Key Lifecycle Tests')
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
