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

// ─── Admin email list helper ──────────────────────────────────────────────────
// Kept private — resolves ADMIN_EMAIL env var to a list, same as notifications.ts.
function getAdminEmailsList(): string[] {
  const raw = process.env.ADMIN_EMAIL ?? ''
  return raw.split(',').map(e => e.trim()).filter(Boolean)
}

// ─── 2. notifyFunderInvited ───────────────────────────────────────────────────
/**
 * Notifies the invited funder that they have been invited to fund a deal.
 * The funder may not be in the system yet — email is passed directly.
 * Fire-and-forget. Wire after a successful deal_invites INSERT.
 */
export async function notifyFunderInvited(ctx: {
  inviteId:     string
  dealId:       string
  token:        string
  funderEmail:  string
  contractorId: string
  expiresAt:    string
}): Promise<void> {
  try {
    const admin  = createSupabaseAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [dealResult, contractorResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('deals').select('id, title').eq('id', ctx.dealId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('profiles').select('full_name, company_name').eq('id', ctx.contractorId).single(),
    ])

    if (dealResult.error || !dealResult.data) {
      console.warn('[notify] notifyFunderInvited: deal not found', ctx.dealId)
      return
    }
    const deal           = dealResult.data
    const contractor     = contractorResult.data
    const contractorName = contractor?.full_name ?? contractor?.company_name ?? 'A contractor'
    const expiryDate     = new Date(ctx.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const ctaUrl         = `${appUrl}/invite/${ctx.token}`
    const subject        = `[Vektrum] You've been invited to fund "${deal.title}"`
    const bodySummary    = `${contractorName} has invited you to fund "${deal.title}" on Vektrum. Review the deal and accept your invitation before ${expiryDate}.`

    const notificationId = await createNotification({
      recipient_email:   ctx.funderEmail,
      deal_id:           ctx.dealId,
      entity_type:       'deal_invite',
      entity_id:         ctx.inviteId,
      notification_type: 'funder_invited',
      channel:           'email',
      subject,
      body_summary:      bodySummary,
    })
    if (!notificationId) return

    const html = renderVektrumEmail({
      badge:    'Deal Invitation',
      headline: `You've been invited to fund a construction project`,
      summary:  bodySummary,
      details: [
        { label: 'Deal',       value: deal.title },
        { label: 'Invited by', value: contractorName },
        { label: 'Expires',    value: expiryDate },
      ],
      ctaLabel: 'Review deal invitation',
      ctaUrl,
    })

    await sendEmailNotification(notificationId, ctx.funderEmail, subject, html)

    await logAudit({
      entity_type:   'notification',
      entity_id:     notificationId,
      action:        'notification_created',
      actor_id:      ctx.contractorId,
      actor_role:    'contractor',
      system_source: 'lib/engine/notify',
      metadata: { notification_type: 'funder_invited', channel: 'email', deal_id: ctx.dealId, invite_id: ctx.inviteId },
    })
  } catch (err) {
    console.error('[notify] notifyFunderInvited unexpected error:', err)
  }
}

// ─── 3. notifyInviteAccepted ──────────────────────────────────────────────────
/**
 * Notifies the contractor when a funder accepts their deal invitation.
 * Fire-and-forget. Wire after the dual audit events in accept/route.ts.
 */
export async function notifyInviteAccepted(ctx: {
  inviteId:     string
  dealId:       string
  funderId:     string
  contractorId: string
}): Promise<void> {
  try {
    const admin  = createSupabaseAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

    const [dealResult, funderResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('deals').select('id, title').eq('id', ctx.dealId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('profiles').select('full_name, company_name').eq('id', ctx.funderId).single(),
    ])

    if (dealResult.error || !dealResult.data) {
      console.warn('[notify] notifyInviteAccepted: deal not found', ctx.dealId)
      return
    }
    const deal   = dealResult.data
    const funder = funderResult.data

    const { data: authData } = await admin.auth.admin.getUserById(ctx.contractorId)
    const contractorEmail = authData?.user?.email ?? null
    if (!contractorEmail) {
      console.warn('[notify] notifyInviteAccepted: contractor email not found', ctx.contractorId)
      return
    }

    const funderName  = funder?.full_name ?? funder?.company_name ?? 'A funder'
    const ctaUrl      = `${appUrl}/dashboard/deals/${ctx.dealId}`
    const subject     = `[Vektrum] Funder accepted your invitation — ${deal.title}`
    const bodySummary = `${funderName} accepted your deal invitation and is now the funder for "${deal.title}". You can proceed with the project in your deal room.`

    const notificationId = await createNotification({
      recipient_user_id: ctx.contractorId,
      recipient_email:   contractorEmail,
      deal_id:           ctx.dealId,
      entity_type:       'deal_invite',
      entity_id:         ctx.inviteId,
      notification_type: 'invite_accepted',
      channel:           'email',
      subject,
      body_summary:      bodySummary,
    })
    if (!notificationId) return

    const html = renderVektrumEmail({
      badge:    'Invite Accepted',
      headline: 'A funder has accepted your invitation',
      summary:  bodySummary,
      details: [
        { label: 'Deal',   value: deal.title },
        { label: 'Funder', value: funderName },
      ],
      ctaLabel: 'View deal',
      ctaUrl,
    })

    await sendEmailNotification(notificationId, contractorEmail, subject, html)

    await logAudit({
      entity_type:   'notification',
      entity_id:     notificationId,
      action:        'notification_created',
      actor_id:      ctx.funderId,
      actor_role:    'funder',
      system_source: 'lib/engine/notify',
      metadata: { notification_type: 'invite_accepted', channel: 'email', deal_id: ctx.dealId, invite_id: ctx.inviteId },
    })
  } catch (err) {
    console.error('[notify] notifyInviteAccepted unexpected error:', err)
  }
}

// ─── 4. notifyChangeOrderApproved ────────────────────────────────────────────
/**
 * Notifies the contractor when a funder approves their change order.
 * Fire-and-forget. Wire after logAudit in change-orders PATCH route.
 */
export async function notifyChangeOrderApproved(ctx: {
  changeOrderId: string
  milestoneId:   string
  dealId:        string
  amount:        number
  contractorId:  string
  funderId:      string
}): Promise<void> {
  try {
    const admin  = createSupabaseAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

    const [dealResult, milestoneResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('deals').select('id, title').eq('id', ctx.dealId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('milestones').select('id, title').eq('id', ctx.milestoneId).single(),
    ])

    if (dealResult.error || !dealResult.data) {
      console.warn('[notify] notifyChangeOrderApproved: deal not found', ctx.dealId)
      return
    }

    const { data: authData } = await admin.auth.admin.getUserById(ctx.contractorId)
    const contractorEmail = authData?.user?.email ?? null
    if (!contractorEmail) return

    const deal            = dealResult.data
    const milestone       = milestoneResult.data
    const amountFormatted = `${ctx.amount > 0 ? '+' : ''}$${Math.abs(ctx.amount).toFixed(2)}`
    const milestoneTitle  = milestone?.title ?? ctx.milestoneId
    const ctaUrl          = `${appUrl}/dashboard/deals/${ctx.dealId}`
    const subject         = `[Vektrum] Change order approved — ${deal.title}`
    const bodySummary     = `Your change order (${amountFormatted}) on "${milestoneTitle}" has been approved. The milestone amount has been updated.`

    const notificationId = await createNotification({
      recipient_user_id: ctx.contractorId,
      recipient_email:   contractorEmail,
      deal_id:           ctx.dealId,
      entity_type:       'change_order',
      entity_id:         ctx.changeOrderId,
      notification_type: 'change_order_approved',
      channel:           'email',
      subject,
      body_summary:      bodySummary,
    })
    if (!notificationId) return

    const html = renderVektrumEmail({
      badge:    'Change Order',
      headline: 'Your change order has been approved',
      summary:  bodySummary,
      details: [
        { label: 'Deal',      value: deal.title },
        { label: 'Milestone', value: milestoneTitle },
        { label: 'Amount',    value: amountFormatted },
      ],
      ctaLabel: 'View deal',
      ctaUrl,
    })

    await sendEmailNotification(notificationId, contractorEmail, subject, html)

    await logAudit({
      entity_type:   'notification',
      entity_id:     notificationId,
      action:        'notification_created',
      actor_id:      ctx.funderId,
      actor_role:    'funder',
      system_source: 'lib/engine/notify',
      metadata: { notification_type: 'change_order_approved', deal_id: ctx.dealId, change_order_id: ctx.changeOrderId },
    })
  } catch (err) {
    console.error('[notify] notifyChangeOrderApproved unexpected error:', err)
  }
}

// ─── 5. notifyChangeOrderRejected ────────────────────────────────────────────
/**
 * Notifies the contractor when a funder rejects their change order.
 * Fire-and-forget. Wire after logAudit in change-orders PATCH route.
 */
export async function notifyChangeOrderRejected(ctx: {
  changeOrderId: string
  milestoneId:   string
  dealId:        string
  amount:        number
  contractorId:  string
  funderId:      string
}): Promise<void> {
  try {
    const admin  = createSupabaseAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

    const [dealResult, milestoneResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('deals').select('id, title').eq('id', ctx.dealId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('milestones').select('id, title').eq('id', ctx.milestoneId).single(),
    ])

    if (dealResult.error || !dealResult.data) {
      console.warn('[notify] notifyChangeOrderRejected: deal not found', ctx.dealId)
      return
    }

    const { data: authData } = await admin.auth.admin.getUserById(ctx.contractorId)
    const contractorEmail = authData?.user?.email ?? null
    if (!contractorEmail) return

    const deal            = dealResult.data
    const milestone       = milestoneResult.data
    const amountFormatted = `${ctx.amount > 0 ? '+' : ''}$${Math.abs(ctx.amount).toFixed(2)}`
    const milestoneTitle  = milestone?.title ?? ctx.milestoneId
    const ctaUrl          = `${appUrl}/dashboard/deals/${ctx.dealId}`
    const subject         = `[Vektrum] Change order rejected — ${deal.title}`
    const bodySummary     = `Your change order (${amountFormatted}) on "${milestoneTitle}" has been rejected by the funder. You may submit a revised change order.`

    const notificationId = await createNotification({
      recipient_user_id: ctx.contractorId,
      recipient_email:   contractorEmail,
      deal_id:           ctx.dealId,
      entity_type:       'change_order',
      entity_id:         ctx.changeOrderId,
      notification_type: 'change_order_rejected',
      channel:           'email',
      subject,
      body_summary:      bodySummary,
    })
    if (!notificationId) return

    const html = renderVektrumEmail({
      badge:    'Change Order',
      headline: 'Your change order has been rejected',
      summary:  bodySummary,
      details: [
        { label: 'Deal',      value: deal.title },
        { label: 'Milestone', value: milestoneTitle },
        { label: 'Amount',    value: amountFormatted },
      ],
      ctaLabel: 'View deal',
      ctaUrl,
    })

    await sendEmailNotification(notificationId, contractorEmail, subject, html)

    await logAudit({
      entity_type:   'notification',
      entity_id:     notificationId,
      action:        'notification_created',
      actor_id:      ctx.funderId,
      actor_role:    'funder',
      system_source: 'lib/engine/notify',
      metadata: { notification_type: 'change_order_rejected', deal_id: ctx.dealId, change_order_id: ctx.changeOrderId },
    })
  } catch (err) {
    console.error('[notify] notifyChangeOrderRejected unexpected error:', err)
  }
}

// ─── 6. notifyEvidenceUploaded ────────────────────────────────────────────────
/**
 * Notifies the funder when a contractor uploads a supporting document.
 * Fire-and-forget. Wire after logAudit in milestones/[id]/documents POST route.
 */
export async function notifyEvidenceUploaded(ctx: {
  documentId:   string
  milestoneId:  string
  dealId:       string
  contractorId: string
  fileType?:    string
}): Promise<void> {
  try {
    const admin  = createSupabaseAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

    const [dealResult, milestoneResult, contractorResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('deals').select('id, title, funder_id').eq('id', ctx.dealId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('milestones').select('id, title').eq('id', ctx.milestoneId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('profiles').select('full_name, company_name').eq('id', ctx.contractorId).single(),
    ])

    if (dealResult.error || !dealResult.data) return
    const deal = dealResult.data
    if (!deal.funder_id) return

    const { data: authData } = await admin.auth.admin.getUserById(deal.funder_id)
    const funderEmail = authData?.user?.email ?? null
    if (!funderEmail) return

    const milestone      = milestoneResult.data
    const contractor     = contractorResult.data
    const contractorName = contractor?.full_name ?? contractor?.company_name ?? 'The contractor'
    const milestoneTitle = milestone?.title ?? ctx.milestoneId
    const fileTypeLabel  = ctx.fileType === 'photo' ? 'photo'
      : ctx.fileType === 'change_order' ? 'change order document'
      : 'document'
    const ctaUrl         = `${appUrl}/dashboard/deals/${ctx.dealId}`
    const subject        = `[Vektrum] Evidence uploaded — ${deal.title}`
    const bodySummary    = `${contractorName} uploaded a ${fileTypeLabel} to milestone "${milestoneTitle}" on "${deal.title}". Review the evidence before approving the milestone.`

    const notificationId = await createNotification({
      recipient_user_id: deal.funder_id,
      recipient_email:   funderEmail,
      deal_id:           ctx.dealId,
      entity_type:       'milestone_document',
      entity_id:         ctx.documentId,
      notification_type: 'evidence_uploaded',
      channel:           'email',
      subject,
      body_summary:      bodySummary,
    })
    if (!notificationId) return

    const html = renderVektrumEmail({
      badge:    'Evidence',
      headline: 'Supporting evidence has been uploaded',
      summary:  bodySummary,
      details: [
        { label: 'Deal',        value: deal.title },
        { label: 'Milestone',   value: milestoneTitle },
        { label: 'File type',   value: fileTypeLabel },
        { label: 'Uploaded by', value: contractorName },
      ],
      ctaLabel: 'Review in Vektrum',
      ctaUrl,
    })

    await sendEmailNotification(notificationId, funderEmail, subject, html)

    await logAudit({
      entity_type:   'notification',
      entity_id:     notificationId,
      action:        'notification_created',
      actor_id:      ctx.contractorId,
      actor_role:    'contractor',
      system_source: 'lib/engine/notify',
      metadata: { notification_type: 'evidence_uploaded', deal_id: ctx.dealId, document_id: ctx.documentId },
    })
  } catch (err) {
    console.error('[notify] notifyEvidenceUploaded unexpected error:', err)
  }
}

// ─── 7. notifyLienWaiverRequested ─────────────────────────────────────────────
/**
 * Notifies the contractor when a funder requests a lien waiver.
 * Fire-and-forget. Wire after lien waiver request is created.
 */
export async function notifyLienWaiverRequested(ctx: {
  waiverId:    string
  milestoneId: string
  dealId:      string
  funderId:    string
}): Promise<void> {
  try {
    const admin  = createSupabaseAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

    const [dealResult, milestoneResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('deals').select('id, title, contractor_id').eq('id', ctx.dealId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('milestones').select('id, title').eq('id', ctx.milestoneId).single(),
    ])

    if (dealResult.error || !dealResult.data) return
    const deal = dealResult.data

    const { data: authData } = await admin.auth.admin.getUserById(deal.contractor_id)
    const contractorEmail = authData?.user?.email ?? null
    if (!contractorEmail) return

    const milestone      = milestoneResult.data
    const milestoneTitle = milestone?.title ?? ctx.milestoneId
    const ctaUrl         = `${appUrl}/dashboard/deals/${ctx.dealId}`
    const subject        = `[Vektrum] Lien waiver requested — ${deal.title}`
    const bodySummary    = `The funder has requested a lien waiver for milestone "${milestoneTitle}" on "${deal.title}". Upload the signed waiver to proceed with release.`

    const notificationId = await createNotification({
      recipient_user_id: deal.contractor_id,
      recipient_email:   contractorEmail,
      deal_id:           ctx.dealId,
      entity_type:       'lien_waiver',
      entity_id:         ctx.waiverId,
      notification_type: 'lien_waiver_requested',
      channel:           'email',
      subject,
      body_summary:      bodySummary,
    })
    if (!notificationId) return

    const html = renderVektrumEmail({
      badge:    'Lien Waiver',
      headline: 'A lien waiver has been requested',
      summary:  bodySummary,
      details: [
        { label: 'Deal',      value: deal.title },
        { label: 'Milestone', value: milestoneTitle },
      ],
      ctaLabel: 'Upload lien waiver',
      ctaUrl,
    })

    await sendEmailNotification(notificationId, contractorEmail, subject, html)

    await logAudit({
      entity_type:   'notification',
      entity_id:     notificationId,
      action:        'notification_created',
      actor_id:      ctx.funderId,
      actor_role:    'funder',
      system_source: 'lib/engine/notify',
      metadata: { notification_type: 'lien_waiver_requested', deal_id: ctx.dealId, waiver_id: ctx.waiverId },
    })
  } catch (err) {
    console.error('[notify] notifyLienWaiverRequested unexpected error:', err)
  }
}

// ─── 8. notifyLienWaiverUploaded ──────────────────────────────────────────────
/**
 * Notifies the funder when a contractor uploads a lien waiver.
 * Fire-and-forget. Wire after logAudit in lien-waivers/[id]/upload route.
 */
export async function notifyLienWaiverUploaded(ctx: {
  waiverId:     string
  milestoneId:  string
  dealId:       string
  contractorId: string
}): Promise<void> {
  try {
    const admin  = createSupabaseAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

    const [dealResult, milestoneResult, contractorResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('deals').select('id, title, funder_id').eq('id', ctx.dealId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('milestones').select('id, title').eq('id', ctx.milestoneId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('profiles').select('full_name, company_name').eq('id', ctx.contractorId).single(),
    ])

    if (dealResult.error || !dealResult.data) return
    const deal = dealResult.data
    if (!deal.funder_id) return

    const { data: authData } = await admin.auth.admin.getUserById(deal.funder_id)
    const funderEmail = authData?.user?.email ?? null
    if (!funderEmail) return

    const milestone      = milestoneResult.data
    const contractor     = contractorResult.data
    const contractorName = contractor?.full_name ?? contractor?.company_name ?? 'The contractor'
    const milestoneTitle = milestone?.title ?? ctx.milestoneId
    const ctaUrl         = `${appUrl}/dashboard/deals/${ctx.dealId}`
    const subject        = `[Vektrum] Lien waiver uploaded — ${deal.title}`
    const bodySummary    = `${contractorName} uploaded a lien waiver for milestone "${milestoneTitle}" on "${deal.title}". Review and approve or reject the waiver.`

    const notificationId = await createNotification({
      recipient_user_id: deal.funder_id,
      recipient_email:   funderEmail,
      deal_id:           ctx.dealId,
      entity_type:       'lien_waiver',
      entity_id:         ctx.waiverId,
      notification_type: 'lien_waiver_uploaded',
      channel:           'email',
      subject,
      body_summary:      bodySummary,
    })
    if (!notificationId) return

    const html = renderVektrumEmail({
      badge:    'Lien Waiver',
      headline: 'A lien waiver has been uploaded for review',
      summary:  bodySummary,
      details: [
        { label: 'Deal',        value: deal.title },
        { label: 'Milestone',   value: milestoneTitle },
        { label: 'Uploaded by', value: contractorName },
      ],
      ctaLabel: 'Review in Vektrum',
      ctaUrl,
    })

    await sendEmailNotification(notificationId, funderEmail, subject, html)

    await logAudit({
      entity_type:   'notification',
      entity_id:     notificationId,
      action:        'notification_created',
      actor_id:      ctx.contractorId,
      actor_role:    'contractor',
      system_source: 'lib/engine/notify',
      metadata: { notification_type: 'lien_waiver_uploaded', deal_id: ctx.dealId, waiver_id: ctx.waiverId },
    })
  } catch (err) {
    console.error('[notify] notifyLienWaiverUploaded unexpected error:', err)
  }
}

// ─── 9. notifyMilestoneReadyForReview ────────────────────────────────────────
/**
 * Notifies the funder when a contractor marks a milestone ready for review.
 * Fire-and-forget. Wire in milestone transition route when new_status = 'ready_for_review'.
 */
export async function notifyMilestoneReadyForReview(ctx: {
  milestoneId:  string
  dealId:       string
  contractorId: string
}): Promise<void> {
  try {
    const admin  = createSupabaseAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

    const [dealResult, milestoneResult, contractorResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('deals').select('id, title, funder_id').eq('id', ctx.dealId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('milestones').select('id, title, amount').eq('id', ctx.milestoneId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('profiles').select('full_name, company_name').eq('id', ctx.contractorId).single(),
    ])

    if (dealResult.error || !dealResult.data) return
    const deal = dealResult.data
    if (!deal.funder_id) return

    const { data: authData } = await admin.auth.admin.getUserById(deal.funder_id)
    const funderEmail = authData?.user?.email ?? null
    if (!funderEmail) return

    const milestone      = milestoneResult.data
    const contractor     = contractorResult.data
    const contractorName = contractor?.full_name ?? contractor?.company_name ?? 'The contractor'
    const milestoneTitle = milestone?.title ?? ctx.milestoneId
    const ctaUrl         = `${appUrl}/dashboard/deals/${ctx.dealId}`
    const subject        = `[Vektrum] Milestone ready for review — ${deal.title}`
    const bodySummary    = `${contractorName} marked "${milestoneTitle}" as ready for review on "${deal.title}". Review the milestone and approve when satisfied.`

    const notificationId = await createNotification({
      recipient_user_id: deal.funder_id,
      recipient_email:   funderEmail,
      deal_id:           ctx.dealId,
      entity_type:       'milestone',
      entity_id:         ctx.milestoneId,
      notification_type: 'milestone_ready_for_review',
      channel:           'email',
      subject,
      body_summary:      bodySummary,
    })
    if (!notificationId) return

    const html = renderVektrumEmail({
      badge:    'Milestone Review',
      headline: 'A milestone is ready for your review',
      summary:  bodySummary,
      details: [
        { label: 'Deal',         value: deal.title },
        { label: 'Milestone',    value: milestoneTitle },
        { label: 'Submitted by', value: contractorName },
        ...(milestone?.amount ? [{ label: 'Amount', value: `$${Number(milestone.amount).toFixed(2)}` }] : []),
      ],
      ctaLabel: 'Review in Vektrum',
      ctaUrl,
    })

    await sendEmailNotification(notificationId, funderEmail, subject, html)

    await logAudit({
      entity_type:   'notification',
      entity_id:     notificationId,
      action:        'notification_created',
      actor_id:      ctx.contractorId,
      actor_role:    'contractor',
      system_source: 'lib/engine/notify',
      metadata: { notification_type: 'milestone_ready_for_review', deal_id: ctx.dealId, milestone_id: ctx.milestoneId },
    })
  } catch (err) {
    console.error('[notify] notifyMilestoneReadyForReview unexpected error:', err)
  }
}

// ─── 10. notifyReleaseAuthorized ──────────────────────────────────────────────
/**
 * Notifies the contractor when a funder authorizes a milestone payment release.
 * Fire-and-forget. Wire after funds_released audit in release route.
 */
export async function notifyReleaseAuthorized(ctx: {
  releaseId:   string
  milestoneId: string
  dealId:      string
  funderId:    string
  amount:      number
}): Promise<void> {
  try {
    const admin  = createSupabaseAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

    const [dealResult, milestoneResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('deals').select('id, title, contractor_id').eq('id', ctx.dealId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('milestones').select('id, title').eq('id', ctx.milestoneId).single(),
    ])

    if (dealResult.error || !dealResult.data) return
    const deal = dealResult.data

    const { data: authData } = await admin.auth.admin.getUserById(deal.contractor_id)
    const contractorEmail = authData?.user?.email ?? null
    if (!contractorEmail) return

    const milestone       = milestoneResult.data
    const milestoneTitle  = milestone?.title ?? ctx.milestoneId
    const amountFormatted = `$${ctx.amount.toFixed(2)}`
    const ctaUrl          = `${appUrl}/dashboard/deals/${ctx.dealId}`
    const subject         = `[Vektrum] Release authorized — ${deal.title}`
    const bodySummary     = `The funder authorized a payment of ${amountFormatted} for milestone "${milestoneTitle}" on "${deal.title}". Funds will be transferred to your connected account.`

    const notificationId = await createNotification({
      recipient_user_id: deal.contractor_id,
      recipient_email:   contractorEmail,
      deal_id:           ctx.dealId,
      entity_type:       'release',
      entity_id:         ctx.releaseId,
      notification_type: 'release_authorized',
      channel:           'email',
      subject,
      body_summary:      bodySummary,
    })
    if (!notificationId) return

    const html = renderVektrumEmail({
      badge:    'Release Authorized',
      headline: 'A payment has been authorized',
      summary:  bodySummary,
      details: [
        { label: 'Deal',      value: deal.title },
        { label: 'Milestone', value: milestoneTitle },
        { label: 'Amount',    value: amountFormatted },
      ],
      ctaLabel: 'View release status',
      ctaUrl,
    })

    await sendEmailNotification(notificationId, contractorEmail, subject, html)

    await logAudit({
      entity_type:   'notification',
      entity_id:     notificationId,
      action:        'notification_created',
      actor_id:      ctx.funderId,
      actor_role:    'funder',
      system_source: 'lib/engine/notify',
      metadata: { notification_type: 'release_authorized', deal_id: ctx.dealId, release_id: ctx.releaseId },
    })
  } catch (err) {
    console.error('[notify] notifyReleaseAuthorized unexpected error:', err)
  }
}

// ─── 11. notifyReleaseBlocked ─────────────────────────────────────────────────
/**
 * Notifies the funder when the release gate blocks a payment attempt.
 * Fire-and-forget. Wire after release_gate_blocked audit in release route.
 * Includes the specific gate conditions that failed for actionable resolution.
 */
export async function notifyReleaseBlocked(ctx: {
  milestoneId:    string
  dealId:         string
  funderId:       string
  blockedReasons: string[]
}): Promise<void> {
  try {
    const admin  = createSupabaseAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

    const [dealResult, milestoneResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('deals').select('id, title').eq('id', ctx.dealId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('milestones').select('id, title').eq('id', ctx.milestoneId).single(),
    ])

    if (dealResult.error || !dealResult.data) return
    const { data: authData } = await admin.auth.admin.getUserById(ctx.funderId)
    const funderEmail = authData?.user?.email ?? null
    if (!funderEmail) return

    const deal           = dealResult.data
    const milestone      = milestoneResult.data
    const milestoneTitle = milestone?.title ?? ctx.milestoneId
    const ctaUrl         = `${appUrl}/dashboard/deals/${ctx.dealId}`
    const subject        = `[Vektrum] Release blocked — ${deal.title}`
    const bodySummary    = `The release gate blocked a payment attempt for "${milestoneTitle}" on "${deal.title}". Resolve the outstanding conditions to proceed.`

    const notificationId = await createNotification({
      recipient_user_id: ctx.funderId,
      recipient_email:   funderEmail,
      deal_id:           ctx.dealId,
      entity_type:       'milestone',
      entity_id:         ctx.milestoneId,
      notification_type: 'release_blocked',
      channel:           'email',
      subject,
      body_summary:      `${bodySummary} Failed conditions: ${ctx.blockedReasons.slice(0, 3).join('; ')}`,
    })
    if (!notificationId) return

    const conditionDetails = ctx.blockedReasons.slice(0, 5).map((reason, i) => ({
      label: `Condition ${i + 1}`,
      value: reason.slice(0, 150),
    }))

    const html = renderVektrumEmail({
      badge:    'Release Blocked',
      headline: 'A release was blocked by the release gate',
      summary:  bodySummary,
      details: [
        { label: 'Deal',      value: deal.title },
        { label: 'Milestone', value: milestoneTitle },
        ...conditionDetails,
      ],
      ctaLabel: 'Review in Vektrum',
      ctaUrl,
    })

    await sendEmailNotification(notificationId, funderEmail, subject, html)

    await logAudit({
      entity_type:   'notification',
      entity_id:     notificationId,
      action:        'notification_created',
      actor_id:      ctx.funderId,
      actor_role:    'funder',
      system_source: 'lib/engine/notify',
      metadata: { notification_type: 'release_blocked', deal_id: ctx.dealId, milestone_id: ctx.milestoneId },
    })
  } catch (err) {
    console.error('[notify] notifyReleaseBlocked unexpected error:', err)
  }
}

// ─── 12. notifyExternalPaymentConfirmationRequired ────────────────────────────
/**
 * Notifies admins when an external-manual release is authorized and awaiting
 * external execution confirmation.
 * Fire-and-forget. Wire after the success path in authorize-external route.
 */
export async function notifyExternalPaymentConfirmationRequired(ctx: {
  releaseId:   string
  milestoneId: string
  dealId:      string
  funderId:    string
  amount:      number
}): Promise<void> {
  try {
    const admin       = createSupabaseAdminClient()
    const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'
    const adminEmails = getAdminEmailsList()
    if (adminEmails.length === 0) return

    const [dealResult, milestoneResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('deals').select('id, title').eq('id', ctx.dealId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('milestones').select('id, title').eq('id', ctx.milestoneId).single(),
    ])

    if (dealResult.error || !dealResult.data) return
    const deal            = dealResult.data
    const milestone       = milestoneResult.data
    const milestoneTitle  = milestone?.title ?? ctx.milestoneId
    const amountFormatted = `$${ctx.amount.toFixed(2)}`
    const ctaUrl          = `${appUrl}/dashboard/admin/ops`
    const subject         = `[Vektrum] External payment confirmation required — ${deal.title}`
    const bodySummary     = `An external payment of ${amountFormatted} for "${milestoneTitle}" on "${deal.title}" has been authorized and is awaiting external execution confirmation.`

    for (const adminEmail of adminEmails) {
      const notificationId = await createNotification({
        recipient_email:   adminEmail,
        deal_id:           ctx.dealId,
        entity_type:       'release',
        entity_id:         ctx.releaseId,
        notification_type: 'external_payment_confirmation_required',
        channel:           'email',
        subject,
        body_summary:      bodySummary,
      })
      if (!notificationId) continue

      const html = renderVektrumEmail({
        badge:    'External Rail',
        headline: 'External payment confirmation required',
        summary:  bodySummary,
        details: [
          { label: 'Deal',       value: deal.title },
          { label: 'Milestone',  value: milestoneTitle },
          { label: 'Amount',     value: amountFormatted },
          { label: 'Release ID', value: ctx.releaseId.slice(0, 8) + '…' },
        ],
        ctaLabel: 'View release status',
        ctaUrl,
      })

      await sendEmailNotification(notificationId, adminEmail, subject, html)
    }

    await logAudit({
      entity_type:   'notification',
      entity_id:     ctx.releaseId,
      action:        'notification_created',
      actor_id:      ctx.funderId,
      actor_role:    'funder',
      system_source: 'lib/engine/notify',
      metadata: { notification_type: 'external_payment_confirmation_required', deal_id: ctx.dealId, release_id: ctx.releaseId },
    })
  } catch (err) {
    console.error('[notify] notifyExternalPaymentConfirmationRequired unexpected error:', err)
  }
}

// ─── 13. notifyRetainageReleased ──────────────────────────────────────────────
/**
 * Notifies the contractor when a funder releases withheld retainage.
 * Fire-and-forget. Wire after logAudit in retainage/release route.
 */
export async function notifyRetainageReleased(ctx: {
  retainageReleaseId: string
  dealId:             string
  funderId:           string
  amount:             number
}): Promise<void> {
  try {
    const admin  = createSupabaseAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dealResult = await (admin as any).from('deals').select('id, title, contractor_id').eq('id', ctx.dealId).single()
    if (dealResult.error || !dealResult.data) return
    const deal = dealResult.data

    const { data: authData } = await admin.auth.admin.getUserById(deal.contractor_id)
    const contractorEmail = authData?.user?.email ?? null
    if (!contractorEmail) return

    const amountFormatted = `$${ctx.amount.toFixed(2)}`
    const ctaUrl          = `${appUrl}/dashboard/deals/${ctx.dealId}`
    const subject         = `[Vektrum] Retainage released — ${deal.title}`
    const bodySummary     = `The funder released ${amountFormatted} in withheld retainage on "${deal.title}". Funds will be transferred to your connected account.`

    const notificationId = await createNotification({
      recipient_user_id: deal.contractor_id,
      recipient_email:   contractorEmail,
      deal_id:           ctx.dealId,
      entity_type:       'deal',
      entity_id:         ctx.retainageReleaseId,
      notification_type: 'retainage_released',
      channel:           'email',
      subject,
      body_summary:      bodySummary,
    })
    if (!notificationId) return

    const html = renderVektrumEmail({
      badge:    'Retainage',
      headline: 'Retainage has been released',
      summary:  bodySummary,
      details: [
        { label: 'Deal',   value: deal.title },
        { label: 'Amount', value: amountFormatted },
      ],
      ctaLabel: 'View deal',
      ctaUrl,
    })

    await sendEmailNotification(notificationId, contractorEmail, subject, html)

    await logAudit({
      entity_type:   'notification',
      entity_id:     notificationId,
      action:        'notification_created',
      actor_id:      ctx.funderId,
      actor_role:    'funder',
      system_source: 'lib/engine/notify',
      metadata: { notification_type: 'retainage_released', deal_id: ctx.dealId },
    })
  } catch (err) {
    console.error('[notify] notifyRetainageReleased unexpected error:', err)
  }
}

// ─── 14. notifyDisputeOpened ──────────────────────────────────────────────────
/**
 * Notifies the other party (contractor or funder) when a dispute is opened.
 * The party who opened the dispute is excluded from the notification.
 * Fire-and-forget. Wire after logAudit in disputes POST route.
 */
export async function notifyDisputeOpened(ctx: {
  disputeId:      string
  dealId:         string
  milestoneId:    string
  openedByUserId: string
  openedByRole:   string
}): Promise<void> {
  try {
    const admin  = createSupabaseAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

    const [dealResult, milestoneResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('deals').select('id, title, contractor_id, funder_id').eq('id', ctx.dealId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('milestones').select('id, title').eq('id', ctx.milestoneId).single(),
    ])

    if (dealResult.error || !dealResult.data) return
    const deal           = dealResult.data
    const milestone      = milestoneResult.data
    const milestoneTitle = milestone?.title ?? ctx.milestoneId
    const ctaUrl         = `${appUrl}/dashboard/deals/${ctx.dealId}`
    const subject        = `[Vektrum] Dispute opened — ${deal.title}`
    const bodySummary    = `A dispute has been opened on milestone "${milestoneTitle}" of "${deal.title}". Both parties must engage to resolve it before payments can proceed.`

    const candidateIds: string[] = [
      deal.contractor_id,
      ...(deal.funder_id ? [deal.funder_id] : []),
    ].filter(id => id !== ctx.openedByUserId)

    for (const userId of candidateIds) {
      const { data: authData } = await admin.auth.admin.getUserById(userId)
      const email = authData?.user?.email ?? null
      if (!email) continue

      const notificationId = await createNotification({
        recipient_user_id: userId,
        recipient_email:   email,
        deal_id:           ctx.dealId,
        entity_type:       'dispute',
        entity_id:         ctx.disputeId,
        notification_type: 'dispute_opened',
        channel:           'email',
        subject,
        body_summary:      bodySummary,
      })
      if (!notificationId) continue

      const html = renderVektrumEmail({
        badge:    'Dispute',
        headline: 'A dispute has been opened',
        summary:  bodySummary,
        details: [
          { label: 'Deal',      value: deal.title },
          { label: 'Milestone', value: milestoneTitle },
        ],
        ctaLabel: 'View deal',
        ctaUrl,
      })

      await sendEmailNotification(notificationId, email, subject, html)
    }

    await logAudit({
      entity_type:   'notification',
      entity_id:     ctx.disputeId,
      action:        'notification_created',
      actor_id:      ctx.openedByUserId,
      actor_role:    ctx.openedByRole,
      system_source: 'lib/engine/notify',
      metadata: { notification_type: 'dispute_opened', deal_id: ctx.dealId, dispute_id: ctx.disputeId },
    })
  } catch (err) {
    console.error('[notify] notifyDisputeOpened unexpected error:', err)
  }
}

// ─── 15. notifyDisputeResolved ────────────────────────────────────────────────
/**
 * Notifies both parties when a dispute is resolved.
 * The resolver is excluded from the notification.
 * Fire-and-forget. Wire after logAudit in disputes/[id]/resolve route.
 */
export async function notifyDisputeResolved(ctx: {
  disputeId:        string
  dealId:           string
  milestoneId:      string
  resolvedByUserId: string
  resolvedByRole:   string
  resolution?:      string
}): Promise<void> {
  try {
    const admin  = createSupabaseAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

    const [dealResult, milestoneResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('deals').select('id, title, contractor_id, funder_id').eq('id', ctx.dealId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('milestones').select('id, title').eq('id', ctx.milestoneId).single(),
    ])

    if (dealResult.error || !dealResult.data) return
    const deal           = dealResult.data
    const milestone      = milestoneResult.data
    const milestoneTitle = milestone?.title ?? ctx.milestoneId
    const ctaUrl         = `${appUrl}/dashboard/deals/${ctx.dealId}`
    const subject        = `[Vektrum] Dispute resolved — ${deal.title}`
    const bodySummary    = `The dispute on milestone "${milestoneTitle}" of "${deal.title}" has been resolved.${ctx.resolution ? ` Resolution: ${ctx.resolution}` : ''} Payments can now proceed.`

    const candidateIds: string[] = [
      deal.contractor_id,
      ...(deal.funder_id ? [deal.funder_id] : []),
    ].filter(id => id !== ctx.resolvedByUserId)

    for (const userId of candidateIds) {
      const { data: authData } = await admin.auth.admin.getUserById(userId)
      const email = authData?.user?.email ?? null
      if (!email) continue

      const notificationId = await createNotification({
        recipient_user_id: userId,
        recipient_email:   email,
        deal_id:           ctx.dealId,
        entity_type:       'dispute',
        entity_id:         ctx.disputeId,
        notification_type: 'dispute_resolved',
        channel:           'email',
        subject,
        body_summary:      bodySummary,
      })
      if (!notificationId) continue

      const html = renderVektrumEmail({
        badge:    'Dispute',
        headline: 'The dispute has been resolved',
        summary:  bodySummary,
        details: [
          { label: 'Deal',      value: deal.title },
          { label: 'Milestone', value: milestoneTitle },
          ...(ctx.resolution ? [{ label: 'Resolution', value: ctx.resolution.slice(0, 200) }] : []),
        ],
        ctaLabel: 'View deal',
        ctaUrl,
      })

      await sendEmailNotification(notificationId, email, subject, html)
    }

    await logAudit({
      entity_type:   'notification',
      entity_id:     ctx.disputeId,
      action:        'notification_created',
      actor_id:      ctx.resolvedByUserId,
      actor_role:    ctx.resolvedByRole,
      system_source: 'lib/engine/notify',
      metadata: { notification_type: 'dispute_resolved', deal_id: ctx.dealId, dispute_id: ctx.disputeId },
    })
  } catch (err) {
    console.error('[notify] notifyDisputeResolved unexpected error:', err)
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
