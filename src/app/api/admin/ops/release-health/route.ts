import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireMFA } from '@/lib/auth/middleware'
import { internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/ops/release-health ────────────────────────────────────────
//
// Returns two datasets for the ops release-monitoring panel:
//
//  1. stuck_releases  — milestones with status='approved' for longer than
//                       STUCK_THRESHOLD_HOURS (default: 4h).
//                       Joined with deal title, contractor, and funder names so
//                       ops can identify the deal without further lookups.
//
//  2. failed_payouts  — milestones with status='payout_failed', joined with the
//                       most recent failed/reversed release row so ops can see
//                       failure_code, failure_message, and retry count.
//
// Query param: ?stuck_hours=N overrides the stuck threshold (default 4).
//
// Admin-only. Read-only. Never modifies any row.

const DEFAULT_STUCK_HOURS = 4

export async function GET(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  try {
    requireRole(authContext.profile, 'admin')
  } catch (err) {
    return err as NextResponse
  }

  const supabase = await createClient()
  try {
    await requireMFA(supabase, authContext.profile)
  } catch (err) {
    return err as NextResponse
  }

  const url = new URL(request.url)
  const stuckHours = Math.max(
    1,
    parseInt(url.searchParams.get('stuck_hours') ?? String(DEFAULT_STUCK_HOURS), 10) || DEFAULT_STUCK_HOURS,
  )

  const adminClient = createSupabaseAdminClient()

  // ── 1. Stuck releases ─────────────────────────────────────────────────────
  // Milestones approved but not yet released beyond the threshold.
  // approved_at is set when a funder approves the milestone; if approved_at is
  // NULL we fall back to updated_at (edge case: data pre-migration).
  const stuckCutoff = new Date(Date.now() - stuckHours * 60 * 60 * 1000).toISOString()

  const { data: stuckRows, error: stuckError } = await adminClient
    .from('milestones')
    .select(`
      id,
      title,
      amount,
      status,
      approved_at,
      updated_at,
      deal_id,
      deals (
        id,
        title,
        total_amount,
        status,
        contractor:profiles!deals_contractor_id_fkey (
          id, full_name, company_name
        ),
        funder:profiles!deals_funder_id_fkey (
          id, full_name, company_name
        )
      )
    `)
    .eq('status', 'approved')
    .or(`approved_at.lt.${stuckCutoff},and(approved_at.is.null,updated_at.lt.${stuckCutoff})`)
    .order('approved_at', { ascending: true, nullsFirst: false })
    .limit(100)

  if (stuckError) {
    return internalError('Failed to fetch stuck releases.', stuckError.message)
  }

  // ── 2. Failed payouts ─────────────────────────────────────────────────────
  // Milestones in payout_failed state — need ops attention for retry or
  // manual investigation.
  const { data: failedRows, error: failedError } = await adminClient
    .from('milestones')
    .select(`
      id,
      title,
      amount,
      status,
      payout_failure_count,
      last_payout_failure_at,
      deal_id,
      approved_at,
      updated_at,
      deals (
        id,
        title,
        total_amount,
        status,
        contractor:profiles!deals_contractor_id_fkey (
          id, full_name, company_name
        ),
        funder:profiles!deals_funder_id_fkey (
          id, full_name, company_name
        )
      )
    `)
    .eq('status', 'payout_failed')
    .order('last_payout_failure_at', { ascending: false, nullsFirst: false })
    .limit(100)

  if (failedError) {
    return internalError('Failed to fetch failed payouts.', failedError.message)
  }

  // For each failed payout, fetch the most recent failed/reversed release row
  // for failure_code + failure_message detail.
  const failedMilestoneIds = (failedRows ?? []).map((m) => m.id)
  let releaseDetailMap: Record<string, {
    id: string
    stripe_transfer_id: string | null
    transfer_status: string
    failure_code: string | null
    failure_message: string | null
    failed_at: string | null
    amount: number
  }> = {}

  if (failedMilestoneIds.length > 0) {
    const { data: releaseRows } = await adminClient
      .from('releases')
      .select('id, milestone_id, stripe_transfer_id, transfer_status, failure_code, failure_message, failed_at, amount')
      .in('milestone_id', failedMilestoneIds)
      .in('transfer_status', ['failed', 'reversed'])
      .order('failed_at', { ascending: false, nullsFirst: false })

    if (releaseRows) {
      // Keep only the most-recent release per milestone (first row wins due to ORDER BY DESC)
      for (const r of releaseRows) {
        const milestoneId = (r as { milestone_id: string }).milestone_id
        if (!releaseDetailMap[milestoneId]) {
          releaseDetailMap[milestoneId] = r as typeof releaseDetailMap[string]
        }
      }
    }
  }

  // ── Shape response ────────────────────────────────────────────────────────

  type DealJoin = {
    id: string
    title: string
    total_amount: number
    status: string
    contractor: { id: string; full_name: string | null; company_name: string | null } | null
    funder: { id: string; full_name: string | null; company_name: string | null } | null
  }

  function dealName(p: { full_name: string | null; company_name: string | null } | null) {
    return p?.full_name ?? p?.company_name ?? 'Unknown'
  }

  // Hours since a given ISO timestamp
  function hoursSince(iso: string | null): number | null {
    if (!iso) return null
    return Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000)
  }

  const stuckReleases = (stuckRows ?? []).map((m) => {
    const deal = m.deals as unknown as DealJoin | null
    const approvedAt = m.approved_at ?? m.updated_at
    return {
      milestone_id:      m.id,
      milestone_title:   m.title,
      amount:            m.amount,
      approved_at:       approvedAt,
      hours_stuck:       hoursSince(approvedAt),
      deal_id:           m.deal_id,
      deal_title:        deal?.title ?? 'Unknown deal',
      deal_status:       deal?.status ?? null,
      contractor_id:     deal?.contractor?.id ?? null,
      contractor_name:   dealName(deal?.contractor ?? null),
      funder_id:         deal?.funder?.id ?? null,
      funder_name:       dealName(deal?.funder ?? null),
    }
  })

  const failedPayouts = (failedRows ?? []).map((m) => {
    const deal = m.deals as unknown as DealJoin | null
    const releaseDetail = releaseDetailMap[m.id] ?? null
    return {
      milestone_id:          m.id,
      milestone_title:       m.title,
      amount:                m.amount,
      payout_failure_count:  (m as { payout_failure_count?: number }).payout_failure_count ?? 0,
      last_payout_failure_at: (m as { last_payout_failure_at?: string | null }).last_payout_failure_at ?? null,
      hours_since_failure:   hoursSince((m as { last_payout_failure_at?: string | null }).last_payout_failure_at ?? null),
      deal_id:               m.deal_id,
      deal_title:            deal?.title ?? 'Unknown deal',
      deal_status:           deal?.status ?? null,
      contractor_id:         deal?.contractor?.id ?? null,
      contractor_name:       dealName(deal?.contractor ?? null),
      funder_id:             deal?.funder?.id ?? null,
      funder_name:           dealName(deal?.funder ?? null),
      // Most-recent transfer failure detail
      release_id:            releaseDetail?.id ?? null,
      stripe_transfer_id:    releaseDetail?.stripe_transfer_id ?? null,
      transfer_status:       releaseDetail?.transfer_status ?? null,
      failure_code:          releaseDetail?.failure_code ?? null,
      failure_message:       releaseDetail?.failure_message ?? null,
      failed_at:             releaseDetail?.failed_at ?? null,
    }
  })

  return NextResponse.json({
    scanned_at:          new Date().toISOString(),
    stuck_threshold_hours: stuckHours,
    stuck_count:         stuckReleases.length,
    failed_count:        failedPayouts.length,
    stuck_releases:      stuckReleases,
    failed_payouts:      failedPayouts,
    summary: {
      clean: stuckReleases.length === 0 && failedPayouts.length === 0,
      // Highest-value stuck (for summary headline)
      max_stuck_amount:  stuckReleases.reduce((max, r) => Math.max(max, r.amount), 0),
      max_failed_amount: failedPayouts.reduce((max, r) => Math.max(max, r.amount), 0),
    },
  })
}
