/**
 * tests/docusign-envelope-recipient-fix.test.ts
 *
 * Pins the recipient-view-by-actual-envelope-recipient fix.
 *
 *   1. profiles.email is gone from the deal-detail page — the column does
 *      not exist on the profiles table and selecting it caused PostgREST
 *      to fail the funder-profile fallback.
 *   2. src/lib/engine/docusign.ts exposes getEnvelopeRecipients() that
 *      hits  GET /v2.1/accounts/{accountId}/envelopes/{envelopeId}/recipients.
 *   3. getSigningUrl accepts an optional recipientId and includes it in the
 *      recipient-view request body when present (DocuSign's canonical
 *      disambiguator — eliminates UNKNOWN_ENVELOPE_RECIPIENT).
 *   4. The /contract/sign route now:
 *        a. fetches the envelope's recipients BEFORE generating a URL
 *        b. selects the recipient by routingOrder/recipientId ('1' funder,
 *           '2' contractor) — sourced from DocuSign, not local profile
 *        c. passes recipient.email / recipient.name / recipient.clientUserId
 *           and recipientId verbatim to getSigningUrl
 *        d. falls back to the resolveSignerIdentity convention for
 *           clientUserId only when DocuSign omits it (rare)
 *   5. Failure logs include signer count and per-signer summaries
 *      (recipientId / routingOrder / status / has_email / has_clientUserId)
 *      with no email values, no full envelope IDs, no secrets, no raw
 *      DocuSign body.
 *   6. Existing access controls preserved (admin can't sign as a party,
 *      signed/voided/missing-envelope/contractor-before-funder/non-
 *      participant/already-signed all blocked).
 *   7. No release / payment / Stripe imports leaked into the sign route.
 *
 * Run: npx tsx tests/docusign-envelope-recipient-fix.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const DOCUSIGN_LIB = 'src/lib/engine/docusign.ts'
const SIGN_ROUTE   = 'src/app/api/deals/[dealId]/contract/sign/route.ts'
const DEAL_PAGE    = 'src/app/(app)/dashboard/deals/[dealId]/page.tsx'
const PROFILES_SQL = 'supabase/migrations/001_schema.sql'
const PACKAGE_JSON = 'package.json'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

async function main() {
  console.log('\ndocusign-envelope-recipient-fix.test.ts\n')

  // ── 1. profiles.email is gone from the deal-detail page ───────────────
  console.log('1. profiles.email leak removed from deal-detail page')
  const dealPage     = read(DEAL_PAGE)
  const dealPageCode = stripComments(dealPage)

  // Confirm profiles schema indeed has no email column (sanity check)
  const profiles = read(PROFILES_SQL)
  const profilesTable = profiles.match(/create table public\.profiles[\s\S]*?\);/i)
  check(!!profilesTable && !/^\s*email\b/m.test(profilesTable[0]),
    '  1a. profiles schema confirms there is no `email` column')

  // The fallback select must not request email
  check(
    !/from\(['"]profiles['"]\)[\s\S]{0,200}\.select\([^)]*email/.test(dealPageCode),
    '  1b. deal-detail page no longer selects "email" from profiles',
  )
  // Documentation comment retained explaining the fix
  check(
    dealPage.includes('profiles has no `email` column'),
    '  1c. deal-detail page documents that profiles has no email column',
  )

  // ── 2. getEnvelopeRecipients exists and hits the right endpoint ───────
  console.log('\n2. getEnvelopeRecipients helper')
  const ds = read(DOCUSIGN_LIB)
  check(
    /export\s+async\s+function\s+getEnvelopeRecipients/.test(ds),
    '  2a. exports getEnvelopeRecipients',
  )
  check(
    ds.includes('/recipients'),
    '  2b. helper hits the /recipients endpoint',
  )
  check(
    /export\s+interface\s+DocuSignEnvelopeRecipient/.test(ds),
    '  2c. exports DocuSignEnvelopeRecipient type',
  )
  // The recipient type carries the four fields the route consumes
  for (const field of ['recipientId', 'routingOrder', 'email', 'name', 'clientUserId', 'status']) {
    check(
      new RegExp(`${field}[?]?:`).test(ds),
      `  2d. DocuSignEnvelopeRecipient declares "${field}"`,
    )
  }

  // ── 3. getSigningUrl accepts + forwards recipientId ───────────────────
  console.log('\n3. getSigningUrl forwards recipientId to DocuSign')
  // GetSigningUrlInput interface
  check(
    /recipientId\?:\s*string/.test(ds),
    '  3a. GetSigningUrlInput declares optional recipientId',
  )
  // recipientId is included in the recipient-view request body when present
  check(
    /if\s*\(recipientId\)\s*body\.recipientId\s*=\s*recipientId/.test(ds),
    '  3b. getSigningUrl includes recipientId in the request body when present',
  )

  // ── 4. Sign route: fetch recipients THEN build signer from DocuSign ───
  console.log('\n4. Sign route fetches envelope recipients before URL')
  const sign     = read(SIGN_ROUTE)
  const signCode = stripComments(sign)

  check(
    sign.includes('getEnvelopeRecipients') &&
    sign.includes('@/lib/engine/docusign'),
    '  4a. sign route imports + calls getEnvelopeRecipients',
  )

  // The recipients fetch happens BEFORE getSigningUrl in the source
  const recIdx  = sign.indexOf('await getEnvelopeRecipients(')
  const urlIdx  = sign.indexOf('await getSigningUrl(')
  check(recIdx > -1 && urlIdx > -1 && recIdx < urlIdx,
    '  4b. getEnvelopeRecipients() runs BEFORE getSigningUrl()')

  // Routing-order target is derived from isFunder
  check(
    /targetRoutingOrder\s*=\s*isFunder\s*\?\s*['"]1['"]\s*:\s*['"]2['"]/.test(signCode),
    '  4c. routingOrder target: funder → "1", contractor → "2"',
  )

  // Recipient is matched by routingOrder OR recipientId — both forms accepted
  // (the source uses `String(r.routingOrder) === targetRoutingOrder` so the
  // regex must allow intermediate `)` from String() / Number() wrappers).
  check(
    /recipients\.find\([\s\S]*?r\.routingOrder[\s\S]*?targetRoutingOrder/.test(signCode),
    '  4d. recipient matched by routingOrder',
  )
  check(
    /recipients\.find\([\s\S]*?r\.recipientId[\s\S]*?targetRoutingOrder/.test(signCode),
    '  4e. recipient matched by recipientId (fallback)',
  )

  // Signer payload is built FROM matchedRecipient — not from local profile
  check(
    /name:\s*matchedRecipient\.name/.test(signCode) &&
    /email:\s*matchedRecipient\.email/.test(signCode),
    '  4f. signer.name + signer.email come from matchedRecipient (DocuSign)',
  )

  // recipientId from DocuSign is forwarded to getSigningUrl
  check(
    /getSigningUrl\(\s*\{[\s\S]*?recipientId:\s*matchedRecipient\.recipientId/.test(signCode),
    '  4g. getSigningUrl is called with recipientId: matchedRecipient.recipientId',
  )

  // clientUserId fallback to resolveSignerIdentity / user.id when DocuSign omits it
  check(
    /resolveSignerIdentity/.test(signCode) &&
    /clientUserId\s*=\s*matchedRecipient\.clientUserId/.test(signCode),
    '  4h. clientUserId prefers matchedRecipient; falls back to resolveSignerIdentity / user.id',
  )

  // ── 5. Diagnostic logging on failure ──────────────────────────────────
  console.log('\n5. Failure diagnostics include signer count + summaries')
  // The catch block on getSigningUrl carries the new diagnostic shape.
  // Anchor on the [sign] getSigningUrl failed log entry and capture through
  // docusign_error which is the LAST field in the new shape.
  const catchMatch = sign.match(
    /\[sign\]\s+getSigningUrl\s+failed[\s\S]*?docusign_error[\s\S]*?\}\s*\)/,
  )
  check(
    !!catchMatch && catchMatch[0].includes('signers_summary'),
    '  5a. catch block emits signers_summary',
  )

  for (const field of [
    'deal_id',
    'contract_id',
    'envelope_id_prefix',
    'role',
    'selected_recipient_id',
    'selected_routing_order',
    'selected_email_present',
    'selected_client_user_id_present',
    'signer_count',
    'signers_summary',
    'docusign_error',
  ]) {
    check(
      catchMatch !== null && catchMatch[0].includes(field),
      `  5b. diagnostic log includes "${field}"`,
    )
  }

  // signers_summary entries log the structural fields ONLY (no full email)
  check(
    /signers_summary[\s\S]*?recipientId:\s*r\.recipientId/.test(sign) &&
    /signers_summary[\s\S]*?routingOrder:\s*r\.routingOrder/.test(sign) &&
    /signers_summary[\s\S]*?status:\s*r\.status/.test(sign) &&
    /signers_summary[\s\S]*?has_email:\s*!!r\.email/.test(sign) &&
    /signers_summary[\s\S]*?has_clientUserId:\s*!!r\.clientUserId/.test(sign),
    '  5c. signers_summary maps to {recipientId,routingOrder,status,has_email,has_clientUserId}',
  )

  // Must NOT log raw emails / secrets / private keys
  check(
    !/email:\s*r\.email[^_]/.test(sign) &&
    !sign.includes('DOCUSIGN_PRIVATE_KEY') &&
    !sign.includes('DOCUSIGN_WEBHOOK_SECRET'),
    '  5d. diagnostic logs do NOT leak emails / private keys / webhook secrets',
  )
  // Envelope-id prefix only (no full id)
  check(
    /envelopeId\.slice\(0,\s*8\)/.test(sign),
    '  5e. envelope id is truncated to first 8 chars in logs',
  )
  // Spec'd user-visible message
  check(
    sign.includes('Please refresh signing status and try again.'),
    '  5f. user-visible failure message: "Please refresh signing status and try again."',
  )

  // ── 6. Existing access controls preserved ─────────────────────────────
  console.log('\n6. Access controls preserved')
  check(
    /profile\.role\s*===\s*['"]admin['"]/.test(sign) &&
    sign.includes('Admins do not sign contracts'),
    '  6a. admins still rejected with 403',
  )
  check(sign.includes("contract.status === 'signed'"),
    '  6b. signed contract still rejected (409)')
  check(sign.includes("contract.status === 'voided'"),
    '  6c. voided contract still rejected (409)')
  check(sign.includes('!contract.docusign_envelope_id'),
    '  6d. missing envelope still returns 503')
  check(/isContractor\s*&&\s*!contract\.funder_signed_at/.test(sign),
    '  6e. contractor cannot sign before funder')
  check(sign.includes('The funder must sign first'),
    '  6f. existing "must sign first" message preserved')
  check(sign.includes('You are not a signing party on this contract'),
    '  6g. non-participant 403 preserved')
  check(/isFunder\s*&&\s*contract\.funder_signed_at/.test(sign) &&
        /isContractor\s*&&\s*contract\.contractor_signed_at/.test(sign),
    '  6h. already-signed signer cannot regenerate URL')
  check(sign.includes('requireMFA') && sign.includes('requireDealAccess'),
    '  6i. requireMFA + requireDealAccess guards still wired')

  // ── 7. No release / payment / Stripe imports leaked ───────────────────
  console.log('\n7. No payment / release / Stripe code paths in sign route')
  for (const forbidden of [
    'validateRelease',
    'authorizeRelease',
    'createTransfer',
    "'@/lib/stripe'",
    'stripe.transfers',
  ]) {
    check(!sign.includes(forbidden),
      `  7. sign route does NOT import / call "${forbidden}"`)
  }

  // ── 8. Test wired into npm test ───────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(pkg.includes('docusign-envelope-recipient-fix.test.ts'),
    '8. docusign-envelope-recipient-fix.test.ts wired into npm test')

  console.log('\n✓ All docusign-envelope-recipient-fix tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
