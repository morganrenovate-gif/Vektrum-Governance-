/**
 * Design Partner Application — admin alert email.
 *
 * Sent immediately after a successful row insert into
 * design_partner_applications. Mirrors the existing notify pattern:
 *
 *   - Uses Resend via RESEND_API_KEY (already a project dependency).
 *   - Sender:      EMAIL_FROM (default 'Vektrum <noreply@vektrum.io>').
 *   - Recipients:  DESIGN_PARTNER_ALERT_EMAIL  (preferred, comma-separated)
 *                  → ADMIN_SIGNUP_ALERT_EMAIL  (fallback)
 *                  → ADMIN_EMAIL              (final fallback)
 *
 * Never throws. Returns true only when Resend reports a successful send so
 * the caller can decide whether to update admin_email_sent_at.
 */

import { Resend } from 'resend'

export interface DesignPartnerApplicationContext {
  id:                  string
  name:                string
  company:             string
  role:                string
  email:               string
  audienceType:        string
  drawExposure:        string
  biggestBottleneck:   string
  utmSource?:          string | null
  utmMedium?:          string | null
  utmCampaign?:        string | null
  utmContent?:         string | null
  utmTerm?:            string | null
  referrer?:           string | null
  userAgent?:          string | null
  submittedAt:         string  // ISO
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[design-partner-alert] RESEND_API_KEY is not set — admin alert disabled')
    return null
  }
  return new Resend(key)
}

function getSender(): string {
  return process.env.EMAIL_FROM ?? 'Vektrum <noreply@vektrum.io>'
}

/**
 * Resolve admin recipient list with documented fallback order.
 * Returns [] when nothing is configured (helper logs a warning).
 */
function getAdminRecipients(): string[] {
  const raw =
    process.env.DESIGN_PARTNER_ALERT_EMAIL
    || process.env.ADMIN_SIGNUP_ALERT_EMAIL
    || process.env.ADMIN_EMAIL
    || ''
  return raw.split(',').map((e) => e.trim()).filter(Boolean)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function row(label: string, value: string | null | undefined): string {
  const safe = value && value.trim() ? escapeHtml(value) : '—'
  return `
    <tr>
      <td style="padding:6px 16px 6px 0;color:#6B7280;font-size:13px;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:6px 0;font-size:13px;color:#111827;word-break:break-word">${safe}</td>
    </tr>
  `
}

/**
 * Send the design-partner admin alert.
 *
 * @returns true on confirmed send, false otherwise (missing config / error).
 *          Never throws.
 */
export async function sendDesignPartnerAlertEmail(
  ctx: DesignPartnerApplicationContext,
): Promise<boolean> {
  const resend = getResend()
  if (!resend) return false

  const recipients = getAdminRecipients()
  if (recipients.length === 0) {
    console.warn(
      '[design-partner-alert] no recipients configured ' +
      '(set DESIGN_PARTNER_ALERT_EMAIL, ADMIN_SIGNUP_ALERT_EMAIL, or ADMIN_EMAIL)',
    )
    return false
  }

  const subject = `New Vektrum design partner application — ${ctx.name} / ${ctx.company}`

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#ffffff">
      <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 4px">
        New design-partner application
      </p>
      <p style="font-size:13px;color:#6B7280;margin:0 0 18px">
        Application id: <code style="font-family:monospace">${escapeHtml(ctx.id)}</code>
      </p>

      <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
        ${row('Name',         ctx.name)}
        ${row('Company',      ctx.company)}
        ${row('Role',         ctx.role)}
        ${row('Email',        ctx.email)}
        ${row('Audience',     ctx.audienceType)}
        ${row('Draw exposure', ctx.drawExposure)}
        ${row('Submitted',    ctx.submittedAt)}
      </table>

      <p style="font-size:12px;font-weight:600;color:#374151;margin:18px 0 4px">Biggest draw-release bottleneck</p>
      <p style="font-size:13px;color:#111827;background:#F9FAFB;padding:10px 12px;border-radius:6px;border:1px solid #E5E7EB;white-space:pre-wrap;word-break:break-word">${escapeHtml(ctx.biggestBottleneck)}</p>

      <p style="font-size:12px;font-weight:600;color:#374151;margin:24px 0 4px">Attribution</p>
      <table style="border-collapse:collapse;width:100%;font-family:monospace;font-size:12px">
        ${row('utm_source',   ctx.utmSource)}
        ${row('utm_medium',   ctx.utmMedium)}
        ${row('utm_campaign', ctx.utmCampaign)}
        ${row('utm_content',  ctx.utmContent)}
        ${row('utm_term',     ctx.utmTerm)}
        ${row('Referrer',     ctx.referrer)}
        ${row('User agent',   ctx.userAgent)}
      </table>

      <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0" />
      <p style="color:#9CA3AF;font-size:12px;margin:0">
        Vektrum · Construction draw governance · Reply to this email to reach the applicant.
      </p>
    </div>
  `

  try {
    const result = await resend.emails.send({
      from:    getSender(),
      to:      recipients,
      replyTo: ctx.email,
      subject,
      html,
    })

    if (result.error) {
      console.error('[design-partner-alert] Resend reported error:', result.error)
      return false
    }
    return true
  } catch (err) {
    console.error(
      '[design-partner-alert] unexpected send error:',
      err instanceof Error ? err.message : err,
    )
    return false
  }
}
