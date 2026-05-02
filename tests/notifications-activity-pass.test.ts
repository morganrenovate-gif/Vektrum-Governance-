/**
 * tests/notifications-activity-pass.test.ts
 *
 * Pins the contract / signing notification + activity-feed pass.
 *
 *   1. Helper module exports three idempotent notification helpers:
 *        - notifyContractorTurnToSign       (already covered, re-pinned)
 *        - notifyContractEnvelopeSent       (new — sent to BOTH parties)
 *        - notifyContractFullyExecuted      (new — sent to BOTH parties)
 *
 *   2. Idempotency
 *      Each helper checks for an existing notification on
 *      (entity_type='contract', entity_id=contractId, notification_type)
 *      and skips creation if one exists. Covers:
 *        - webhook redelivery
 *        - manual refresh after webhook
 *        - envelope-completed arriving after recipient-completed
 *
 *   3. Spec copy
 *        contract_envelope_sent  → "Contract sent for signature" + body
 *        contract_signing_turn   → "Contract ready for your signature" + body
 *        contract_fully_executed → "Contract fully executed" + body
 *      Each addressed to the correct party (or both for sent + executed).
 *      Each carries deal_id so the bell deep-links to /dashboard/deals/{id}.
 *
 *   4. Wiring
 *        send-envelope route calls notifyContractEnvelopeSent
 *        webhooks/docusign envelope-completed calls notifyContractFullyExecuted
 *        refresh-signing-status calls notifyContractFullyExecuted when both
 *          timestamps are now set
 *
 *   5. NotificationBell
 *        typeLabel() maps the three new notification_type values to human copy
 *
 *   6. Audit (activity feed)
 *        - send-envelope still logs `docusign_envelope_sent` audit
 *        - webhook recipient-completed still logs `funder_signed` /
 *          `contractor_signed`
 *        - webhook envelope-completed still logs `contract_fully_signed`
 *        - contract upload still logs `contract_uploaded`
 *
 *   7. Banned product claims absent across all touched surfaces.
 *
 *   8. No payment / release / Stripe code paths added by this pass.
 *
 * Run: npx tsx tests/notifications-activity-pass.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const HELPER       = 'src/lib/engine/docusign-notify.ts'
const SEND_ROUTE   = 'src/app/api/deals/[dealId]/contract/send-envelope/route.ts'
const WEBHOOK      = 'src/app/api/webhooks/docusign/route.ts'
const REFRESH      = 'src/app/api/deals/[dealId]/contract/refresh-signing-status/route.ts'
const UPLOAD_ROUTE = 'src/app/api/deals/[dealId]/contracts/route.ts'
const BELL         = 'src/components/nav/notification-bell.tsx'
const PACKAGE_JSON = 'package.json'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {
  console.log('\nnotifications-activity-pass.test.ts\n')

  const helper  = read(HELPER)
  const send    = read(SEND_ROUTE)
  const webhook = read(WEBHOOK)
  const refresh = read(REFRESH)
  const upload  = read(UPLOAD_ROUTE)
  const bell    = read(BELL)
  const pkg     = read(PACKAGE_JSON)

  // ── 1. Helper module exports ──────────────────────────────────────────
  console.log('1. Helper module exports')
  check(helper.includes('export async function notifyContractorTurnToSign'),
    '  1a. exports notifyContractorTurnToSign')
  check(helper.includes('export async function notifyContractEnvelopeSent'),
    '  1b. exports notifyContractEnvelopeSent')
  check(helper.includes('export async function notifyContractFullyExecuted'),
    '  1c. exports notifyContractFullyExecuted')

  // ── 2. Idempotency primitive ──────────────────────────────────────────
  console.log('\n2. Idempotency')
  // Single shared primitive used by the two-party helpers
  check(
    helper.includes('createTwoPartyContractNotification'),
    '  2a. shared primitive createTwoPartyContractNotification exists',
  )
  // Each notification type has an exact existence check
  for (const type of [
    'contract_signing_turn',
    'contract_envelope_sent',
    'contract_fully_executed',
  ]) {
    // Verify the type literal appears next to the existence-check shape
    const re = new RegExp(
      `\\.eq\\([^)]*entity_type[^)]*['"]contract['"][\\s\\S]{0,300}\\.eq\\([^)]*notification_type[^)]*['"]${type}['"]|` +
      `notificationType:\\s*['"]${type}['"]`,
    )
    check(re.test(helper),
      `  2b. type "${type}" is keyed in the idempotency check or wired through the primitive`)
  }
  // Both helpers + primitive share the limit(1).maybeSingle() guard
  const limitChecks = (helper.match(/\.limit\(1\)\s*\n?\s*\.maybeSingle\(\)/g) || []).length
  check(limitChecks >= 2,
    `  2c. >=2 limit(1).maybeSingle() existence checks (found ${limitChecks})`)

  // ── 3. Spec copy ──────────────────────────────────────────────────────
  console.log('\n3. Spec copy on each notification')
  check(
    helper.includes('Contract ready for your signature') &&
    helper.includes('The funder has signed the contract for'),
    '  3a. signing-turn subject + body match spec',
  )
  check(
    helper.includes('Contract sent for signature') &&
    helper.includes('has been sent through DocuSign'),
    '  3b. envelope-sent subject + body match spec',
  )
  check(
    helper.includes('Contract fully executed') &&
    helper.includes('Both parties have completed signing for'),
    '  3c. fully-executed subject + body match spec',
  )
  // Deep-link metadata so the bell can route to the deal page
  check(
    helper.includes('/dashboard/deals/${dealId}') ||
    helper.includes('`/dashboard/deals/${dealId}`'),
    '  3d. audit metadata includes deep link /dashboard/deals/{dealId}',
  )

  // Two-party recipients (funder + contractor) on the shared primitive
  check(
    helper.includes("party: 'funder'") &&
    helper.includes("party: 'contractor'"),
    '  3e. two-party primitive addresses both funder and contractor',
  )

  // ── 4. Wiring into routes ─────────────────────────────────────────────
  console.log('\n4. Wiring into routes')
  // send-envelope → notifyContractEnvelopeSent
  check(
    send.includes('notifyContractEnvelopeSent') &&
    send.includes('@/lib/engine/docusign-notify'),
    '  4a. send-envelope imports + calls notifyContractEnvelopeSent',
  )
  // The call site must come AFTER the `docusign_envelope_id` row update so
  // we never notify for an envelope we couldn't persist.
  const sendIdxNotify = send.indexOf('notifyContractEnvelopeSent({')
  const sendIdxUpdate = send.indexOf("docusign_envelope_id")
  check(sendIdxNotify > -1 && sendIdxNotify > sendIdxUpdate,
    '  4b. notifyContractEnvelopeSent fires AFTER the envelope_id is saved')

  // Webhook envelope-completed → notifyContractFullyExecuted
  check(
    webhook.includes('notifyContractFullyExecuted'),
    '  4c. webhook imports notifyContractFullyExecuted',
  )
  // Verify the call site lies AFTER the envelope-completed marker AND before
  // the next branch (envelope-voided). This pins it to the right handler
  // without depending on which intermediate `return NextResponse.json` the
  // regex stops at.
  const completedMarker = webhook.indexOf("eventType === 'envelope-completed'")
  const voidedMarker    = webhook.indexOf("eventType === 'envelope-voided'")
  const fullyExecCall   = webhook.indexOf('notifyContractFullyExecuted({')
  check(
    completedMarker > -1 &&
    voidedMarker    > -1 &&
    fullyExecCall   > completedMarker &&
    fullyExecCall   < voidedMarker,
    '  4d. notifyContractFullyExecuted call lives inside the envelope-completed branch',
  )
  // try/catch around the call (notification failures must not 5xx the webhook)
  const completedRegion = webhook.slice(completedMarker, voidedMarker)
  check(
    /try\s*\{[\s\S]*?notifyContractFullyExecuted[\s\S]*?\}\s*catch/.test(completedRegion),
    '  4e. notifyContractFullyExecuted call is wrapped in try/catch',
  )

  // Refresh route also fires fully-executed when both timestamps converge
  check(
    refresh.includes('notifyContractFullyExecuted'),
    '  4f. refresh route imports notifyContractFullyExecuted',
  )
  check(
    /if\s*\(\s*newFunderSignedAt\s*&&\s*newContractorSignedAt\s*\)[\s\S]{0,500}notifyContractFullyExecuted/.test(refresh),
    '  4g. refresh route calls notifyContractFullyExecuted only when BOTH timestamps are set',
  )

  // ── 5. NotificationBell typeLabel mapping ─────────────────────────────
  console.log('\n5. NotificationBell typeLabel mapping')
  for (const [type, label] of [
    ['contract_envelope_sent',  'Contract sent for signature'],
    ['contract_signing_turn',   'Contract signing'],
    ['contract_fully_executed', 'Contract executed'],
  ] as const) {
    check(
      bell.includes(`${type}:`) && bell.includes(`'${label}'`),
      `  5. typeLabel maps "${type}" → "${label}"`,
    )
  }

  // ── 6. Activity feed (audit) — events preserved or added ───────────────
  console.log('\n6. Activity feed (audit) entries preserved')
  // Contract upload → contract_uploaded
  check(
    upload.includes("action:") &&
    upload.includes("'contract_uploaded'"),
    '  6a. contract upload still logs action "contract_uploaded"',
  )
  // Envelope sent
  check(
    /action:\s*['"]docusign_envelope_sent['"]/.test(send),
    '  6b. envelope sent still logs action "docusign_envelope_sent"',
  )
  // Recipient signed (funder + contractor)
  check(
    webhook.includes("isFunderSigner ? 'funder_signed' : 'contractor_signed'"),
    '  6c. webhook still logs role-specific funder_signed / contractor_signed',
  )
  // Fully signed
  check(
    /action:\s*['"]contract_fully_signed['"]/.test(webhook),
    '  6d. webhook still logs action "contract_fully_signed"',
  )
  // Refresh → contract_signing_status_refreshed
  check(
    /action:\s*['"]contract_signing_status_refreshed['"]/.test(refresh),
    '  6e. refresh route still logs action "contract_signing_status_refreshed"',
  )
  // Notification helpers add a paired audit so signing events are double-rooted
  check(
    helper.includes('contractor_signing_turn_notified'),
    '  6f. signing-turn helper logs audit action contractor_signing_turn_notified',
  )
  check(
    /action:\s*`\$\{notificationType\}_notified`/.test(helper),
    '  6g. shared primitive logs audit action <type>_notified',
  )

  // ── 7. Banned product claims ──────────────────────────────────────────
  console.log('\n7. Banned product claims absent')
  const all = (helper + '\n' + send + '\n' + webhook + '\n' + refresh + '\n' + bell).toLowerCase()
  for (const banned of [
    'vektrum moves money',
    'vektrum holds funds',
    'vektrum acts as escrow',
    'vektrum is a lender',
    'ai approves release',
    'ai approved release',
    'ai authorizes payment',
    'guarantees compliance',
    'automatic payment',
  ]) {
    check(!all.includes(banned), `  7. banned: "${banned}" absent`)
  }

  // ── 8. No payment / release / Stripe code paths added ──────────────────
  console.log('\n8. No payment / release / Stripe code paths in helper')
  for (const forbidden of [
    'validateRelease',
    'authorizeRelease',
    'createTransfer',
    "'@/lib/stripe'",
    'stripe.transfers',
  ]) {
    check(!helper.includes(forbidden),
      `  8. helper does NOT import / call "${forbidden}"`)
  }

  // ── 9. Test wired into npm test ───────────────────────────────────────
  check(
    pkg.includes('notifications-activity-pass.test.ts'),
    '9. notifications-activity-pass.test.ts wired into npm test',
  )

  console.log('\n✓ All notifications-activity-pass tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
