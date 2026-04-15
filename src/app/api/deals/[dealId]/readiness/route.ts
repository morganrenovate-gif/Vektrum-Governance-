import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

/**
 * GET /api/deals/[dealId]/readiness
 *
 * Computes a Release Readiness score (0–100) for a given deal.
 * Funder-role gated. Pure read — no writes.
 *
 * Scoring breakdown (100 points total):
 *   - Funded ratio          : up to 30 pts  (funded_amount / total_amount)
 *   - Milestones approved   : up to 25 pts  (approved+released / total milestones)
 *   - No open disputes      : 25 pts        (flat — lost entirely if any open dispute)
 *   - No open change orders : 20 pts        (flat — lost entirely if any submitted COs)
 *
 * Returns:
 *   { score: number, breakdown: { label: string, points: number, max: number }[] }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 },
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawProfile } = await (supabase as any)
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    const profile = rawProfile as Pick<Profile, 'id' | 'role'> | null

    if (!profile || (profile.role !== 'funder' && profile.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only funders and admins can view release readiness scores.' },
        { status: 403 },
      )
    }

    const { dealId } = await params

    // Fetch deal — use any cast for the same pre-existing type conflict
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawDeal, error: dealError } = await (supabase as any)
      .from('deals')
      .select('id, funder_id, total_amount, funded_amount, released_amount')
      .eq('id', dealId)
      .single()

    if (dealError || !rawDeal) {
      return NextResponse.json(
        { error: 'Deal not found.' },
        { status: 404 },
      )
    }

    const deal = rawDeal as {
      id: string
      funder_id: string | null
      total_amount: number
      funded_amount: number
      released_amount: number
    }

    // Scope check — funder must own this deal (admin bypasses)
    if (profile.role === 'funder' && deal.funder_id !== profile.id) {
      return NextResponse.json(
        { error: 'Access denied.' },
        { status: 403 },
      )
    }

    // Fetch milestones
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: milestonesRaw } = await (supabase as any)
      .from('milestones')
      .select('id, status')
      .eq('deal_id', dealId)

    const milestones = (milestonesRaw ?? []) as { id: string; status: string }[]

    // Fetch open disputes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: openDisputesRaw } = await (supabase as any)
      .from('disputes')
      .select('id')
      .eq('deal_id', dealId)
      .eq('status', 'open')

    const openDisputes = (openDisputesRaw ?? []) as { id: string }[]

    // Fetch submitted change orders
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: openCOsRaw } = await (supabase as any)
      .from('change_orders')
      .select('id')
      .eq('deal_id', dealId)
      .eq('status', 'submitted')

    const openCOs = (openCOsRaw ?? []) as { id: string }[]

    // ── Scoring ───────────────────────────────────────────────────────────────

    // 1. Funded ratio (up to 30 pts)
    const fundedRatio =
      deal.total_amount > 0 ? deal.funded_amount / deal.total_amount : 0
    const fundedPoints = Math.round(Math.min(1, fundedRatio) * 30)

    // 2. Milestone progress (up to 25 pts)
    const totalMilestones = milestones.length
    const completedMilestones = milestones.filter(
      (m) => m.status === 'approved' || m.status === 'released',
    ).length
    const milestoneRatio =
      totalMilestones > 0 ? completedMilestones / totalMilestones : 0
    const milestonePoints = Math.round(milestoneRatio * 25)

    // 3. No open disputes (25 pts flat)
    const disputePoints = openDisputes.length === 0 ? 25 : 0

    // 4. No open change orders (20 pts flat)
    const coPoints = openCOs.length === 0 ? 20 : 0

    const score = fundedPoints + milestonePoints + disputePoints + coPoints

    return NextResponse.json({
      score,
      breakdown: [
        { label: 'Funded balance', points: fundedPoints, max: 30 },
        { label: 'Milestone progress', points: milestonePoints, max: 25 },
        { label: 'No open disputes', points: disputePoints, max: 25 },
        { label: 'No open change orders', points: coPoints, max: 20 },
      ],
    })
  } catch (err) {
    console.error('[api/deals/readiness] unexpected error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    )
  }
}
