/**
 * tests/docusign-recipient-view-fix.test.ts
 *
 * Pins the recipient-view identity-mismatch fix:
 *
 *   1. A shared resolver (src/lib/engine/docusign-signer-identity.ts) returns
 *      DocuSign signer identities (name + email + clientUserId + routingOrder)
 *      via the admin client (RLS-bypass) so cross-party reads always succeed.
 *   2. send-envelope and sign both call the resolver, so the envelope creation
 *      and the recipient-view request produce byte-identical (name + email +
 *      clientUserId) values for the same userId — DocuSign's embedded-signing
 *      identity match cannot fail on missing names anymore.
 *   3. The sign route logs safe diagnostic context on failure (envelope-id
 *      prefix only, role, has_funder_signed, has_contractor_signed,
 *      signer_email_present, truncated DocuSign error) and returns the spec's
 *      user-visible message ("Please refresh signing status and try again.").
 *   4. Existing access controls preserved:
 *        - admins cannot sign as a party
 *        - signed contracts → 409
 *        - voided contracts → 409
 *        - missing envelope → 503
 *        - contractor-before-funder is blocked with the existing copy
 *        - non-participants are blocked via requireDealAccess (403 path)
 *        - already-signed signer → 409
 *   5. No release-gate / Stripe / payment imports leaked into the sign route.
 *
 * Run: npx tsx tests/docusign-recipient-view-fix.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const RESOLVER     = 'src/lib/engine/docusign-signer-identity.ts'
const SEND_ROUTE   = 'src/app/api/deals/[dealId]/contract/send-envelope/route.ts'
const SIGN_ROUTE   = 'src/app/api/deals/[dealId]/contract/sign/route.ts'
const SIGNING_UI   = 'src/components/deal/contract-signing-section.tsx'
const PACKAGE_JSON = 'package.json'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel))
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {
  console.log('\ndocusign-recipient-view-fix.test.ts\n')

  // ── 1. Shared signer-identity resolver ─────────────────────────────────
  console.log('1. Shared signer-identity resolver')
  check(exists(RESOLVER), '  1a. src/lib/engine/docusign-signer-identity.ts exists')

  const resolver = read(RESOLVER)

  check(resolver.includes('export async function resolveSignerIdentity'),
    '  1b. exports resolveSignerIdentity')
  check(
    resolver.includes('createSupabaseAdminClient'),
    '  1c. resolver uses the admin client (RLS-bypass) for profile reads',
  )
  // Admin client used for BOTH auth.users and profiles
  check(
    resolver.includes('admin.auth.admin.getUserById'),
    '  1d. resolver fetches the auth user via admin.auth.admin.getUserById',
  )
  check(
    /from\s*\(\s*['"]profiles['"]\s*\)/.test(resolver),
    "  1e. resolver fetches profile from 'profiles'",
  )
  // Role-specific fallback names ('Funder' / 'Contractor'), NOT 'Signer'
  check(
    resolver.includes("'Funder'") && resolver.includes("'Contractor'"),
    '  1f. fallback names include "Funder" and "Contractor"',
  )
  // Strip block + line + JSX comments before checking — the resolver's
  // docstring intentionally documents the old buggy 'Signer' fallback.
  const resolverCode = resolver
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  check(
    !/['"]Signer['"]/.test(resolverCode),
    '  1g. resolver code does NOT use the generic "Signer" fallback',
  )
  // Routing-order map: funder → 1, contractor → 2
  check(
    /funder:\s*1/.test(resolver) && /contractor:\s*2/.test(resolver),
    '  1h. routingOrder: funder=1, contractor=2',
  )
  // Result discriminated union with `missing` reasons
  check(
    /missing:\s*['"]auth_user['"]/.test(resolver) &&
    /missing:\s*['"]email['"]/.test(resolver),
    '  1i. failure result reports missing="auth_user" / "email" reason for diagnostics',
  )

  // ── 2. Both routes call the resolver — same identity for both code paths ─
  console.log('\n2. Both routes call the shared resolver')
  const send = read(SEND_ROUTE)
  const sign = read(SIGN_ROUTE)

  check(
    send.includes('resolveSignerIdentity') &&
    send.includes('@/lib/engine/docusign-signer-identity'),
    '  2a. send-envelope imports + calls resolveSignerIdentity',
  )
  check(
    sign.includes('resolveSignerIdentity') &&
    sign.includes('@/lib/engine/docusign-signer-identity'),
    '  2b. sign route imports + calls resolveSignerIdentity',
  )

  // Send-envelope must resolve BOTH the funder and contractor through the
  // resolver — never via raw profile reads against the session client.
  check(
    /resolveSignerIdentity\(\s*\{\s*userId:\s*deal\.funder_id,\s*role:\s*['"]funder['"]/.test(send),
    '  2c. send-envelope resolves the funder via resolveSignerIdentity',
  )
  check(
    /resolveSignerIdentity\(\s*\{\s*userId:\s*deal\.contractor_id,\s*role:\s*['"]contractor['"]/.test(send),
    '  2d. send-envelope resolves the contractor via resolveSignerIdentity',
  )
  // Old direct profile read via session client must be gone
  check(
    !/supabase[\s\S]{0,40}\.from\(\s*['"]profiles['"]\s*\)[\s\S]{0,200}deal\.contractor_id/.test(send),
    '  2e. send-envelope no longer reads the contractor profile via the session client',
  )
  check(
    !/supabase[\s\S]{0,40}\.from\(\s*['"]profiles['"]\s*\)[\s\S]{0,200}deal\.funder_id/.test(send),
    '  2f. send-envelope no longer reads the funder profile via the session client',
  )

  // Sign route must resolve via the resolver, not build the signer manually
  check(
    /resolveSignerIdentity\(\s*\{\s*userId:\s*user\.id,\s*role:\s*signerRole/.test(sign),
    '  2g. sign route resolves identity via resolveSignerIdentity({ userId: user.id, role })',
  )
  // The old profile-fallback string ("Signer") must not appear in the sign route
  check(
    !/['"]Signer['"]/.test(sign),
    '  2h. sign route no longer uses "Signer" fallback (would mismatch envelope identity)',
  )

  // Routing-order branch on isFunder is preserved (drives the role var)
  check(
    sign.includes("isFunder ? 'funder' : 'contractor'"),
    '  2i. sign route maps isFunder → role for the resolver',
  )

  // ── 3. Sign route diagnostic logging on failure ────────────────────────
  console.log('\n3. Safe diagnostic logging on getSigningUrl failure')
  // Pull the catch block surrounding the getSigningUrl call.
  const sigCatch = sign.match(
    /catch\s*\(\s*err[\s\S]*?docusign_error[\s\S]*?\}\s*\)/,
  )
  check(!!sigCatch, '  3a. catch block around getSigningUrl emits a diagnostic log')

  // Required diagnostic fields
  for (const field of [
    'deal_id',
    'contract_id',
    'envelope_id_prefix',
    'role',
    'has_funder_signed',
    'has_contractor_signed',
    'signer_email_present',
    'docusign_error',
  ]) {
    check(
      sigCatch && sigCatch[0].includes(field),
      `  3b. diagnostic log includes "${field}"`,
    )
  }

  // Must NOT log the raw email value (only the presence boolean) and must
  // never reference DocuSign secrets. Boolean form `!!signer.email` is fine
  // since it never reaches the log as a string.
  check(
    sigCatch !== null &&
    !/signer_email\s*:\s*signer\.email/.test(sigCatch[0]) &&
    !sigCatch[0].includes('DOCUSIGN_PRIVATE_KEY') &&
    !sigCatch[0].includes('DOCUSIGN_WEBHOOK_SECRET') &&
    !sigCatch[0].includes('signer.name'),
    '  3c. diagnostic log does NOT leak email values, signer names, private keys, or webhook secrets',
  )
  check(
    sigCatch !== null && sigCatch[0].includes('.slice(0, 8)'),
    '  3d. diagnostic log truncates the envelope id (prefix only)',
  )
  check(
    sigCatch !== null && sigCatch[0].includes('.slice(0, 200)'),
    '  3e. diagnostic log truncates the DocuSign error message',
  )
  // Spec'd user-visible message
  check(
    sign.includes('Please refresh signing status and try again.'),
    '  3f. user-visible failure message: "Please refresh signing status and try again."',
  )

  // ── 4. Existing access controls preserved ─────────────────────────────
  console.log('\n4. Access controls preserved')
  check(
    /profile\.role\s*===\s*['"]admin['"]/.test(sign) &&
    sign.includes('Admins do not sign contracts'),
    '  4a. admins cannot sign — preserved 403',
  )
  check(
    sign.includes("contract.status === 'signed'"),
    '  4b. signed contract is rejected (409 path)',
  )
  check(
    sign.includes("contract.status === 'voided'"),
    '  4c. voided contract is rejected (409 path)',
  )
  check(
    sign.includes('!contract.docusign_envelope_id'),
    '  4d. missing envelope returns 503',
  )
  check(
    /isContractor\s*&&\s*!contract\.funder_signed_at/.test(sign),
    '  4e. contractor cannot sign before funder (existing 409 with "must sign first" copy)',
  )
  check(
    sign.includes('The funder must sign first'),
    '  4f. existing "The funder must sign first" message is preserved',
  )
  check(
    sign.includes('You are not a signing party on this contract'),
    '  4g. unrelated user is rejected with 403 (non-participant)',
  )
  check(
    /isFunder\s*&&\s*contract\.funder_signed_at/.test(sign) &&
    /isContractor\s*&&\s*contract\.contractor_signed_at/.test(sign),
    '  4h. already-signed signer cannot regenerate URL (409 path each)',
  )
  check(
    sign.includes('requireMFA') && sign.includes('requireDealAccess'),
    '  4i. requireMFA + requireDealAccess guards still wired',
  )

  // ── 5. No payment / release / Stripe imports in the sign route ─────────
  console.log('\n5. No payment / release / Stripe imports leaked into sign route')
  for (const forbidden of [
    'validateRelease',
    'authorizeRelease',
    'createTransfer',
    "'@/lib/stripe'",
    'stripe.transfers',
  ]) {
    check(!sign.includes(forbidden),
      `  5. sign route does NOT import / call "${forbidden}"`)
  }

  // ── 6. UI shows error without hiding the sign button ──────────────────
  console.log('\n6. UI: signing URL failure message + sign button stays visible')
  const ui = read(SIGNING_UI)
  // Error path inside handleOpenDocuSign sets errorMsg via setError; the button
  // (showOpenDocuSign) stays mounted because its visibility is gated by
  // contractor/funder turn detection — not by the error state.
  check(
    /handleOpenDocuSign[\s\S]*?setError\(/.test(ui),
    '  6a. handleOpenDocuSign sets an error via setError on failure',
  )
  check(
    /showOpenDocuSign\s*=\s*!!localEnvelopeId\s*&&\s*\(funderTurn\s*\|\|\s*contractorTurn\)/.test(ui),
    '  6b. "Open DocuSign to Sign" button is gated by turn detection, not by error state',
  )
  check(
    /role="alert"[\s\S]{0,400}\{error\}/.test(ui),
    '  6c. inline error block uses role="alert" so AT users hear it',
  )

  // ── 7. Test wired into npm test ───────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('docusign-recipient-view-fix.test.ts'),
    '7. docusign-recipient-view-fix.test.ts wired into npm test',
  )

  console.log('\n✓ All docusign-recipient-view-fix tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
