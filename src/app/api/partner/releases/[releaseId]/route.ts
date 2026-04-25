import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requirePartnerAuth } from '@/lib/auth/partner'
import { calculateFee, calculateRetainage } from '@/lib/engine/billing'
import { notFoundError } from '@/lib/errors'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'

// ─── GET /api/partner/releases/[releaseId] ────────────────────────────────────
//
// Partner-authenticated polling endpoint. Returns the current state of a
// release, including authorization details and computed financial amounts.
//
// Authentication: Authorization: Bearer <partner_api_key>
//
// Authorization: the partner must be the partner_id associated with the deal
// that owns this release. A partner cannot read releases for deals that belong
// to other partners.
//
// Use this endpoint to:
//   - Poll for a pending release if you did not receive the webhook
//   - Confirm the release is still in 'pending' state before executing payment
//   - Retrieve confirmation details after you've confirmed
//
// Response 200:
//   { release: { id, deal_id, deal_title, milestone_id, milestone_title,
//                amount, fee_amount, retainage_amount, net_to_contractor,
//                execution_status, execution_rail, execution_notes, authorized_at } }
// Response 403: deal not associated with your partner account
// Response 404: release not found

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  const { releaseId } = await params

  // ── Partner authentication ─────────────────────────────────────────────────
  let partnerCtx
  try {
    partnerCtx = await requirePartnerAuth(request)
  } catch (err) {
    return err as NextResponse
  }

  // ── Rate limit — partner API ───────────────────────────────────────────────
  {
    const rl = await checkRateLimit(`partner:${partnerCtx.partnerId}:partner_api`, POLICIES.partner_api)
    if (!rl.allowed) {
      logRateLimitViolation(`partner:${partnerCtx.partnerId}:partner_api`, rl, {
        actorId: partnerCtx.partnerId, policyName: 'partner_api',
        entityType: 'release', entityId: releaseId,
      })
      return rateLimitResponse(rl, POLICIES.partner_api.description)
    }
  }

  const admin = createSupabaseAdminClient()

  // ── Fetch release ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: release, error: releaseError } = await (admin as any)
    .from('releases')
    .select(
      'id, milestone_id, deal_id, amount, execution_rail, execution_status, external_execution_notes, created_at',
    )
    .eq('id', releaseId)
    .single()

  if (releaseError || !release) {
    return notFoundError(`Release ${releaseId} was not found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = release as any

  // ── Fetch deal — verify this partner owns it ───────────────────────────────
  const { data: deal, error: dealError } = await admin
    .from('deals')
    .select('id, title, partner_id, contractor_id, funder_id, billing_rate_bps, retainage_percentage')
    .eq('id', r.deal_id)
    .single()

  if (dealError || !deal) {
    return notFoundError(`The deal for release ${releaseId} could not be found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = deal as any

  if (d.partner_id !== partnerCtx.partnerId) {
    return NextResponse.json(
      {
        error:
          'This release belongs to a deal not associated with your partner account. ' +
          'Partners can only access releases for their own deals.',
      },
      { status: 403 },
    )
  }

  // ── Fetch milestone ────────────────────────────────────────────────────────
  const { data: milestone, error: milestoneError } = await admin
    .from('milestones')
    .select('id, title')
    .eq('id', r.milestone_id)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(`The milestone for release ${releaseId} could not be found.`)
  }

  // ── Calculate fee + retainage ──────────────────────────────────────────────
  const fee = calculateFee(r.amount, d.billing_rate_bps)
  const retainage = calculateRetainage(r.amount, d.retainage_percentage ?? 0)

  return NextResponse.json({
    release: {
      id:                r.id,
      deal_id:           r.deal_id,
      deal_title:        d.title,
      milestone_id:      r.milestone_id,
      milestone_title:   milestone.title,
      amount:            r.amount,
      fee_amount:        fee.feeAmount,
      retainage_amount:  retainage.retainageAmount,
      net_to_contractor: retainage.netToContractor,
      execution_status:  r.execution_status,
      execution_rail:    r.execution_rail,
      execution_notes:   r.external_execution_notes ?? null,
      authorized_at:     r.created_at,
    },
  })
}
