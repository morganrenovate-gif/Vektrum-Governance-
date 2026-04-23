import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── GET /api/deals/[dealId]/billing ─────────────────────────────────────────
//
// Returns all billing records for a deal plus aggregate totals.
// Accessible by: the funder of the deal, the contractor, and admins.
// RLS on billing_records enforces this at the DB layer via is_deal_participant().

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params

  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const supabase = await createClient()

  // ── Verify deal exists and caller has access ──────────────────────────────
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, billing_rate_bps, fees_collected, construction_budget, governance_fee_bps, governance_fee_total, facility_total')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return notFoundError(`Deal ${dealId} was not found.`)
  }

  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Fetch Billing Records ─────────────────────────────────────────────────
  // RLS policy: funders, contractors, and admins can SELECT their deal's records.
  const { data: records, error: recordsError } = await supabase
    .from('billing_records')
    .select(
      'id, milestone_id, release_id, gross_amount, billing_rate_bps, fee_amount, net_amount, stripe_transfer_id, created_at',
    )
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true })

  if (recordsError) {
    return NextResponse.json(
      { error: 'Failed to retrieve billing records.', details: recordsError.message },
      { status: 500 },
    )
  }

  // ── Aggregate Totals ──────────────────────────────────────────────────────
  const totalGross = (records ?? []).reduce((sum, r) => sum + r.gross_amount, 0)
  const totalFees  = (records ?? []).reduce((sum, r) => sum + r.fee_amount,  0)
  const totalNet   = (records ?? []).reduce((sum, r) => sum + r.net_amount,  0)

  return NextResponse.json({
    deal_id:          dealId,
    billing_rate_bps: deal.billing_rate_bps,
    // Governance fee model — null for deals created before migration 004
    governance: deal.construction_budget != null ? {
      construction_budget:  deal.construction_budget,
      governance_fee_bps:   deal.governance_fee_bps,
      governance_fee_total: deal.governance_fee_total,
      facility_total:       deal.facility_total,
    } : null,
    records:          records ?? [],
    totals: {
      gross_amount: Math.round(totalGross * 100) / 100,
      fee_amount:   Math.round(totalFees  * 100) / 100,
      net_amount:   Math.round(totalNet   * 100) / 100,
    },
  })
}
