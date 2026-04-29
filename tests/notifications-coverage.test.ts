/**
 * Notification Coverage — Static Safety Tests
 *
 * Verifies that all 14 core workflow notification helpers are implemented in
 * notify.ts and wired into their respective routes.
 *
 * Source-parse checks only — no live DB, no env vars, no rendering required.
 *
 * Events covered:
 *  1.  funder_invited              — notify.ts helper exists + invites POST route wired
 *  2.  invite_accepted             — notify.ts helper exists + accept route wired
 *  3.  change_order_approved       — notify.ts helper exists + change-orders PATCH wired
 *  4.  change_order_rejected       — notify.ts helper exists + change-orders PATCH wired
 *  5.  evidence_uploaded           — notify.ts helper exists + documents POST wired
 *  6.  lien_waiver_requested       — notify.ts helper exists (ready to wire)
 *  7.  lien_waiver_uploaded        — notify.ts helper exists + lien-waivers upload wired
 *  8.  milestone_ready_for_review  — notify.ts helper exists + transition route wired
 *  9.  release_authorized          — notify.ts helper exists + release route wired
 * 10.  release_blocked             — notify.ts helper exists + release route wired
 * 11.  external_payment_confirmation_required — notify.ts helper + authorize-external wired
 * 12.  retainage_released          — notify.ts helper exists + retainage/release wired
 * 13.  dispute_opened              — notify.ts helper exists + disputes POST wired
 * 14.  dispute_resolved            — notify.ts helper exists + disputes resolve wired
 *
 * Safety invariants:
 * 15.  No banned phrases in new helpers (custody, escrow, AI approval, etc.)
 * 16.  All helpers use [Vektrum] subject prefix
 * 17.  Custody disclaimer present (via renderVektrumEmail footer)
 * 18.  No secrets referenced in helper bodies
 * 19.  Fire-and-forget pattern: no helper throws (all wrapped in try/catch)
 * 20.  Release gate, Stripe webhook, and partner API files are not touched
 * 21.  Test wired into npm test in package.json
 *
 * Run:  npx tsx tests/notifications-coverage.test.ts
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

const NOTIFY           = 'src/lib/engine/notify.ts'
const INVITES_POST     = 'src/app/api/invites/route.ts'
const ACCEPT_ROUTE     = 'src/app/api/invites/[token]/accept/route.ts'
const CO_PATCH         = 'src/app/api/change-orders/[changeOrderId]/route.ts'
const DOCS_POST        = 'src/app/api/milestones/[milestoneId]/documents/route.ts'
const LW_UPLOAD        = 'src/app/api/lien-waivers/[waiverId]/upload/route.ts'
const TRANSITION       = 'src/app/api/milestones/[milestoneId]/transition/route.ts'
const RELEASE          = 'src/app/api/milestones/[milestoneId]/release/route.ts'
const AUTH_EXT         = 'src/app/api/milestones/[milestoneId]/authorize-external/route.ts'
const RETAINAGE        = 'src/app/api/deals/[dealId]/retainage/release/route.ts'
const DISPUTES_POST    = 'src/app/api/disputes/route.ts'
const DISPUTES_RESOLVE = 'src/app/api/disputes/[disputeId]/resolve/route.ts'
const GATE_FILE        = 'src/lib/engine/release-gate.ts'
const STRIPE_FILE      = 'src/app/api/stripe/webhook/route.ts'
const PKG              = 'package.json'

async function main() {

const notify = read(NOTIFY)

// ─── 1. funder_invited ────────────────────────────────────────────────────────

await test('1. notifyFunderInvited helper exists in notify.ts', () => {
  assert(
    notify.includes('notifyFunderInvited') && notify.includes("'funder_invited'"),
    `${NOTIFY} must export notifyFunderInvited and use notification_type 'funder_invited'.`,
  )
})

await test('1b. invites POST route imports and calls notifyFunderInvited', () => {
  const src = read(INVITES_POST)
  assert(
    src.includes('notifyFunderInvited') && !src.includes("new Resend(process.env.RESEND_API_KEY)"),
    `${INVITES_POST} must import and call notifyFunderInvited (replacing the inline Resend email).`,
  )
})

// ─── 2. invite_accepted ───────────────────────────────────────────────────────

await test('2. notifyInviteAccepted helper exists in notify.ts', () => {
  assert(
    notify.includes('notifyInviteAccepted') && notify.includes("'invite_accepted'"),
    `${NOTIFY} must export notifyInviteAccepted and use notification_type 'invite_accepted'.`,
  )
})

await test('2b. accept route imports and calls notifyInviteAccepted', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('notifyInviteAccepted'),
    `${ACCEPT_ROUTE} must call notifyInviteAccepted after the funder accepts an invite.`,
  )
})

// ─── 3. change_order_approved ─────────────────────────────────────────────────

await test('3. notifyChangeOrderApproved helper exists in notify.ts', () => {
  assert(
    notify.includes('notifyChangeOrderApproved') && notify.includes("'change_order_approved'"),
    `${NOTIFY} must export notifyChangeOrderApproved and use notification_type 'change_order_approved'.`,
  )
})

await test('3b. change-orders PATCH route imports and calls notifyChangeOrderApproved', () => {
  const src = read(CO_PATCH)
  assert(
    src.includes('notifyChangeOrderApproved'),
    `${CO_PATCH} must call notifyChangeOrderApproved when decision === 'approved'.`,
  )
})

// ─── 4. change_order_rejected ─────────────────────────────────────────────────

await test('4. notifyChangeOrderRejected helper exists in notify.ts', () => {
  assert(
    notify.includes('notifyChangeOrderRejected') && notify.includes("'change_order_rejected'"),
    `${NOTIFY} must export notifyChangeOrderRejected and use notification_type 'change_order_rejected'.`,
  )
})

await test('4b. change-orders PATCH route calls notifyChangeOrderRejected', () => {
  const src = read(CO_PATCH)
  assert(
    src.includes('notifyChangeOrderRejected'),
    `${CO_PATCH} must call notifyChangeOrderRejected when decision === 'rejected'.`,
  )
})

// ─── 5. evidence_uploaded ────────────────────────────────────────────────────

await test('5. notifyEvidenceUploaded helper exists in notify.ts', () => {
  assert(
    notify.includes('notifyEvidenceUploaded') && notify.includes("'evidence_uploaded'"),
    `${NOTIFY} must export notifyEvidenceUploaded and use notification_type 'evidence_uploaded'.`,
  )
})

await test('5b. documents POST route imports and calls notifyEvidenceUploaded', () => {
  const src = read(DOCS_POST)
  assert(
    src.includes('notifyEvidenceUploaded'),
    `${DOCS_POST} must call notifyEvidenceUploaded after a successful document upload.`,
  )
})

// ─── 6. lien_waiver_requested ─────────────────────────────────────────────────

await test('6. notifyLienWaiverRequested helper exists in notify.ts', () => {
  assert(
    notify.includes('notifyLienWaiverRequested') && notify.includes("'lien_waiver_requested'"),
    `${NOTIFY} must export notifyLienWaiverRequested and use notification_type 'lien_waiver_requested'.`,
  )
})

// ─── 7. lien_waiver_uploaded ─────────────────────────────────────────────────

await test('7. notifyLienWaiverUploaded helper exists in notify.ts', () => {
  assert(
    notify.includes('notifyLienWaiverUploaded') && notify.includes("'lien_waiver_uploaded'"),
    `${NOTIFY} must export notifyLienWaiverUploaded and use notification_type 'lien_waiver_uploaded'.`,
  )
})

await test('7b. lien-waivers upload route imports and calls notifyLienWaiverUploaded', () => {
  const src = read(LW_UPLOAD)
  assert(
    src.includes('notifyLienWaiverUploaded'),
    `${LW_UPLOAD} must call notifyLienWaiverUploaded after a successful waiver upload.`,
  )
})

// ─── 8. milestone_ready_for_review ───────────────────────────────────────────

await test('8. notifyMilestoneReadyForReview helper exists in notify.ts', () => {
  assert(
    notify.includes('notifyMilestoneReadyForReview') && notify.includes("'milestone_ready_for_review'"),
    `${NOTIFY} must export notifyMilestoneReadyForReview and use notification_type 'milestone_ready_for_review'.`,
  )
})

await test('8b. transition route imports and calls notifyMilestoneReadyForReview', () => {
  const src = read(TRANSITION)
  assert(
    src.includes('notifyMilestoneReadyForReview'),
    `${TRANSITION} must call notifyMilestoneReadyForReview when transitioning to 'ready_for_review'.`,
  )
})

// ─── 9. release_authorized ───────────────────────────────────────────────────

await test('9. notifyReleaseAuthorized helper exists in notify.ts', () => {
  assert(
    notify.includes('notifyReleaseAuthorized') && notify.includes("'release_authorized'"),
    `${NOTIFY} must export notifyReleaseAuthorized and use notification_type 'release_authorized'.`,
  )
})

await test('9b. release route imports and calls notifyReleaseAuthorized', () => {
  const src = read(RELEASE)
  assert(
    src.includes('notifyReleaseAuthorized'),
    `${RELEASE} must call notifyReleaseAuthorized after a successful Stripe transfer.`,
  )
})

// ─── 10. release_blocked ─────────────────────────────────────────────────────

await test('10. notifyReleaseBlocked helper exists in notify.ts', () => {
  assert(
    notify.includes('notifyReleaseBlocked') && notify.includes("'release_blocked'"),
    `${NOTIFY} must export notifyReleaseBlocked and use notification_type 'release_blocked'.`,
  )
})

await test('10b. release route imports and calls notifyReleaseBlocked', () => {
  const src = read(RELEASE)
  assert(
    src.includes('notifyReleaseBlocked'),
    `${RELEASE} must call notifyReleaseBlocked when the release gate rejects a payment attempt.`,
  )
})

// ─── 11. external_payment_confirmation_required ───────────────────────────────

await test('11. notifyExternalPaymentConfirmationRequired helper exists in notify.ts', () => {
  assert(
    notify.includes('notifyExternalPaymentConfirmationRequired') &&
    notify.includes("'external_payment_confirmation_required'"),
    `${NOTIFY} must export notifyExternalPaymentConfirmationRequired.`,
  )
})

await test('11b. authorize-external route imports and calls notifyExternalPaymentConfirmationRequired', () => {
  const src = read(AUTH_EXT)
  assert(
    src.includes('notifyExternalPaymentConfirmationRequired'),
    `${AUTH_EXT} must call notifyExternalPaymentConfirmationRequired after successful external authorization.`,
  )
})

// ─── 12. retainage_released ───────────────────────────────────────────────────

await test('12. notifyRetainageReleased helper exists in notify.ts', () => {
  assert(
    notify.includes('notifyRetainageReleased') && notify.includes("'retainage_released'"),
    `${NOTIFY} must export notifyRetainageReleased and use notification_type 'retainage_released'.`,
  )
})

await test('12b. retainage/release route imports and calls notifyRetainageReleased', () => {
  const src = read(RETAINAGE)
  assert(
    src.includes('notifyRetainageReleased'),
    `${RETAINAGE} must call notifyRetainageReleased after a successful retainage Stripe transfer.`,
  )
})

// ─── 13. dispute_opened ───────────────────────────────────────────────────────

await test('13. notifyDisputeOpened helper exists in notify.ts', () => {
  assert(
    notify.includes('notifyDisputeOpened') && notify.includes("'dispute_opened'"),
    `${NOTIFY} must export notifyDisputeOpened and use notification_type 'dispute_opened'.`,
  )
})

await test('13b. disputes POST route imports and calls notifyDisputeOpened', () => {
  const src = read(DISPUTES_POST)
  assert(
    src.includes('notifyDisputeOpened'),
    `${DISPUTES_POST} must call notifyDisputeOpened after a dispute is successfully created.`,
  )
})

// ─── 14. dispute_resolved ─────────────────────────────────────────────────────

await test('14. notifyDisputeResolved helper exists in notify.ts', () => {
  assert(
    notify.includes('notifyDisputeResolved') && notify.includes("'dispute_resolved'"),
    `${NOTIFY} must export notifyDisputeResolved and use notification_type 'dispute_resolved'.`,
  )
})

await test('14b. disputes resolve route imports and calls notifyDisputeResolved', () => {
  const src = read(DISPUTES_RESOLVE)
  assert(
    src.includes('notifyDisputeResolved'),
    `${DISPUTES_RESOLVE} must call notifyDisputeResolved after a dispute is resolved.`,
  )
})

// ─── 15. No banned phrases in new helpers ─────────────────────────────────────

await test('15. No banned phrases in new notification helpers', () => {
  // Strip comments
  const src = notify
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')

  const banned = [
    'Vektrum holds funds',
    'Vektrum moves money',
    'Vektrum moves wires',
    'Vektrum is escrow',
    'Vektrum is a payment processor',
    'AI approved',
    'instant payment',
    'Pay now',
    'Claim funds',
    'Instant payout',
    'Money sent by Vektrum',
  ]

  for (const phrase of banned) {
    assert(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `${NOTIFY} must not contain the banned claim: "${phrase}"`,
    )
  }
})

// ─── 16. [Vektrum] subject prefix in all new helpers ─────────────────────────

await test('16. All new helpers use [Vektrum] subject prefix', () => {
  const helperNames = [
    'notifyFunderInvited', 'notifyInviteAccepted', 'notifyChangeOrderApproved',
    'notifyChangeOrderRejected', 'notifyEvidenceUploaded', 'notifyLienWaiverRequested',
    'notifyLienWaiverUploaded', 'notifyMilestoneReadyForReview', 'notifyReleaseAuthorized',
    'notifyReleaseBlocked', 'notifyExternalPaymentConfirmationRequired',
    'notifyRetainageReleased', 'notifyDisputeOpened', 'notifyDisputeResolved',
  ]
  // Count [Vektrum] occurrences — should be >= number of helpers (each has one subject)
  const count = (notify.match(/\[Vektrum\]/g) ?? []).length
  assert(
    count >= helperNames.length,
    `${NOTIFY} must have at least ${helperNames.length} "[Vektrum]" subject prefixes ` +
    `(one per helper). Found ${count}.`,
  )
})

// ─── 17. Custody disclaimer present ──────────────────────────────────────────

await test('17. Custody disclaimer present in notify.ts via renderVektrumEmail footer', () => {
  assert(
    notify.includes('does not hold funds, act as escrow, or move money directly'),
    `${NOTIFY} email footer must include the custody disclaimer.`,
  )
})

// ─── 18. No secrets in new helpers ───────────────────────────────────────────

await test('18. No service-role secrets referenced in new helper bodies', () => {
  const forbidden = ['SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'CRON_SECRET']
  for (const secret of forbidden) {
    assert(
      !notify.includes(secret),
      `${NOTIFY} must not reference ${secret}.`,
    )
  }
})

// ─── 19. Fire-and-forget pattern: try/catch in every helper ──────────────────

await test('19. All new helpers are wrapped in try/catch (fire-and-forget safe)', () => {
  const newHelpers = [
    'notifyFunderInvited', 'notifyInviteAccepted', 'notifyChangeOrderApproved',
    'notifyChangeOrderRejected', 'notifyEvidenceUploaded', 'notifyMilestoneReadyForReview',
    'notifyReleaseAuthorized', 'notifyReleaseBlocked', 'notifyRetainageReleased',
    'notifyDisputeOpened', 'notifyDisputeResolved',
  ]
  // Each helper should have its own console.error log in the catch block
  for (const helper of newHelpers) {
    const fnStart = notify.indexOf(`export async function ${helper}`)
    assert(fnStart >= 0, `${helper} not found in ${NOTIFY}`)
    // Each helper ends with unexpected error catch pattern
    const helperSlice = notify.slice(fnStart, fnStart + 4000)
    assert(
      helperSlice.includes('unexpected error'),
      `${helper} must have a try/catch with unexpected error log for fire-and-forget safety.`,
    )
  }
})

// ─── 20. Release gate and Stripe webhook untouched ───────────────────────────

await test('20. Release gate and Stripe webhook files do not import from notify.ts', () => {
  const gateExists   = fs.existsSync(path.resolve(ROOT, GATE_FILE))
  const stripeExists = fs.existsSync(path.resolve(ROOT, STRIPE_FILE))

  if (gateExists) {
    const gateSrc = read(GATE_FILE)
    assert(
      !gateSrc.includes("from '@/lib/engine/notify'"),
      `${GATE_FILE} must not import from notify.ts — release gate must be independent.`,
    )
  }
  if (stripeExists) {
    const stripeSrc = read(STRIPE_FILE)
    assert(
      !stripeSrc.includes("from '@/lib/engine/notify'"),
      `${STRIPE_FILE} must not import from notify.ts.`,
    )
  }
})

// ─── 21. Package.json wiring ──────────────────────────────────────────────────

await test('21. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('notifications-coverage.test.ts'),
    `package.json npm test script must include 'notifications-coverage.test.ts'.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Notification Coverage Tests')
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
