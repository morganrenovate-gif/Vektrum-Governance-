import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole, requireAdminAudit } from '@/lib/auth/middleware'
import { calculateFee, calculateRetainage } from '@/lib/engine/billing'
import {
  resendPartnerWebhook,
  PartnerWebhookPayload,
  PARTNER_WEBHOOK_API_VERSION,
  ResendResult,
} from '@/lib/engine/partner-webhook'
import { forbiddenError, internalError, notFoundError, unauthorizedError } from '@/lib/errors'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'

// ─── POST /api/admin/partner-webhooks/[deliveryId]/resend ─────────────────────
//
// Admin-only endpoint. Resends a partner webhook for an existing delivery record.
// Intended for use when a webhook has failed or exhausted retries and the admin
// needs to notify the partner without manual coordination.
//
// Auth: admin role required. MFA is NOT required for this action (notification
// retrigger, not a financial state change). Requires admin_justification in body.
//
// Security:
//   - Only admins may call this endpoint.
//   - The target URL comes from partner.webhook_url in the database — not from
//     any caller-supplied input. Arbitrary URL injection is not possible.
//   - The payload is reconstructed from canonical release/deal/milestone state —
//     not from any stale or caller-supplied body.
//   - The webhook signing secret is loaded and used inside resendPartnerWebhook;
//     it is never returned in any HTTP response.
//   - A new partner_webhook_deliveries row is created for every resend attempt,
//     linked to the original delivery via resent_from_delivery_id.
//   - The admin action is dual-written to audit_log + admin_audit_log.
//
// Request body:
//   { admin_justification: string }   (required, ≥ 20 chars)
//
// Response:
//   200  { success, resend_status, ok, http_status, attempt_count,
//          new_delivery_row_id, original_delivery_id, partner, release_id, note }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deliveryId: string }> },
) {
  const { deliveryId } = await params

  // ── Rate limit ─────────────────────────────────────────────────────────────
  {
    const rl = await checkRateLimit(
      `admin:webhook-resend:${deliveryId}`,
      POLICIES.admin_write,
    )
    if (!rl.allowed) {
      logRateLimitViolation(`admin:webhook-resend:${deliveryId}`, rl, {
        actorId:    null,
        policyName: 'admin_write',
        entityType: 'partner_webhook_delivery',
        entityId:   deliveryId,
      })
      return rateLimitResponse(rl, POLICIES.admin_write.description)
    }
  }

  // ── Authentication ─────────────────────────────────────────────────────────
  // getAuthUser reads the session from cookies internally.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { user, profile } = await getAuthUser(request) as any

  if (!user || !profile) {
    return unauthorizedError('Authentication required.')
  }

  // ── Authorization — admin role ─────────────────────────────────────────────
  try {
    requireRole(profile, 'admin')
  } catch (e) {
    return forbiddenError('Admin role required.')
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any> = {}
  try {
    body = await request.json()
  } catch {
    // Body may be empty; requireAdminAudit will validate justification length.
  }
  const adminJustification = typeof body.admin_justification === 'string'
    ? body.admin_justification.trim()
    : ''

  const admin = createSupabaseAdminClient()

  // ── Load original delivery record ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: delivery, error: deliveryError } = await (admin as any)
    .from('partner_webhook_deliveries')
    .select('id, partner_id, release_id, idempotency_key, delivery_status, webhook_event_type')
    .eq('id', deliveryId)
    .single()

  if (deliveryError || !delivery) {
    return notFoundError(`Delivery record ${deliveryId} was not found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = delivery as any

  if (!d.release_id) {
    return NextResponse.json(
      {
        error: 'This delivery record is not linked to a release. ' +
               'Payload cannot be reconstructed — resend is not possible.',
      },
      { status: 422 },
    )
  }

  // ── Load partner (verification only — signing secret loaded by resendPartnerWebhook) ──
  // We deliberately do NOT select webhook_signing_secret here. That field is
  // loaded inside resendPartnerWebhook and never returned to this route's scope.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: partner, error: partnerError } = await (admin as any)
    .from('partners')
    .select('id, name, webhook_url, is_active')
    .eq('id', d.partner_id)
    .single()

  if (partnerError || !partner) {
    return notFoundError(`Partner ${d.partner_id} for delivery ${deliveryId} was not found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = partner as any

  if (!p.webhook_url) {
    return NextResponse.json(
      {
        error: 'This partner has no webhook URL configured. Resend is not possible.',
        partner_id: p.id,
      },
      { status: 422 },
    )
  }

  // ── Load release (canonical state) ─────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: release, error: releaseError } = await (admin as any)
    .from('releases')
    .select('id, milestone_id, deal_id, amount, execution_rail')
    .eq('id', d.release_id)
    .single()

  if (releaseError || !release) {
    return notFoundError(`Release ${d.release_id} was not found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = release as any

  // ── Load deal ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deal, error: dealError } = await (admin as any)
    .from('deals')
    .select('id, title, contractor_id, funder_id, billing_rate_bps, retainage_percentage, partner_id')
    .eq('id', r.deal_id)
    .single()

  if (dealError || !deal) {
    return notFoundError(`Deal ${r.deal_id} was not found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dl = deal as any

  // Verify the deal still belongs to this partner — prevent cross-partner resend.
  if (dl.partner_id !== d.partner_id) {
    return NextResponse.json(
      {
        error: 'The deal\'s partner_id no longer matches the delivery\'s partner_id. ' +
               'Resend rejected to prevent cross-partner signal delivery.',
      },
      { status: 409 },
    )
  }

  // ── Load milestone ─────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: milestone, error: milestoneError } = await (admin as any)
    .from('milestones')
    .select('id, title, amount')
    .eq('id', r.milestone_id)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(`Milestone ${r.milestone_id} was not found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = milestone as any

  // ── Reconstruct canonical payload from current release state ───────────────
  // The payload is derived from the database — never from any caller input.
  // The original idempotency_key is preserved so partners can deduplicate.
  const fee       = calculateFee(r.amount, dl.billing_rate_bps)
  const retainage = calculateRetainage(r.amount, dl.retainage_percentage ?? 0)

  const payload: PartnerWebhookPayload = {
    event:             'release.authorized',
    api_version:       PARTNER_WEBHOOK_API_VERSION,
    release_id:        r.id,
    deal_id:           dl.id,
    deal_title:        dl.title,
    milestone_id:      m.id,
    milestone_title:   m.title,
    amount:            r.amount,
    fee_amount:        fee.feeAmount,
    retainage_amount:  retainage.retainageAmount,
    net_to_contractor: retainage.netToContractor,
    contractor_id:     dl.contractor_id,
    funder_id:         dl.funder_id,
    authorized_at:     new Date().toISOString(),  // canonical "now" for resend timestamp
    authorized_by:     dl.funder_id,              // funder is the authorising party
    idempotency_key:   d.idempotency_key,         // preserve original for partner dedup
  }

  // ── Resend via shared webhook delivery logic ────────────────────────────────
  // resendPartnerWebhook loads the partner's signing_secret internally.
  // It creates a new delivery row linked to deliveryId via resent_from_delivery_id.
  // It never returns the signing secret to this scope.
  let resendResult: ResendResult
  try {
    resendResult = await resendPartnerWebhook(
      d.partner_id,
      payload,
      user.id,
      deliveryId,
    )
  } catch (err) {
    return internalError(
      'Webhook resend failed unexpectedly.',
      err instanceof Error ? err.message : String(err),
    )
  }

  // ── Audit log (dual-write: audit_log + admin_audit_log) ────────────────────
  // requireAdminAudit validates justification length (≥ 20 chars) and throws a
  // NextResponse on failure — catch and return it directly.
  try {
    await requireAdminAudit(profile, user, adminJustification, {
      action:       'partner_webhook_resend',
      entityType:   'partner_webhook_delivery',
      entityId:     deliveryId,
      systemSource: 'api/admin/partner-webhooks/[deliveryId]/resend',
      metadata: {
        original_delivery_id:     deliveryId,
        new_delivery_row_id:      resendResult.deliveryRowId,
        partner_id:               p.id,
        partner_name:             p.name,
        release_id:               d.release_id,
        deal_id:                  dl.id,
        milestone_id:             m.id,
        original_delivery_status: d.delivery_status,
        resend_status:            resendResult.finalStatus,
        http_status:              resendResult.status,
        attempt_count:            resendResult.attemptCount,
        ok:                       resendResult.ok,
      },
    })
  } catch (e) {
    return e as NextResponse
  }

  return NextResponse.json({
    success:              true,
    resend_status:        resendResult.finalStatus,
    ok:                   resendResult.ok,
    http_status:          resendResult.status,
    attempt_count:        resendResult.attemptCount,
    new_delivery_row_id:  resendResult.deliveryRowId,
    original_delivery_id: deliveryId,
    partner: {
      id:   p.id,
      name: p.name,
    },
    release_id:           d.release_id,
    note: resendResult.ok
      ? 'Webhook resent successfully. New delivery row created and linked to the original.'
      : 'Webhook resend exhausted all retries. New delivery row created with exhausted status.',
  })
}
