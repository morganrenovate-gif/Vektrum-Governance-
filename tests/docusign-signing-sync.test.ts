/**
 * tests/docusign-signing-sync.test.ts
 *
 * Static source-parse checks for the DocuSign signing-status sync pass:
 *   1. createEnvelope() includes envelope-level eventNotification with the
 *      required envelopeEvents and recipientEvents (existing behaviour pinned).
 *   2. eventNotification webhook URL resolves to /api/webhooks/docusign.
 *   3. Webhook recipient-completed routing order 1 sets funder_signed_at and
 *      transitions status to funder_signed (or signed if both done).
 *   4. Webhook recipient-completed routing order 2 sets contractor_signed_at
 *      and transitions status to contractor_signed (or signed if both done).
 *   5. status flips to 'signed' ONLY when both timestamps exist.
 *   6. Webhook calls notifyContractorTurnToSign() on funder-signed branch only.
 *   7. notifyContractorTurnToSign creates a 'contract_signing_turn'
 *      notification addressed to the deal contractor with deal-page deep link
 *      and a "Contract ready for your signature" subject. Idempotent.
 *   8. Refresh route /api/deals/[dealId]/contract/refresh-signing-status:
 *        - requires deal access via requireDealAccess
 *        - calls getEnvelopeStatus
 *        - sets funder_signed_at / contractor_signed_at from DocuSign
 *        - calls notifyContractorTurnToSign when funder-signed + contractor-pending
 *        - never sets status='signed' unless both timestamps exist
 *        - never authorizes release / moves funds
 *   9. ContractSigningSection UI:
 *        - shows "It's your turn to sign." when contractorTurn
 *        - shows "Open DocuSign to Sign" when contractorTurn
 *        - never shows "Waiting for the funder" once funder_signed_at exists
 *          for the contractor
 *        - exposes a "Refresh signing status" button
 *
 * Run: npx tsx tests/docusign-signing-sync.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const DOCUSIGN_LIB    = 'src/lib/engine/docusign.ts'
const DOCUSIGN_NOTIFY = 'src/lib/engine/docusign-notify.ts'
const WEBHOOK_ROUTE   = 'src/app/api/webhooks/docusign/route.ts'
const SIGN_ROUTE      = 'src/app/api/deals/[dealId]/contract/sign/route.ts'
const REFRESH_ROUTE   = 'src/app/api/deals/[dealId]/contract/refresh-signing-status/route.ts'
const SIGNING_UI      = 'src/components/deal/contract-signing-section.tsx'
const PACKAGE_JSON    = 'package.json'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel))
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

// Strip JS/TS line + block comments and JSX comments so we don't false-positive
// on documentation text describing forbidden patterns.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

async function main() {
  console.log('\ndocusign-signing-sync.test.ts\n')

  // ── 1. eventNotification on createEnvelope ─────────────────────────────
  console.log('1. createEnvelope eventNotification')
  const ds = read(DOCUSIGN_LIB)

  check(ds.includes('eventNotification'),
    '  1a. createEnvelope payload includes eventNotification')
  check(ds.includes('buildEventNotification'),
    '  1b. eventNotification is built by buildEventNotification helper')
  check(ds.includes('/api/webhooks/docusign'),
    '  1c. webhook URL path is /api/webhooks/docusign')
  check(ds.includes('NEXT_PUBLIC_APP_URL') &&
        ds.includes('APP_URL') &&
        ds.includes('VERCEL_URL'),
    '  1d. webhook URL resolution uses NEXT_PUBLIC_APP_URL → APP_URL → VERCEL_URL')

  // Required event types. DocuSign rejects 'DeliveryFailed' at the recipient
  // level with INVALID_REQUEST_PARAMETER — use 'AuthenticationFailed' instead.
  for (const ev of [
    'completed', 'declined', 'voided',                 // envelopeEvents
    'Completed', 'Declined', 'AuthenticationFailed',   // recipientEvents
  ]) {
    check(
      ds.includes(`'${ev}'`) || ds.includes(`"${ev}"`),
      `  1e. eventNotification covers "${ev}"`,
    )
  }
  check(
    !ds.includes("recipientEventStatusCode: 'DeliveryFailed'") &&
    !ds.includes('recipientEventStatusCode: "DeliveryFailed"'),
    '  1f. eventNotification no longer ships invalid value DeliveryFailed',
  )
  check(
    ds.includes("includeDocuments:") && ds.includes("'false'"),
    '  1f. includeDocuments: "false" (no documents in webhook payload)',
  )
  check(
    ds.includes("includeDocumentFields:") && ds.includes("'true'"),
    '  1g. includeDocumentFields: "true" (custom fields delivered)',
  )

  // Custom fields preserved
  check(
    ds.includes("'vektrum_deal_id'") && ds.includes("'vektrum_contract_id'"),
    '  1h. custom fields vektrum_deal_id + vektrum_contract_id preserved',
  )

  // HMAC keys present when secret is set
  check(
    ds.includes('DOCUSIGN_WEBHOOK_SECRET') &&
    ds.includes('hmacKeys') &&
    ds.includes('includeHMAC'),
    '  1i. HMAC: includeHMAC + hmacKeys conditioned on DOCUSIGN_WEBHOOK_SECRET',
  )

  // ── 2. Webhook recipient-completed handling ────────────────────────────
  console.log('\n2. Webhook recipient-completed handling')
  const wh = read(WEBHOOK_ROUTE)

  check(
    wh.includes("eventType === 'recipient-completed'"),
    '  2a. webhook handles eventType === "recipient-completed"',
  )
  // Routing-order 1 → funder
  check(
    wh.includes('routingOrder === 1') && wh.includes('isFunderSigner'),
    '  2b. routingOrder === 1 → isFunderSigner',
  )
  // Routing-order 2 → contractor
  check(
    wh.includes('routingOrder === 2') && wh.includes('isContractorSigner'),
    '  2c. routingOrder === 2 → isContractorSigner',
  )
  // Sets funder_signed_at when first time
  check(
    wh.includes('updates.funder_signed_at = signedAt') ||
    wh.includes('updates.funder_signed_at') ,
    '  2d. funder branch sets updates.funder_signed_at',
  )
  check(
    wh.includes('updates.contractor_signed_at = signedAt') ||
    wh.includes('updates.contractor_signed_at'),
    '  2e. contractor branch sets updates.contractor_signed_at',
  )
  // Status transitions
  check(
    wh.includes("contract.contractor_signed_at ? 'signed' : 'funder_signed'"),
    '  2f. funder branch: status = signed iff contractor already signed, else funder_signed',
  )
  check(
    wh.includes("contract.funder_signed_at ? 'signed' : 'contractor_signed'"),
    '  2g. contractor branch: status = signed iff funder already signed, else contractor_signed',
  )
  // Status flips to 'signed' ONLY when both exist
  check(
    !/newStatus\s*=\s*['"]signed['"][\s\S]{0,300}contract\.status/.test(wh),
    '  2h. status only becomes "signed" via the conditional branches above (no unconditional set)',
  )

  // Webhook fires the contractor notification on funder-signed branch
  check(
    wh.includes('notifyContractorTurnToSign') &&
    wh.includes("@/lib/engine/docusign-notify"),
    '  2i. webhook imports and calls notifyContractorTurnToSign',
  )
  // Notification is gated to "funder just signed AND contractor still pending"
  const notifyCallIdx = wh.indexOf('notifyContractorTurnToSign({')
  check(notifyCallIdx > -1, '  2j. notifyContractorTurnToSign({ … }) call site present')
  // The block should be guarded by isFunderSigner && !contract.contractor_signed_at
  const guarded = /if\s*\(\s*isFunderSigner\s*&&\s*!contract\.contractor_signed_at\s*\)\s*\{[\s\S]{0,400}notifyContractorTurnToSign/.test(wh)
  check(guarded, '  2k. notifyContractorTurnToSign is gated to (isFunderSigner && !contract.contractor_signed_at)')

  // Wraps the call in try/catch so notification failure cannot 5xx the webhook
  const tryCatchAroundNotify = /try\s*\{[\s\S]{0,400}notifyContractorTurnToSign[\s\S]{0,400}\}\s*catch/.test(wh)
  check(tryCatchAroundNotify, '  2l. notifyContractorTurnToSign call is wrapped in try/catch (non-fatal)')

  // ── 3. notifyContractorTurnToSign helper ───────────────────────────────
  console.log('\n3. notifyContractorTurnToSign helper')
  check(exists(DOCUSIGN_NOTIFY), '  3a. src/lib/engine/docusign-notify.ts exists')

  const notify = read(DOCUSIGN_NOTIFY)
  check(notify.includes('export async function notifyContractorTurnToSign'),
    '  3b. exports notifyContractorTurnToSign')
  // Idempotency check on existing notification
  check(
    notify.includes("'contract_signing_turn'") &&
    notify.includes("notification_type") &&
    notify.includes('limit(1)'),
    '  3c. idempotency: looks up existing contract_signing_turn before inserting',
  )
  check(
    notify.includes("createNotification") &&
    notify.includes("recipient_user_id: deal.contractor_id"),
    '  3d. inserts notification addressed to deal.contractor_id',
  )
  // Subject + body match spec wording
  check(
    notify.includes('Contract ready for your signature'),
    '  3e. subject: "Contract ready for your signature"',
  )
  check(
    notify.includes('The funder has signed the contract for'),
    '  3f. body summary: "The funder has signed the contract for {deal title}"',
  )
  // Deep link metadata to the deal page
  check(
    notify.includes('/dashboard/deals/${dealId}') ||
    notify.includes("`/dashboard/deals/${dealId}`"),
    '  3g. audit metadata includes deep link /dashboard/deals/{dealId}',
  )
  // Never throws — wraps everything in try/catch
  check(
    notify.includes('try {') && notify.includes('} catch'),
    '  3h. helper never throws (top-level try/catch)',
  )
  // Returns boolean
  check(
    /Promise<boolean>/.test(notify),
    '  3i. helper returns Promise<boolean> for caller decisioning',
  )

  // ── 4. Refresh-signing-status route ─────────────────────────────────────
  console.log('\n4. /api/deals/[dealId]/contract/refresh-signing-status')
  check(exists(REFRESH_ROUTE), '  4a. refresh-signing-status route file exists')

  const rs    = read(REFRESH_ROUTE)
  const rsSrc = stripComments(rs)

  check(rs.includes('export async function POST'),
    '  4b. exports POST handler')
  check(rsSrc.includes('requireDealAccess'),
    '  4c. uses requireDealAccess (deal participant or admin)')
  check(rsSrc.includes('getEnvelopeStatus'),
    '  4d. calls getEnvelopeStatus to pull live DocuSign state')

  // Updates timestamps from DocuSign signers
  check(
    rsSrc.includes('routingOrder') &&
    rsSrc.includes('completedTimestamp'),
    '  4e. picks signers by routingOrder and derives completedTimestamp',
  )
  check(
    rsSrc.includes('funder_signed_at') &&
    rsSrc.includes('contractor_signed_at'),
    '  4f. updates funder_signed_at / contractor_signed_at on the contract row',
  )

  // Status only flips to 'signed' when BOTH timestamps exist
  check(
    /if\s*\(\s*newFunderSignedAt\s*&&\s*newContractorSignedAt\s*\)\s*\{[\s\S]{0,160}newStatus\s*=\s*['"]signed['"]/.test(rsSrc),
    '  4g. status becomes "signed" only when both newFunderSignedAt AND newContractorSignedAt are set',
  )
  check(
    rsSrc.includes("'funder_signed'") && rsSrc.includes("'contractor_signed'"),
    '  4h. intermediate statuses funder_signed / contractor_signed are used',
  )

  // Triggers contractor notification when funder is now signed and contractor pending
  check(
    rsSrc.includes('notifyContractorTurnToSign') &&
    /if\s*\(\s*newFunderSignedAt\s*&&\s*!newContractorSignedAt\s*\)/.test(rsSrc),
    '  4i. notifyContractorTurnToSign called only when funder signed + contractor pending',
  )

  // Hard guarantees — refresh route does NOT touch release / payment paths
  check(
    !rsSrc.includes('validateRelease') &&
    !rsSrc.includes('authorizeRelease') &&
    !rsSrc.includes('createTransfer') &&
    !rsSrc.includes('@/lib/stripe') &&
    !rsSrc.includes('stripe.transfers'),
    '  4j. refresh route does NOT call release / payment / Stripe code paths',
  )
  check(
    !rsSrc.includes('milestone'),
    '  4k. refresh route does NOT touch milestone records',
  )

  // ── 5. Sign route — contractor blocked before funder ────────────────────
  console.log('\n5. Sign route guard rails (existing behaviour pinned)')
  const sign = read(SIGN_ROUTE)
  check(
    sign.includes('isContractor && !contract.funder_signed_at') ||
    /isContractor[\s\S]{0,80}!contract\.funder_signed_at/.test(sign),
    '  5a. contractor sign attempt is rejected when funder has not signed yet',
  )
  check(
    sign.includes('The funder must sign first'),
    '  5b. error message: "The funder must sign first"',
  )

  // ── 6. ContractSigningSection UI ───────────────────────────────────────
  console.log('\n6. ContractSigningSection UI')
  const ui = read(SIGNING_UI)

  check(
    ui.includes('contractorTurn') &&
    ui.includes('isContractor && funderDone && !contractorDone'),
    '  6a. contractorTurn = isContractor && funderDone && !contractorDone',
  )
  check(
    ui.includes('It&rsquo;s your turn to sign') ||
    ui.includes("It's your turn to sign"),
    '  6b. shows "It\'s your turn to sign." cue when contractorTurn',
  )
  check(
    ui.includes('Open DocuSign to Sign'),
    '  6c. "Open DocuSign to Sign" CTA exists',
  )
  // Waiting-for-funder hidden once funder is done (contractorTurn branch
  // takes precedence — gated by waitingOnFunder = isContractor && !funderDone)
  check(
    ui.includes('waitingOnFunder') &&
    /waitingOnFunder\s*=\s*isContractor\s*&&\s*!funderDone/.test(ui),
    '  6d. waitingOnFunder = isContractor && !funderDone (disappears once funder signs)',
  )

  // Refresh button + handler
  check(
    ui.includes('handleRefreshSigningStatus') &&
    ui.includes('/contract/refresh-signing-status'),
    '  6e. UI exposes a Refresh-signing-status handler that POSTs to /contract/refresh-signing-status',
  )
  check(
    ui.includes('Refresh signing status'),
    '  6f. visible "Refresh signing status" button label',
  )
  // Refresh button rendered when envelope exists and at least one signer is still pending
  check(
    /localEnvelopeId\s*&&\s*\(\s*!funderDone\s*\|\|\s*!contractorDone\s*\)/.test(ui),
    '  6g. refresh button rendered when envelope exists and at least one party still pending',
  )

  // ── 7. Test wired into npm test ────────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('docusign-signing-sync.test.ts'),
    '7. docusign-signing-sync.test.ts wired into npm test',
  )

  console.log('\n✓ All docusign-signing-sync tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
