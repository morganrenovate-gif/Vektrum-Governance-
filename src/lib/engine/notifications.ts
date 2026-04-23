// ─── Transactional Notifications ─────────────────────────────────────────────
//
// Server-side email notifications for critical payment events.
// Uses Resend (already a project dependency) via the RESEND_API_KEY env var.
//
// All functions are fire-and-forget from the caller's perspective — they never
// throw. Failures are logged to the console but do NOT propagate so that a
// notification hiccup never causes a webhook to return 500 (which would make
// Stripe retry the same event endlessly).
//
// EMAIL_FROM    — sender address; defaults to 'Vektrum <noreply@vektrum.io>'
// ADMIN_EMAIL   — comma-separated list of operator addresses that receive
//                 every critical notification
// RESEND_API_KEY — Resend API key

import { Resend } from 'resend'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransferFailureContext {
  milestoneId:      string
  milestoneTitle:   string
  dealId:           string
  dealTitle:        string
  grossAmount:      number
  feeAmount:        number
  failureCode:      string | null
  failureMessage:   string | null
  stripeTransferId: string
  retryUrl:         string   // deep-link to the deal/milestone page
}

export interface RetryAttemptContext {
  milestoneId:      string
  milestoneTitle:   string
  dealId:           string
  dealTitle:        string
  grossAmount:      number
  retryCount:       number
  retryBy:          string   // user display name or email
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[notifications] RESEND_API_KEY is not set — email notifications disabled')
    return null
  }
  return new Resend(key)
}

function getSender(): string {
  return process.env.EMAIL_FROM ?? 'Vektrum <noreply@vektrum.io>'
}

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAIL ?? ''
  return raw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
}

function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`
}

// ─── Transfer Failure Notification ───────────────────────────────────────────

/**
 * Sends payout failure emails to the contractor, funder, and all admin addresses.
 *
 * Never throws — failures are swallowed and logged so that the Stripe webhook
 * handler can still return 200 even if email delivery fails.
 */
export async function notifyTransferFailure(
  ctx: TransferFailureContext,
  contractorEmail: string,
  funderEmail: string,
): Promise<void> {
  const resend = getResend()
  if (!resend) return

  const from        = getSender()
  const adminEmails = getAdminEmails()

  const failureDetail =
    ctx.failureCode
      ? `Failure code: <strong>${ctx.failureCode}</strong>${ctx.failureMessage ? ` — ${ctx.failureMessage}` : ''}`
      : ctx.failureMessage ?? 'No additional details were provided by Stripe.'

  // ── Contractor email ───────────────────────────────────────────────────────
  const contractorHtml = `
    <p>Hi,</p>
    <p>We wanted to let you know that a payment to your account for the milestone
    <strong>"${ctx.milestoneTitle}"</strong> on deal <strong>"${ctx.dealTitle}"</strong>
    was unable to be completed.</p>

    <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr>
        <td style="padding:4px 12px 4px 0;color:#6B7280">Milestone</td>
        <td style="padding:4px 0"><strong>${ctx.milestoneTitle}</strong></td>
      </tr>
      <tr>
        <td style="padding:4px 12px 4px 0;color:#6B7280">Amount</td>
        <td style="padding:4px 0">${formatDollars(ctx.grossAmount)}</td>
      </tr>
      <tr>
        <td style="padding:4px 12px 4px 0;color:#6B7280">Reason</td>
        <td style="padding:4px 0">${failureDetail}</td>
      </tr>
    </table>

    <p>The funder has been notified and will re-initiate the payment once the issue
    is resolved. No action is required from you at this time.</p>

    <p>If you believe your Stripe Connect account settings need to be updated,
    please <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard">log in to your dashboard</a>
    and check your payout settings.</p>

    <p>If you have questions, please contact <a href="mailto:support@vektrum.io">support@vektrum.io</a>.</p>
    ${emailFooter()}
  `

  // ── Funder email ───────────────────────────────────────────────────────────
  const funderHtml = `
    <p>Hi,</p>
    <p>A milestone payout on deal <strong>"${ctx.dealTitle}"</strong> has failed and requires
    your attention.</p>

    <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr>
        <td style="padding:4px 12px 4px 0;color:#6B7280">Milestone</td>
        <td style="padding:4px 0"><strong>${ctx.milestoneTitle}</strong></td>
      </tr>
      <tr>
        <td style="padding:4px 12px 4px 0;color:#6B7280">Amount</td>
        <td style="padding:4px 0">${formatDollars(ctx.grossAmount)}</td>
      </tr>
      <tr>
        <td style="padding:4px 12px 4px 0;color:#6B7280">Stripe Transfer</td>
        <td style="padding:4px 0;font-family:monospace;font-size:12px">${ctx.stripeTransferId}</td>
      </tr>
      <tr>
        <td style="padding:4px 12px 4px 0;color:#6B7280">Reason</td>
        <td style="padding:4px 0">${failureDetail}</td>
      </tr>
    </table>

    <p>The milestone has been reset to <strong>Approved</strong> status. You can
    re-release the payment once the contractor's Stripe account issue is resolved.</p>

    <p style="margin:20px 0">
      <a href="${ctx.retryUrl}"
         style="background:#1A3A96;color:white;padding:10px 20px;border-radius:6px;
                text-decoration:none;font-weight:600;display:inline-block">
        View Milestone
      </a>
    </p>

    <p>If you have questions, please contact <a href="mailto:support@vektrum.io">support@vektrum.io</a>.</p>
    ${emailFooter()}
  `

  // ── Admin email ────────────────────────────────────────────────────────────
  const adminHtml = `
    <p><strong>Transfer Failure Alert</strong></p>

    <table style="border-collapse:collapse;margin:16px 0;font-size:14px;font-family:monospace">
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Deal ID</td>
          <td>${ctx.dealId}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Deal Title</td>
          <td>${ctx.dealTitle}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Milestone ID</td>
          <td>${ctx.milestoneId}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Milestone</td>
          <td>${ctx.milestoneTitle}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Gross Amount</td>
          <td>${formatDollars(ctx.grossAmount)}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Fee Amount</td>
          <td>${formatDollars(ctx.feeAmount)}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Stripe Transfer ID</td>
          <td>${ctx.stripeTransferId}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Failure Code</td>
          <td>${ctx.failureCode ?? '—'}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Failure Message</td>
          <td>${ctx.failureMessage ?? '—'}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Contractor Email</td>
          <td>${contractorEmail}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Funder Email</td>
          <td>${funderEmail}</td></tr>
    </table>

    <p>The milestone has been reset to <strong>payout_failed</strong> status.
    Deal financials have been reversed. Reconciliation will flag this if not
    retried within the window.</p>

    <p><a href="${ctx.retryUrl}">View in dashboard →</a></p>
    ${emailFooter()}
  `

  const sends: Promise<unknown>[] = [
    resend.emails.send({
      from,
      to: contractorEmail,
      subject: `Payout failed for "${ctx.milestoneTitle}" — ${ctx.dealTitle}`,
      html: contractorHtml,
    }),
    resend.emails.send({
      from,
      to: funderEmail,
      subject: `Action required: Payout failed for "${ctx.milestoneTitle}"`,
      html: funderHtml,
    }),
  ]

  if (adminEmails.length > 0) {
    sends.push(
      resend.emails.send({
        from,
        to: adminEmails,
        subject: `[ALERT] Transfer failure — ${ctx.dealTitle} / ${ctx.milestoneTitle}`,
        html: adminHtml,
      }),
    )
  }

  try {
    const results = await Promise.allSettled(sends)
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[notifications] notifyTransferFailure email failed:', result.reason)
      }
    }
  } catch (err) {
    console.error('[notifications] notifyTransferFailure unexpected error:', err)
  }
}

// ─── Retry Notification ───────────────────────────────────────────────────────

/**
 * Sends a confirmation email to the funder when a retry is initiated.
 * Also notifies admin. Contractor is not emailed — they'll receive the
 * success notification once the retried transfer settles.
 */
export async function notifyRetryInitiated(
  ctx: RetryAttemptContext,
  funderEmail: string,
): Promise<void> {
  const resend = getResend()
  if (!resend) return

  const from        = getSender()
  const adminEmails = getAdminEmails()

  const funderHtml = `
    <p>Hi,</p>
    <p>You have initiated a retry for the failed payout on milestone
    <strong>"${ctx.milestoneTitle}"</strong> (deal: <strong>"${ctx.dealTitle}"</strong>).</p>

    <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr>
        <td style="padding:4px 12px 4px 0;color:#6B7280">Milestone</td>
        <td>${ctx.milestoneTitle}</td>
      </tr>
      <tr>
        <td style="padding:4px 12px 4px 0;color:#6B7280">Amount</td>
        <td>${formatDollars(ctx.grossAmount)}</td>
      </tr>
      <tr>
        <td style="padding:4px 12px 4px 0;color:#6B7280">Retry Attempt</td>
        <td>#${ctx.retryCount}</td>
      </tr>
    </table>

    <p>The milestone has been reset to <strong>Approved</strong> status. You can
    now re-release the payment from the deal dashboard.</p>
    ${emailFooter()}
  `

  const adminHtml = `
    <p><strong>Payout Retry Initiated</strong></p>
    <p>Deal: ${ctx.dealTitle} — Milestone: ${ctx.milestoneTitle}</p>
    <p>Amount: ${formatDollars(ctx.grossAmount)} — Attempt: #${ctx.retryCount} — By: ${ctx.retryBy}</p>
    ${emailFooter()}
  `

  const sends: Promise<unknown>[] = [
    resend.emails.send({
      from,
      to: funderEmail,
      subject: `Payout retry initiated for "${ctx.milestoneTitle}"`,
      html: funderHtml,
    }),
  ]

  if (adminEmails.length > 0) {
    sends.push(
      resend.emails.send({
        from,
        to: adminEmails,
        subject: `[INFO] Payout retry — ${ctx.dealTitle} / ${ctx.milestoneTitle}`,
        html: adminHtml,
      }),
    )
  }

  try {
    const results = await Promise.allSettled(sends)
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[notifications] notifyRetryInitiated email failed:', result.reason)
      }
    }
  } catch (err) {
    console.error('[notifications] notifyRetryInitiated unexpected error:', err)
  }
}

// ─── Stripe Account Conflict Notification ────────────────────────────────────

export interface StripeConflictContext {
  /** The Stripe Connect account ID someone tried to claim */
  conflictingStripeAccountId: string
  /** Profile UUID that attempted to claim the account */
  attemptedProfileId: string
  /** Profile UUID that already owns the account */
  existingProfileId: string
  /** Email of the user who triggered the conflict (optional — may not be available) */
  attemptedUserEmail?: string
  /** ISO timestamp when the conflict was detected */
  detectedAt: string
  /** The operation that triggered the conflict: 'INSERT' | 'UPDATE' */
  operation: string
}

/**
 * Notifies all admin addresses immediately when a profile attempts to claim
 * a Stripe Connect account that is already linked to another profile.
 *
 * This is a CRITICAL security event — it may indicate account takeover,
 * a misconfigured onboarding flow, or data integrity corruption.
 *
 * Never throws — swallows failures so the 409 response still reaches the caller.
 */
export async function notifyAdminStripeConflict(ctx: StripeConflictContext): Promise<void> {
  const resend = getResend()
  if (!resend) return

  const adminEmails = getAdminEmails()
  if (adminEmails.length === 0) {
    console.warn('[notifications] notifyAdminStripeConflict: no ADMIN_EMAIL configured — alert not sent')
    return
  }

  const from    = getSender()
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const html = `
    <p style="color:#DC2626;font-weight:bold;font-size:16px">
      🚨 Stripe Account Conflict Detected
    </p>

    <p>A profile attempted to claim a Stripe Connect account that is already
    linked to a different Vektrum profile. This may indicate:</p>
    <ul>
      <li>Account takeover attempt</li>
      <li>Misconfigured Stripe Connect onboarding flow</li>
      <li>Data integrity issue requiring manual review</li>
    </ul>

    <table style="border-collapse:collapse;margin:16px 0;font-size:13px;font-family:monospace;background:#F9FAFB;padding:12px;border-radius:4px;width:100%">
      <tr>
        <td style="padding:4px 16px 4px 0;color:#6B7280;white-space:nowrap">Stripe Account</td>
        <td style="padding:4px 0;font-weight:bold;color:#DC2626">${ctx.conflictingStripeAccountId}</td>
      </tr>
      <tr>
        <td style="padding:4px 16px 4px 0;color:#6B7280;white-space:nowrap">Attempted By</td>
        <td style="padding:4px 0">${ctx.attemptedProfileId}${ctx.attemptedUserEmail ? ` &lt;${ctx.attemptedUserEmail}&gt;` : ''}</td>
      </tr>
      <tr>
        <td style="padding:4px 16px 4px 0;color:#6B7280;white-space:nowrap">Already Owned By</td>
        <td style="padding:4px 0">${ctx.existingProfileId}</td>
      </tr>
      <tr>
        <td style="padding:4px 16px 4px 0;color:#6B7280;white-space:nowrap">Operation</td>
        <td style="padding:4px 0">${ctx.operation}</td>
      </tr>
      <tr>
        <td style="padding:4px 16px 4px 0;color:#6B7280;white-space:nowrap">Detected At</td>
        <td style="padding:4px 0">${new Date(ctx.detectedAt).toUTCString()}</td>
      </tr>
    </table>

    <p><strong>Immediate actions to consider:</strong></p>
    <ol>
      <li>Review the audit_log for action <code>stripe_account_conflict_attempted</code></li>
      <li>Check both profile IDs in the admin dashboard</li>
      <li>If this looks like an attempted takeover, consider disabling the attempting account</li>
      <li>Contact Stripe Support if the account may be compromised</li>
    </ol>

    <p style="margin:20px 0">
      <a href="${appUrl}/dashboard/admin"
         style="background:#DC2626;color:white;padding:10px 20px;border-radius:6px;
                text-decoration:none;font-weight:600;display:inline-block">
        Open Admin Dashboard
      </a>
    </p>
    ${emailFooter()}
  `

  try {
    const { error } = await resend.emails.send({
      from,
      to: adminEmails,
      subject: `🚨 [SECURITY] Stripe account conflict — ${ctx.conflictingStripeAccountId}`,
      html,
    })
    if (error) {
      console.error('[notifications] notifyAdminStripeConflict email failed:', error)
    }
  } catch (err) {
    console.error('[notifications] notifyAdminStripeConflict unexpected error:', err)
  }
}

// ─── Transaction Receipt Notification ────────────────────────────────────────

export interface TransactionReceiptContext {
  receiptId:         string
  receiptNumber:     string   // e.g. VKT-2026-000001
  milestoneTitle:    string
  dealTitle:         string
  dealId:            string
  grossAmount:       number
  feeAmount:         number
  feeBps:            number   // basis points, e.g. 100 = 1.00%
  totalCharged:      number   // gross + fee (funder's debit)
  stripeTransferId:  string
  releasedAt:        string   // ISO string — displayed as exact UTC
  contractorName:    string
  funderName:        string
}

/**
 * Sends receipt emails to the contractor and funder after a successful release.
 * Also notifies admins.
 *
 * Never throws — fires-and-forgets via Promise.allSettled.
 * Caller is responsible for calling markReceiptEmailSent() after this returns.
 */
export async function notifyTransactionReceipt(
  ctx: TransactionReceiptContext,
  contractorEmail: string,
  funderEmail: string,
): Promise<void> {
  const resend = getResend()
  if (!resend) return

  const from        = getSender()
  const adminEmails = getAdminEmails()
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const receiptUrl  = `${appUrl}/dashboard/receipts/${ctx.receiptId}`
  const printUrl    = `${appUrl}/dashboard/receipts/${ctx.receiptId}/print`

  // Format released_at as "YYYY-MM-DD HH:MM:SS UTC"
  const d           = new Date(ctx.releasedAt)
  const pad         = (n: number) => String(n).padStart(2, '0')
  const releasedUtc = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
                      `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
  const feeRatePct  = `${(ctx.feeBps / 100).toFixed(2)}%`

  // ── Shared financial breakdown table ──────────────────────────────────────
  const financialTable = `
    <table style="border-collapse:collapse;margin:16px 0;font-size:14px;width:100%;max-width:480px">
      <tr style="border-bottom:1px solid #E5E7EB">
        <td style="padding:8px 12px 8px 0;color:#6B7280">Receipt Number</td>
        <td style="padding:8px 0;font-family:monospace;font-weight:600">${ctx.receiptNumber}</td>
      </tr>
      <tr style="border-bottom:1px solid #E5E7EB">
        <td style="padding:8px 12px 8px 0;color:#6B7280">Deal</td>
        <td style="padding:8px 0">${ctx.dealTitle}</td>
      </tr>
      <tr style="border-bottom:1px solid #E5E7EB">
        <td style="padding:8px 12px 8px 0;color:#6B7280">Milestone</td>
        <td style="padding:8px 0"><strong>${ctx.milestoneTitle}</strong></td>
      </tr>
      <tr style="border-bottom:1px solid #E5E7EB">
        <td style="padding:8px 12px 8px 0;color:#6B7280">Contractor</td>
        <td style="padding:8px 0">${ctx.contractorName}</td>
      </tr>
      <tr style="border-bottom:1px solid #E5E7EB">
        <td style="padding:8px 12px 8px 0;color:#6B7280">Funder</td>
        <td style="padding:8px 0">${ctx.funderName}</td>
      </tr>
      <tr style="border-bottom:1px solid #E5E7EB">
        <td style="padding:8px 12px 8px 0;color:#6B7280">Milestone Amount</td>
        <td style="padding:8px 0">${formatDollars(ctx.grossAmount)}</td>
      </tr>
      <tr style="border-bottom:1px solid #E5E7EB">
        <td style="padding:8px 12px 8px 0;color:#6B7280">Platform Fee (${feeRatePct})</td>
        <td style="padding:8px 0">${formatDollars(ctx.feeAmount)}</td>
      </tr>
      <tr style="border-bottom:2px solid #111827">
        <td style="padding:8px 12px 8px 0;font-weight:600">Total Charged to Funder</td>
        <td style="padding:8px 0;font-weight:700">${formatDollars(ctx.totalCharged)}</td>
      </tr>
      <tr style="border-bottom:1px solid #E5E7EB">
        <td style="padding:8px 12px 8px 0;color:#6B7280">Stripe Transfer ID</td>
        <td style="padding:8px 0;font-family:monospace;font-size:12px">${ctx.stripeTransferId}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px 8px 0;color:#6B7280">Released (UTC)</td>
        <td style="padding:8px 0;font-family:monospace;font-size:12px">${releasedUtc}</td>
      </tr>
    </table>
  `

  const receiptButtons = `
    <p style="margin:20px 0">
      <a href="${receiptUrl}"
         style="background:#1A3A96;color:white;padding:10px 20px;border-radius:6px;
                text-decoration:none;font-weight:600;display:inline-block;margin-right:8px">
        View Receipt
      </a>
      <a href="${printUrl}"
         style="background:#F3F4F6;color:#374151;padding:10px 20px;border-radius:6px;
                text-decoration:none;font-weight:600;display:inline-block">
        Export / Print PDF
      </a>
    </p>
  `

  // ── Contractor email ───────────────────────────────────────────────────────
  const contractorHtml = `
    <p>Hi,</p>
    <p>Your payment for milestone <strong>"${ctx.milestoneTitle}"</strong> on deal
    <strong>"${ctx.dealTitle}"</strong> has been released. Here is your transaction receipt.</p>

    ${financialTable}

    <p style="color:#6B7280;font-size:13px">
      The funds have been transferred to your connected Stripe account and will
      typically appear within 1–2 business days.
    </p>

    ${receiptButtons}

    <p>If you have questions, please contact
    <a href="mailto:support@vektrum.io">support@vektrum.io</a>.</p>
    ${emailFooter()}
  `

  // ── Funder email ───────────────────────────────────────────────────────────
  const funderHtml = `
    <p>Hi,</p>
    <p>You released payment for milestone <strong>"${ctx.milestoneTitle}"</strong> on deal
    <strong>"${ctx.dealTitle}"</strong>. Here is your transaction receipt for your records.</p>

    ${financialTable}

    <p style="color:#6B7280;font-size:13px">
      This receipt can be shared with your compliance team. Use the "Export / Print PDF"
      button to generate a PDF version.
    </p>

    ${receiptButtons}

    <p>If you have questions, please contact
    <a href="mailto:support@vektrum.io">support@vektrum.io</a>.</p>
    ${emailFooter()}
  `

  // ── Admin notification ─────────────────────────────────────────────────────
  const adminHtml = `
    <p><strong>Milestone Release — Receipt Issued</strong></p>

    <table style="border-collapse:collapse;margin:16px 0;font-size:13px;font-family:monospace;background:#F9FAFB;padding:12px;border-radius:4px;width:100%">
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Receipt #</td>
          <td style="font-weight:bold">${ctx.receiptNumber}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Deal</td>
          <td>${ctx.dealTitle} (${ctx.dealId})</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Milestone</td>
          <td>${ctx.milestoneTitle}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Contractor</td>
          <td>${ctx.contractorName} &lt;${contractorEmail}&gt;</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Funder</td>
          <td>${ctx.funderName} &lt;${funderEmail}&gt;</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Gross</td>
          <td>${formatDollars(ctx.grossAmount)}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Fee (${feeRatePct})</td>
          <td>${formatDollars(ctx.feeAmount)}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Total Charged</td>
          <td style="font-weight:bold">${formatDollars(ctx.totalCharged)}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Transfer ID</td>
          <td>${ctx.stripeTransferId}</td></tr>
      <tr><td style="padding:3px 16px 3px 0;color:#6B7280">Released At</td>
          <td>${releasedUtc}</td></tr>
    </table>

    <p><a href="${receiptUrl}">View receipt in dashboard →</a></p>
    ${emailFooter()}
  `

  const sends: Promise<unknown>[] = [
    resend.emails.send({
      from,
      to:      contractorEmail,
      subject: `Payment received: ${formatDollars(ctx.grossAmount)} — "${ctx.milestoneTitle}"`,
      html:    contractorHtml,
    }),
    resend.emails.send({
      from,
      to:      funderEmail,
      subject: `Receipt: Payment released — "${ctx.milestoneTitle}" (${ctx.receiptNumber})`,
      html:    funderHtml,
    }),
  ]

  if (adminEmails.length > 0) {
    sends.push(
      resend.emails.send({
        from,
        to:      adminEmails,
        subject: `[Receipt] ${ctx.receiptNumber} — ${ctx.dealTitle} / ${ctx.milestoneTitle}`,
        html:    adminHtml,
      }),
    )
  }

  try {
    const results = await Promise.allSettled(sends)
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[notifications] notifyTransactionReceipt email failed:', result.reason)
      }
    }
  } catch (err) {
    console.error('[notifications] notifyTransactionReceipt unexpected error:', err)
  }
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function emailFooter(): string {
  return `
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0" />
    <p style="color:#9CA3AF;font-size:12px">
      Vektrum · Construction payment governance · Powered by Stripe Connect<br/>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#9CA3AF">vektrum.io</a>
    </p>
  `
}
