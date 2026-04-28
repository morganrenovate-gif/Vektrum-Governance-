// ─── Vektrum Production Notification Foundation ───────────────────────────────
//
// DB-backed notification records + branded email delivery via Resend.
//
// Architecture
//   1. createNotification()         — inserts a 'pending' row into notifications.
//   2. sendEmailNotification()      — calls Resend, then updates status to
//                                     'sent' | 'failed' | 'skipped'.
//   3. renderVektrumEmail()         — single branded HTML template for all events.
//   4. notifyChangeOrderSubmitted() — the first wired production event.
//
// Safety contracts
//   - Every exported function is fire-and-forget safe: never throws.
//   - If RESEND_API_KEY is absent, status is set to 'skipped' and a console.warn
//     is emitted — email delivery is degraded gracefully, not crashed.
//   - No secrets, API keys, or tokens are written into notification rows.
//   - The custody disclaimer is required in every email footer.
//
// Copy rules (enforced by tests/notifications-foundation.test.ts)
//   ✓  Subject: [Vektrum] <action>
//   ✓  CTA labels: "Review in Vektrum" | "View deal" | "Review change order" |
//                  "Upload lien waiver" | "View release status"
//   ✗  Never: "holds funds" | "escrow" | "moves money" | "moves wires" |
//             "payment processor" | "AI approved" | "instant payment" |
//             "Pay now" | "Claim funds" | "Instant payout" | "Money sent by Vektrum"

import { Resend } from 'resend'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/engine/audit'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'in_app'
export type NotificationStatus  = 'pending' | 'sent' | 'failed' | 'skipped'

export interface CreateNotificationParams {
  recipient_user_id?: string | null
  recipient_email?:   string | null
  deal_id?:           string | null
  entity_type:        string
  entity_id:          string
  notification_type:  string
  channel:            NotificationChannel
  subject?:           string | null
  body_summary?:      string | null
}

export interface EmailTemplateOpts {
  /** Short status label shown in the coloured badge, e.g. "Change Order" */
  badge:      string
  /** Main headline, e.g. "A change order has been submitted" */
  headline:   string
  /** One or two sentence summary paragraph */
  summary:    string
  /** Key/value pairs shown in the details table — no secrets */
  details?:   Array<{ label: string; value: string }>
  /** CTA button label — must use approved copy */
  ctaLabel:   string
  /** CTA destination URL */
  ctaUrl:     string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function getSender(): string {
  return process.env.EMAIL_FROM ?? 'Vektrum <noreply@vektrum.io>'
}

// ─── Branded email template ───────────────────────────────────────────────────

/**
 * Renders a complete, self-contained Vektrum-branded HTML email.
 *
 * The template includes:
 *   - Vektrum header bar (dark navy)
 *   - Coloured status badge
 *   - Headline + summary
 *   - Optional details table
 *   - CTA button (approved copy only)
 *   - Custody disclaimer footer (required on every email)
 *
 * The footer always includes the custody disclaimer:
 *   "Vektrum is release-control infrastructure for construction disbursements.
 *    Vektrum does not hold funds, act as escrow, or move money directly."
 */
export function renderVektrumEmail(opts: EmailTemplateOpts): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

  const detailsHtml = opts.details && opts.details.length > 0
    ? `
      <table style="border-collapse:collapse;width:100%;max-width:480px;margin:20px 0;font-size:14px">
        ${opts.details.map(({ label, value }) => `
          <tr style="border-bottom:1px solid #E5E7EB">
            <td style="padding:8px 16px 8px 0;color:#6B7280;white-space:nowrap;font-size:13px">${escapeHtml(label)}</td>
            <td style="padding:8px 0;color:#111827;font-weight:500">${escapeHtml(value)}</td>
          </tr>`).join('')}
      </table>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.headline)}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.12)">

    <!-- ── Vektrum header ── -->
    <div style="background:#0A1628;padding:24px 32px;border-bottom:3px solid #1A4FCC">
      <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px">Vektrum</span>
      <span style="color:#94A3B8;font-size:12px;margin-left:10px;vertical-align:middle">Construction Disbursement Governance</span>
    </div>

    <!-- ── Body ── -->
    <div style="padding:32px">

      <!-- Badge -->
      <div style="display:inline-block;background:#EFF6FF;color:#1D4ED8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:4px 10px;border-radius:100px;margin-bottom:16px">
        ${escapeHtml(opts.badge)}
      </div>

      <!-- Headline -->
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0F172A;line-height:1.3">
        ${escapeHtml(opts.headline)}
      </h1>

      <!-- Summary -->
      <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6">
        ${escapeHtml(opts.summary)}
      </p>

      <!-- Details table -->
      ${detailsHtml}

      <!-- CTA button -->
      <p style="margin:28px 0 0">
        <a href="${opts.ctaUrl}"
           style="display:inline-block;background:#1A4FCC;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.01em">
          ${escapeHtml(opts.ctaLabel)}
        </a>
      </p>

    </div>

    <!-- ── Footer with mandatory custody disclaimer ── -->
    <div style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:20px 32px">
      <p style="margin:0 0 6px;font-size:11px;color:#94A3B8;line-height:1.5">
        Vektrum is release-control infrastructure for construction disbursements.
        Vektrum does not hold funds, act as escrow, or move money directly.
      </p>
      <p style="margin:0;font-size:11px;color:#CBD5E1">
        <a href="${appUrl}" style="color:#94A3B8;text-decoration:none">Vektrum</a>
        &nbsp;·&nbsp; Construction payment governance
        &nbsp;·&nbsp; <a href="mailto:support@vektrum.io" style="color:#94A3B8;text-decoration:none">support@vektrum.io</a>
      </p>
    </div>

  </div>
</body>
</html>`
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/**
 * Inserts a 'pending' notification record.
 * Returns the new row id, or null on failure (never throws).
 */
export async function createNotification(
  params: CreateNotificationParams,
): Promise<string | null> {
  try {
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin
      .from('notifications')
      .insert({
        recipient_user_id: params.recipient_user_id ?? null,
        recipient_email:   params.recipient_email   ?? null,
        deal_id:           params.deal_id            ?? null,
        entity_type:       params.entity_type,
        entity_id:         params.entity_id,
        notification_type: params.notification_type,
        channel:           params.channel,
        status:            'pending',
        subject:           params.subject            ?? null,
        body_summary:      params.body_summary       ?? null,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[notify] createNotification failed:', error?.message)
      return null
    }
    return data.id as string
  } catch (err) {
    console.error('[notify] createNotification unexpected error:', err)
    return null
  }
}

/** Updates notification delivery status after a send attempt. Never throws. */
async function updateNotificationStatus(
  id: string,
  status: NotificationStatus,
  errorMessage?: string,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    await admin
      .from('notifications')
      .update({
        status,
        sent_at:       status === 'sent' ? new Date().toISOString() : null,
        error_message: errorMessage ?? null,
      })
      .eq('id', id)
  } catch (err) {
    console.error('[notify] updateNotificationStatus failed:', err)
  }
}

// ─── Email delivery ───────────────────────────────────────────────────────────

/**
 * Sends an email via Resend and updates the notification row status.
 *
 * If RESEND_API_KEY is absent, status is set to 'skipped'.
 * On send failure, status is set to 'failed' with the provider error message.
 * Never throws.
 */
export async function sendEmailNotification(
  notificationId: string,
  to:             string,
  subject:        string,
  html:           string,
): Promise<void> {
  const resend = getResend()

  if (!resend) {
    console.warn('[notify] RESEND_API_KEY not set — notification skipped:', notificationId)
    await updateNotificationStatus(notificationId, 'skipped', 'RESEND_API_KEY not configured')
    return
  }

  try {
    const { error } = await resend.emails.send({
      from:    getSender(),
      to,
      subject,
      html,
    })

    if (error) {
      console.error('[notify] email send failed:', error)
      await updateNotificationStatus(notificationId, 'failed', String(error))
    } else {
      await updateNotificationStatus(notificationId, 'sent')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[notify] email send threw:', msg)
    await updateNotificationStatus(notificationId, 'failed', msg)
  }
}

// ─── Wired events ─────────────────────────────────────────────────────────────

/**
 * Notifies the funder when a contractor submits a change order.
 *
 * Fire-and-forget — never throws. Wire after a successful change_order INSERT.
 *
 * Context fetched internally (deal title, milestone title, funder email) so
 * that the calling route passes only the IDs it already has in scope.
 */
export async function notifyChangeOrderSubmitted(ctx: {
  changeOrderId: string
  milestoneId:   string
  dealId:        string
  amount:        number
  description:   string
  contractorId:  string
}): Promise<void> {
  try {
    const admin   = createSupabaseAdminClient()
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

    // ── Fetch deal + milestone context ────────────────────────────────────────
    const [dealResult, milestoneResult, contractorResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('deals').select('id, title, funder_id').eq('id', ctx.dealId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('milestones').select('id, title').eq('id', ctx.milestoneId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('profiles').select('full_name, company_name').eq('id', ctx.contractorId).single(),
    ])

    if (dealResult.error || !dealResult.data) {
      console.warn('[notify] notifyChangeOrderSubmitted: deal not found', ctx.dealId)
      return
    }
    const deal       = dealResult.data
    const milestone  = milestoneResult.data
    const contractor = contractorResult.data

    if (!deal.funder_id) {
      console.warn('[notify] notifyChangeOrderSubmitted: deal has no funder yet', ctx.dealId)
      return
    }

    // ── Resolve funder email ──────────────────────────────────────────────────
    const { data: authData } = await admin.auth.admin.getUserById(deal.funder_id)
    const funderEmail = authData?.user?.email ?? null

    if (!funderEmail) {
      console.warn('[notify] notifyChangeOrderSubmitted: funder email not found', deal.funder_id)
      return
    }

    // ── Build content ─────────────────────────────────────────────────────────
    const milestoneTitle  = milestone?.title ?? ctx.milestoneId
    const contractorName  = contractor?.full_name ?? contractor?.company_name ?? 'The contractor'
    const amountFormatted = `${ctx.amount > 0 ? '+' : ''}$${Math.abs(ctx.amount).toFixed(2)}`
    const ctaUrl          = `${appUrl}/dashboard/deals/${ctx.dealId}`
    const subject         = `[Vektrum] Change order submitted — ${deal.title}`
    const bodySummary     = `${contractorName} submitted a change order (${amountFormatted}) on "${milestoneTitle}". Review and approve or reject in Vektrum.`

    // ── Create notification record (pending) ──────────────────────────────────
    const notificationId = await createNotification({
      recipient_user_id: deal.funder_id,
      recipient_email:   funderEmail,
      deal_id:           ctx.dealId,
      entity_type:       'change_order',
      entity_id:         ctx.changeOrderId,
      notification_type: 'change_order_submitted',
      channel:           'email',
      subject,
      body_summary:      bodySummary,
    })

    if (!notificationId) {
      console.warn('[notify] notifyChangeOrderSubmitted: createNotification returned null — skipping send')
      return
    }

    // ── Render email ──────────────────────────────────────────────────────────
    const html = renderVektrumEmail({
      badge:    'Change Order',
      headline: 'A change order has been submitted',
      summary:  bodySummary,
      details: [
        { label: 'Deal',         value: deal.title },
        { label: 'Milestone',    value: milestoneTitle },
        { label: 'Amount',       value: amountFormatted },
        { label: 'Description',  value: ctx.description.slice(0, 200) },
        { label: 'Submitted by', value: contractorName },
      ],
      ctaLabel: 'Review change order',
      ctaUrl,
    })

    // ── Send ──────────────────────────────────────────────────────────────────
    await sendEmailNotification(notificationId, funderEmail, subject, html)

    // ── Audit ─────────────────────────────────────────────────────────────────
    await logAudit({
      entity_type:   'notification',
      entity_id:     notificationId,
      action:        'notification_created',
      actor_id:      ctx.contractorId,
      actor_role:    'contractor',
      system_source: 'lib/engine/notify',
      metadata: {
        notification_type: 'change_order_submitted',
        channel:           'email',
        deal_id:           ctx.dealId,
        change_order_id:   ctx.changeOrderId,
      },
    })

  } catch (err) {
    // Safety net — must never propagate to callers
    console.error('[notify] notifyChangeOrderSubmitted unexpected error:', err)
  }
}

// ─── Internal utility ─────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
