import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { notifyRetryInitiated } from '@/lib/engine/notifications'
import { notFoundError, validationError, internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── POST /api/milestones/[milestoneId]/release/retry ─────────────────────────
//
// Resets a payout_failed milestone back to 'approved' so the funder can
// re-attempt the release. This does NOT re-trigger the Stripe transfer —
// the funder must go through the normal release flow again.
//
// What this endpoint does:
//   1. Validates caller is funder or admin
//   2. Confirms milestone.status === 'payout_failed'
//   3. Finds the failed release row for this milestone
//   4. Verifies the release is already marked failed/reversed (idempotency)
//   5. Resets milestone to status='approved', protection_status='ready_for_release'
//   6. Clears stripe_transfer_id from milestone (it was never on there — it's on releases)
//   7. Audit logs the retry with the failed release ID and previous failure details
//   8. Notifies funder and admin
//
// What this endpoint does NOT do:
//   - Re-attempt the Stripe transfer (that happens via the normal release route)
//   - Delete the failed release row (it stays as audit trail)
//   - Reverse deal financials (the transfer.failed webhook already did that)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> },
) {
  const { milestoneId } = await params

  // ── Auth ────────────────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  if (profile.role !== 'funder' && profile.role !== 'admin') {
    return NextResponse.json(
      {
        error: 'Only funders and admins can retry a failed payout.',
        detail: `Your account role is '${profile.role}'.`,
      },
      { status: 403 },
    )
  }

  const supabase      = await createClient()
  const adminClient   = createSupabaseAdminClient()

  // ── Fetch Milestone ─────────────────────────────────────────────────────────
  const { data: milestone, error: milestoneError } = await supabase
    .from('milestones')
    .select('id, deal_id, title, status, protection_status, payout_failure_count, amount')
    .eq('id', milestoneId)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(`Milestone ${milestoneId} not found.`)
  }

  // ── Fetch Deal ──────────────────────────────────────────────────────────────
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, title, contractor_id, funder_id')
    .eq('id', milestone.deal_id)
    .single()

  if (dealError || !deal) {
    return notFoundError(`Deal for milestone ${milestoneId} not found.`)
  }

  // ── Deal Access Check ───────────────────────────────────────────────────────
  try {
    await requireDealAccess(supabase, milestone.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Validate Milestone Is in payout_failed State ────────────────────────────
  if (milestone.status !== 'payout_failed') {
    return validationError([
      `Cannot retry: milestone is in '${milestone.status}' status. ` +
        `Retry is only available when status is 'payout_failed'.`,
    ])
  }

  // ── Find the Failed Release Row ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: failedRelease, error: releaseError } = await (adminClient as any)
    .from('releases')
    .select('id, stripe_transfer_id, transfer_status, failure_code, failure_message, amount')
    .eq('milestone_id', milestoneId)
    .in('transfer_status', ['failed', 'reversed'])
    .order('failed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (releaseError) {
    return internalError(
      'Could not retrieve the failed release record. Please try again or contact support.',
      releaseError.message,
    )
  }

  if (!failedRelease) {
    return validationError([
      'No failed release record found for this milestone. ' +
        'The milestone may have been reset already or the failure was not recorded correctly. ' +
        'Contact support if this persists.',
    ])
  }

  const nowIso = new Date().toISOString()

  // ── Reset Milestone to Approved ─────────────────────────────────────────────
  // Conditional write: only transition from 'payout_failed' → prevents double-retry race
  const { data: milestoneUpdateData, error: milestoneUpdateError } = await supabase
    .from('milestones')
    .update({
      status:             'approved',
      protection_status:  'ready_for_release',
      updated_at:         nowIso,
    })
    .eq('id', milestoneId)
    .eq('status', 'payout_failed')
    .select('id')

  if (milestoneUpdateError) {
    return internalError(
      'Could not reset milestone status. Please try again.',
      milestoneUpdateError.message,
    )
  }

  if (!milestoneUpdateData || milestoneUpdateData.length === 0) {
    // Race condition: another request already reset this milestone
    return NextResponse.json(
      {
        error:  'Milestone was already reset by a concurrent request.',
        status: 'approved',
      },
      { status: 409 },
    )
  }

  // ── Audit Log ───────────────────────────────────────────────────────────────
  await logAudit({
    entity_type: 'milestone',
    entity_id:   milestoneId,
    action:      'payout_retry_initiated',
    actor_id:    user.id,
    old_values: {
      status:            'payout_failed',
      protection_status: milestone.protection_status,
    },
    new_values: {
      status:            'approved',
      protection_status: 'ready_for_release',
    },
    metadata: {
      deal_id:                milestone.deal_id,
      failed_release_id:      failedRelease.id,
      failed_stripe_transfer: failedRelease.stripe_transfer_id,
      failure_code:           failedRelease.failure_code,
      failure_message:        failedRelease.failure_message,
      payout_failure_count:   milestone.payout_failure_count,
      retry_by_role:          profile.role,
      note:                   'Milestone reset to approved. Funder must re-release via normal flow.',
    },
  })

  // ── Send Notifications ──────────────────────────────────────────────────────
  let funderEmail = ''
  if (deal.funder_id) {
    const { data: u } = await adminClient.auth.admin.getUserById(deal.funder_id)
    funderEmail = u?.user?.email ?? ''
  }

  if (funderEmail) {
    await notifyRetryInitiated(
      {
        milestoneId,
        milestoneTitle: milestone.title,
        dealId:         milestone.deal_id,
        dealTitle:      deal.title,
        grossAmount:    milestone.amount,
        retryCount:     (milestone.payout_failure_count ?? 0) + 1,
        retryBy:        profile.company_name ?? profile.full_name ?? user.id,
      },
      funderEmail,
    )
  }

  console.log(
    `[retry] Milestone ${milestoneId} reset to approved by ${user.id}. ` +
      `Failed release: ${failedRelease.id}. ` +
      `Failure count: ${milestone.payout_failure_count}.`,
  )

  return NextResponse.json({
    success: true,
    milestone_id:      milestoneId,
    status:            'approved',
    protection_status: 'ready_for_release',
    failed_release_id: failedRelease.id,
    retry_count:       (milestone.payout_failure_count ?? 0) + 1,
    message:
      'Milestone has been reset to approved. You can now re-release the payment from the deal dashboard.',
  })
}
