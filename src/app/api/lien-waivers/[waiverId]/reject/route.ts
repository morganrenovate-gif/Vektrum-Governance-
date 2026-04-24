import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'


// ─── POST /api/lien-waivers/[waiverId]/reject ─────────────────────────────────
//
// Funder rejects an uploaded lien waiver and provides a rejection reason.
// The contractor is expected to correct the issue and re-upload (the same
// waiver record accepts re-uploads when status = 'rejected').
//
// On rejection:
//   1. lien_waivers: status = 'rejected', rejection_reason, rejected_at
//   2. Audit log: lien_waiver_rejected
//
// Common rejection reasons:
//   - "Through-date does not match this draw period"
//   - "Missing notarization — California requires this for waivers over $X"
//   - "Waiver amount does not match the milestone amount"
//   - "Incorrect waiver type — please use the conditional progress form"
//
// Body: { rejection_reason: string }  (required, min 10 chars)
// Access: Funder of the associated deal. Admins may also reject.
// Precondition: waiver must be in 'uploaded' status.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ waiverId: string }> },
) {
  const { waiverId } = await params

  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  if (profile.role !== 'funder' && profile.role !== 'admin') {
    return errorResponse(403, 'Only the deal funder may reject lien waivers.')
  }

  const adminClient = createSupabaseAdminClient()

  // ── Fetch Waiver ──────────────────────────────────────────────────────────
  const { data: waiver, error: waiverError } = await adminClient
    .from('lien_waivers')
    .select('id, deal_id, milestone_id, status, waiver_type, waiver_amount')
    .eq('id', waiverId)
    .single()

  if (waiverError || !waiver) {
    return notFoundError(`Lien waiver ${waiverId} was not found.`)
  }

  // ── Deal Access Check ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  try {
    await requireDealAccess(adminClient as any, waiver.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Status Check ──────────────────────────────────────────────────────────
  if (waiver.status !== 'uploaded') {
    return errorResponse(
      422,
      `This lien waiver cannot be rejected — its current status is '${waiver.status}'. ` +
        `Only 'uploaded' waivers can be rejected. ` +
        (waiver.status === 'requested'
          ? 'The contractor must upload the waiver before it can be reviewed.'
          : waiver.status === 'approved'
            ? 'This waiver has already been approved. Contact support if a correction is needed.'
            : waiver.status === 'rejected'
              ? 'This waiver is already rejected. The contractor can re-upload to resolve.'
              : ''),
    )
  }

  // ── Parse Body ─────────────────────────────────────────────────────────────
  let body: { rejection_reason?: unknown }
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'The request body could not be parsed as JSON.')
  }

  if (
    typeof body.rejection_reason !== 'string' ||
    body.rejection_reason.trim().length < 10
  ) {
    return errorResponse(
      400,
      'rejection_reason is required and must be at least 10 characters. ' +
        'Provide a clear explanation so the contractor can correct the issue and re-upload.',
    )
  }

  const rejectionReason = body.rejection_reason.trim()
  const rejectedAt      = new Date().toISOString()

  // ── Reject Waiver ─────────────────────────────────────────────────────────
  const { data: updatedWaiver, error: updateError } = await adminClient
    .from('lien_waivers')
    .update({
      status:           'rejected',
      rejection_reason: rejectionReason,
      rejected_at:      rejectedAt,
    })
    .eq('id', waiverId)
    .eq('status', 'uploaded')  // double-check
    .select()
    .single()

  if (updateError || !updatedWaiver) {
    return internalError(
      'Failed to reject the lien waiver. Please try again.',
      updateError?.message,
    )
  }

  // ── Audit Log ─────────────────────────────────────────────────────────────
  await logAudit({
    entity_type: 'lien_waiver',
    entity_id:   waiverId,
    action:      'lien_waiver_rejected',
    actor_id:    user.id,
    actor_role:  profile.role,
    old_values:  { status: 'uploaded' },
    new_values: {
      status:           'rejected',
      rejection_reason: rejectionReason,
      rejected_at:      rejectedAt,
    },
    metadata: {
      deal_id:       waiver.deal_id,
      milestone_id:  waiver.milestone_id,
      waiver_type:   waiver.waiver_type,
      waiver_amount: waiver.waiver_amount,
    },
  })

  return NextResponse.json(
    {
      lien_waiver: updatedWaiver,
      message:
        'Lien waiver rejected. The contractor has been notified and can re-upload a corrected waiver.',
    },
    { status: 200 },
  )
}
