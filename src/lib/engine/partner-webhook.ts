import { createHmac } from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/engine/audit'

// ─── Partner Webhook Delivery ─────────────────────────────────────────────────
//
// Delivers signed authorization signals to institutional execution-rail
// partners when the 10-condition release gate passes on an external-rail deal.
//
// Signature scheme (identical to Stripe's):
//   1. Build the string: "<unix_timestamp>.<json_payload>"
//   2. HMAC-SHA256 the string using partner.webhook_signing_secret
//   3. Hex-encode the digest
//   4. Send as: X-Vektrum-Signature: t=<timestamp>,sha256=<hex>
//
// Partners verify by re-computing the HMAC with their signing secret and
// comparing to the header value. The timestamp prevents replay attacks when
// partners enforce a tolerance window (recommended: 300 s).
//
// Retry strategy: 3 attempts with 1s → 2s → 4s exponential backoff.
// All delivery outcomes are logged to the audit trail (non-fatal).
//
// This function NEVER throws. Webhook delivery failures do not block the
// release — the governance decision has already been made and recorded.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PartnerWebhookPayload {
  event:             'release.authorized'
  api_version:       string
  release_id:        string
  deal_id:           string
  deal_title:        string
  milestone_id:      string
  milestone_title:   string
  /** Gross milestone amount (before fee and retainage deductions) */
  amount:            number
  fee_amount:        number
  retainage_amount:  number
  /** Amount the contractor will receive net of retainage */
  net_to_contractor: number
  contractor_id:     string
  funder_id:         string
  authorized_at:     string   // ISO-8601
  authorized_by:     string   // funder user id
  /** Stable idempotency key — partners should deduplicate on this */
  idempotency_key:   string
}

// ─── Retry helper (mirrors alerts.ts) ────────────────────────────────────────

async function postWithRetry(
  url:          string,
  body:         string,
  headers:      Record<string, string>,
  maxAttempts = 3,
  baseDelayMs = 1_000,
): Promise<{ ok: boolean; status: number; body: string }> {
  let lastStatus = 0
  let lastBody   = ''

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body,
      })

      lastStatus = res.status
      lastBody   = await res.text().catch(() => '')

      if (res.ok) return { ok: true, status: res.status, body: lastBody }

      console.warn(
        `[partner-webhook] Delivery returned ${res.status} on attempt ${attempt}/${maxAttempts}`,
      )
    } catch (err) {
      console.warn(
        `[partner-webhook] Fetch error on attempt ${attempt}/${maxAttempts}:`,
        err instanceof Error ? err.message : String(err),
      )
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * Math.pow(2, attempt - 1)),
      )
    }
  }

  return { ok: false, status: lastStatus, body: lastBody }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Delivers a signed release.authorized webhook to the partner associated with
 * the given deal, if one exists and has a webhook URL configured.
 *
 * Silently no-ops if:
 *   - deal has no partner_id
 *   - partner has no webhook_url
 *   - partner is inactive
 *
 * Always logs the outcome to audit_log — never throws.
 *
 * @param dealId    The deal that was released (used to look up the partner)
 * @param payload   The authorization event payload
 * @param actorId   The funder's user ID (for audit attribution)
 */
export async function deliverPartnerWebhook(
  dealId:  string,
  payload: PartnerWebhookPayload,
  actorId: string,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()

    // ── Look up partner via deal.partner_id ──────────────────────────────────
    const { data: deal, error: dealError } = await admin
      .from('deals')
      .select('partner_id')
      .eq('id', dealId)
      .single()

    if (dealError || !deal?.partner_id) {
      // No partner associated with this deal — normal for Stripe-rail or
      // external-rail deals without a partner assignment.
      return
    }

    const { data: partner, error: partnerError } = await admin
      .from('partners')
      .select('id, name, webhook_url, webhook_signing_secret, is_active')
      .eq('id', deal.partner_id)
      .single()

    if (partnerError || !partner) {
      console.error('[partner-webhook] Partner lookup failed:', partnerError?.message)
      return
    }

    if (!partner.is_active) {
      // Partner deactivated — log and skip silently.
      await logAudit({
        entity_type: 'release',
        entity_id:   payload.release_id,
        action:      'partner_webhook_skipped_inactive',
        actor_id:    actorId,
        metadata: {
          partner_id:   partner.id,
          partner_name: partner.name,
          deal_id:      dealId,
          reason:       'Partner is inactive — webhook not delivered.',
        },
      })
      return
    }

    if (!partner.webhook_url) {
      // Partner has no webhook URL — they poll or use the ops dashboard.
      await logAudit({
        entity_type: 'release',
        entity_id:   payload.release_id,
        action:      'partner_webhook_skipped_no_url',
        actor_id:    actorId,
        metadata: {
          partner_id:   partner.id,
          partner_name: partner.name,
          deal_id:      dealId,
          reason:       'Partner has no webhook_url configured.',
        },
      })
      return
    }

    // ── Build and sign the payload ───────────────────────────────────────────
    const bodyJson    = JSON.stringify(payload)
    const timestampS  = Math.floor(Date.now() / 1000)
    const signedStr   = `${timestampS}.${bodyJson}`

    let signatureHeader = ''
    if (partner.webhook_signing_secret) {
      const hmac = createHmac('sha256', partner.webhook_signing_secret)
        .update(signedStr)
        .digest('hex')
      signatureHeader = `t=${timestampS},sha256=${hmac}`
    } else {
      // No signing secret configured — deliver unsigned with a warning.
      signatureHeader = `t=${timestampS},sha256=unsigned`
      console.warn(
        `[partner-webhook] Partner ${partner.id} has no webhook_signing_secret — delivering unsigned.`,
      )
    }

    const headers: Record<string, string> = {
      'X-Vektrum-Signature': signatureHeader,
      'X-Vektrum-Event':     payload.event,
      'X-Vektrum-DeliveryId': `${payload.release_id}-${timestampS}`,
    }

    // ── Deliver with retry ───────────────────────────────────────────────────
    const result = await postWithRetry(partner.webhook_url, bodyJson, headers)

    // ── Log outcome ──────────────────────────────────────────────────────────
    await logAudit({
      entity_type: 'release',
      entity_id:   payload.release_id,
      action:      result.ok
        ? 'partner_webhook_delivered'
        : 'partner_webhook_failed',
      actor_id:    actorId,
      metadata: {
        partner_id:         partner.id,
        partner_name:       partner.name,
        webhook_url:        partner.webhook_url,
        http_status:        result.status,
        ok:                 result.ok,
        response_body_hint: result.body.slice(0, 200),
        event:              payload.event,
        idempotency_key:    payload.idempotency_key,
        signed:             !!partner.webhook_signing_secret,
        deal_id:            dealId,
      },
    })

    if (!result.ok) {
      console.error(
        `[partner-webhook] Delivery failed for partner ${partner.id} after all retries. ` +
        `Status: ${result.status}. Release: ${payload.release_id}`,
      )
    }
  } catch (err) {
    // Top-level guard — webhook delivery must never propagate errors.
    console.error(
      '[partner-webhook] Unexpected error:',
      err instanceof Error ? err.message : String(err),
    )
  }
}
