import { createHash, createHmac } from 'crypto'
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
//
// Delivery logging: every delivery attempt is recorded in partner_webhook_deliveries.
//   - A 'pending' row is inserted BEFORE the HTTP call.
//   - The row is updated to 'success' or 'exhausted' after all retries complete.
//   - Secrets and raw payloads are never stored — only SHA-256 hashes.
//   - All outcomes are also logged to the audit trail (non-fatal).
//
// This function NEVER throws. Webhook delivery failures do not block the
// release — the governance decision has already been made and recorded.

// ─── Constants ────────────────────────────────────────────────────────────────

/** Current partner webhook API version. Used in every outbound payload. */
export const PARTNER_WEBHOOK_API_VERSION = '2026-05-01'

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

export interface ResendResult {
  ok:            boolean
  deliveryRowId: string
  status:        number
  attemptCount:  number
  finalStatus:   'success' | 'exhausted'
}

// ─── Internal partner type (includes signing secret) ─────────────────────────
//
// This type is only used within this module. The signing secret is never
// returned to callers — it is loaded from the DB and used for HMAC only.

interface PartnerForDelivery {
  id:                     string
  name:                   string
  webhook_url:            string
  webhook_signing_secret: string | null
  is_active:              boolean
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function postWithRetry(
  url:          string,
  body:         string,
  headers:      Record<string, string>,
  maxAttempts = 3,
  baseDelayMs = 1_000,
): Promise<{ ok: boolean; status: number; body: string; attemptCount: number }> {
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

      if (res.ok) return { ok: true, status: res.status, body: lastBody, attemptCount: attempt }

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

  return { ok: false, status: lastStatus, body: lastBody, attemptCount: maxAttempts }
}

// ─── Core delivery logic (private) ───────────────────────────────────────────
//
// Signs the payload, inserts a 'pending' delivery row, calls postWithRetry,
// updates the row with the final outcome, and logs to the audit trail.
//
// Used by both deliverPartnerWebhook (normal path) and resendPartnerWebhook
// (admin resend path). Callers are responsible for partner validation and
// access checks before calling this function.
//
// Security: the partner.webhook_signing_secret is used only for HMAC
// computation and is never stored in the delivery row or audit metadata.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function doDeliver(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin:   any,
  partner: PartnerForDelivery,
  payload: PartnerWebhookPayload,
  actorId: string,
  opts:    { resentFromDeliveryId?: string } = {},
): Promise<ResendResult> {
  const bodyJson   = JSON.stringify(payload)
  const timestampS = Math.floor(Date.now() / 1000)
  const signedStr  = `${timestampS}.${bodyJson}`

  let signatureHeader: string
  if (partner.webhook_signing_secret) {
    const hmac = createHmac('sha256', partner.webhook_signing_secret)
      .update(signedStr)
      .digest('hex')
    signatureHeader = `t=${timestampS},sha256=${hmac}`
  } else {
    signatureHeader = `t=${timestampS},sha256=unsigned`
    console.warn(
      `[partner-webhook] Partner ${partner.id} has no webhook_signing_secret — delivering unsigned.`,
    )
  }

  const deliveryId = `${payload.release_id}-${timestampS}`
  const headers: Record<string, string> = {
    'X-Vektrum-Signature':  signatureHeader,
    'X-Vektrum-Event':      payload.event,
    'X-Vektrum-DeliveryId': deliveryId,
  }

  // ── Request body hash (SHA-256 of exact bytes) ───────────────────────────
  // Stored in the delivery row for integrity verification.
  // The raw body is never stored.
  const requestBodyHash = createHash('sha256').update(bodyJson).digest('hex')

  // ── Sanitized header metadata — X-Vektrum-Signature excluded ────────────
  // The signature header contains the HMAC; it must never be persisted.
  const requestHeadersMeta = {
    'X-Vektrum-Event':      payload.event,
    'X-Vektrum-DeliveryId': deliveryId,
    signed:                 !!partner.webhook_signing_secret,
  }

  // ── Pre-generate delivery row ID ─────────────────────────────────────────
  const deliveryRowId = crypto.randomUUID()

  // ── Insert 'pending' delivery row BEFORE the HTTP call ───────────────────
  const { error: insertError } = await admin
    .from('partner_webhook_deliveries')
    .insert({
      id:                       deliveryRowId,
      partner_id:               partner.id,
      release_id:               payload.release_id,
      webhook_event_type:       payload.event,
      target_url:               partner.webhook_url,
      request_body_hash:        requestBodyHash,
      request_headers_meta:     requestHeadersMeta,
      idempotency_key:          payload.idempotency_key,
      signed:                   !!partner.webhook_signing_secret,
      delivery_status:          'pending',
      attempt_count:            0,
      sent_at:                  new Date().toISOString(),
      resent_from_delivery_id:  opts.resentFromDeliveryId ?? null,
    })

  if (insertError) {
    console.error(
      '[partner-webhook] Failed to insert delivery row (non-fatal):',
      insertError.message,
    )
  }

  // ── Deliver with retry ───────────────────────────────────────────────────
  const result = await postWithRetry(partner.webhook_url, bodyJson, headers)

  // ── Update delivery row with final outcome ───────────────────────────────
  const finalStatus: 'success' | 'exhausted' = result.ok ? 'success' : 'exhausted'

  const { error: updateError } = await admin
    .from('partner_webhook_deliveries')
    .update({
      delivery_status:       finalStatus,
      response_status_code:  result.status || null,
      response_body_snippet: result.body ? result.body.slice(0, 500) : null,
      attempt_count:         result.attemptCount,
      completed_at:          new Date().toISOString(),
      error_message:         result.ok
        ? null
        : `HTTP ${result.status} after ${result.attemptCount} attempt(s). ` +
          `Review partner endpoint at ${partner.webhook_url}.`,
    })
    .eq('id', deliveryRowId)

  if (updateError) {
    console.error(
      '[partner-webhook] Failed to update delivery row (non-fatal):',
      updateError.message,
    )
  }

  // ── Log outcome to audit trail ───────────────────────────────────────────
  await logAudit({
    entity_type: 'release',
    entity_id:   payload.release_id,
    action:      result.ok
      ? (opts.resentFromDeliveryId ? 'partner_webhook_resent_delivered' : 'partner_webhook_delivered')
      : (opts.resentFromDeliveryId ? 'partner_webhook_resent_failed'    : 'partner_webhook_failed'),
    actor_id:    actorId,
    metadata: {
      partner_id:               partner.id,
      partner_name:             partner.name,
      webhook_url:              partner.webhook_url,
      http_status:              result.status,
      ok:                       result.ok,
      response_body_hint:       result.body.slice(0, 200),
      event:                    payload.event,
      idempotency_key:          payload.idempotency_key,
      signed:                   !!partner.webhook_signing_secret,
      delivery_row_id:          deliveryRowId,
      attempt_count:            result.attemptCount,
      delivery_status:          finalStatus,
      resent_from_delivery_id:  opts.resentFromDeliveryId ?? null,
    },
  })

  if (!result.ok) {
    console.error(
      `[partner-webhook] Delivery failed for partner ${partner.id} after all retries. ` +
      `Status: ${result.status}. Release: ${payload.release_id}`,
    )
  }

  return { ok: result.ok, deliveryRowId, status: result.status, attemptCount: result.attemptCount, finalStatus }
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
 * Always logs the outcome to audit_log and partner_webhook_deliveries — never throws.
 *
 * Security: secrets (webhook_signing_secret) and the HMAC signature value are
 * never written to partner_webhook_deliveries. Only a SHA-256 hash of the
 * request body and non-sensitive header metadata are stored.
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await doDeliver(admin, partner as PartnerForDelivery, payload, actorId)
  } catch (err) {
    // Top-level guard — webhook delivery must never propagate errors.
    console.error(
      '[partner-webhook] Unexpected error:',
      err instanceof Error ? err.message : String(err),
    )
  }
}

/**
 * Resends a webhook for an existing delivery record. Used by the admin resend
 * endpoint (POST /api/admin/partner-webhooks/[deliveryId]/resend).
 *
 * Unlike deliverPartnerWebhook, this function:
 *   - Does NOT perform is_active or webhook_url checks (admin override).
 *   - Creates a new delivery row linked to the original via resent_from_delivery_id.
 *   - Returns a ResendResult for the admin route to inspect and audit.
 *   - Throws on partner lookup failure (caller handles the error response).
 *
 * The partner's webhook_signing_secret is loaded internally and never returned
 * to the caller. The target URL comes from partner.webhook_url in the database,
 * not from any caller-supplied input.
 *
 * @param partnerId            The partner to deliver to
 * @param payload              The reconstructed canonical webhook payload
 * @param actorId              The admin user's ID (for audit attribution)
 * @param resentFromDeliveryId The original delivery row ID being retried
 */
export async function resendPartnerWebhook(
  partnerId:            string,
  payload:              PartnerWebhookPayload,
  actorId:              string,
  resentFromDeliveryId: string,
): Promise<ResendResult> {
  const admin = createSupabaseAdminClient()

  // Load partner including signing secret (used for HMAC, never returned)
  const { data: partner, error: partnerError } = await admin
    .from('partners')
    .select('id, name, webhook_url, webhook_signing_secret, is_active')
    .eq('id', partnerId)
    .single()

  if (partnerError || !partner) {
    throw new Error(`Partner ${partnerId} not found or could not be loaded.`)
  }

  if (!partner.webhook_url) {
    throw new Error(`Partner ${partner.id} has no webhook_url configured.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return doDeliver(admin, partner as PartnerForDelivery, payload, actorId, { resentFromDeliveryId })
}
