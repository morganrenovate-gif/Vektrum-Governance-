import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'


// ─── POST /api/lien-waivers/[waiverId]/approve ────────────────────────────────
//
// Funder approves an uploaded lien waiver, clearing it for release.
//
// On approval:
//   1. lien_waivers: status = 'approved', approved_by, approved_at
//   2. milestones: lien_waiver_id = waiverId (soft reference to active waiver)
//   3. Audit log: lien_waiver_approved
//
// This satisfies Condition 10 of validateRelease() when deal.lien_waiver_required = true.
//
// Access: Funder of the associated deal. Admins may also approve.
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
    return errorResponse(403, 'Only the deal funder may approve lien waivers.')
  }

  const adminClient = createSupabaseAdminClient()

  // ── Fetch Waiver ──────────────────────────────────────────────────────────
  const { data: waiver, error: waiverError } = await adminClient
    .from('lien_waivers')
    .select('id, deal_id, milestone_id, status, waiver_type, waiver_amount, through_date')
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
      `This lien waiver cannot be approved — its current status is '${waiver.status}'. ` +
        `Only 'uploaded' waivers can be approved. ` +
        (waiver.status === 'requested'
          ? 'The contractor must upload the signed waiver first.'
          : waiver.status === 'approved'
            ? 'This waiver has already been approved.'
            : 'Contact support if you believe this is an error.'),
    )
  }

  const approvedAt = new Date().toISOString()

  // ── Approve Waiver ────────────────────────────────────────────────────────
  const { data: updatedWaiver, error: updateError } = await adminClient
    .from('lien_waivers')
    .update({
      status:      'approved',
      approved_by: user.id,
      approved_at: approvedAt,
    })
    .eq('id', waiverId)
    .eq('status', 'uploaded')  // double-check to prevent TOCTOU
    .select()
    .single()

  if (updateError || !updatedWaiver) {
    return internalError(
      'Failed to approve the lien waiver. Please try again.',
      updateError?.message,
    )
  }

  // ── Update milestone.lien_waiver_id (soft reference to active waiver) ────
  if (waiver.milestone_id) {
    const { error: milestoneUpdateError } = await adminClient
      .from('milestones')
      .update({ lien_waiver_id: waiverId })
      .eq('id', waiver.milestone_id)

    if (milestoneUpdateError) {
      // Non-fatal: waiver is approved; the milestone pointer is just a convenience.
      // The release gate queries lien_waivers directly, so this doesn't block release.
      console.error(
        `[lien-waiver/approve] Failed to update milestone.lien_waiver_id for milestone ` +
          `${waiver.milestone_id}: ${milestoneUpdateError.message}`,
      )
    }
  }

  // ── Audit Log ─────────────────────────────────────────────────────────────
  await logAudit({
    entity_type: 'lien_waiver',
    entity_id:   waiverId,
    action:      'lien_waiver_approved',
    actor_id:    user.id,
    actor_role:  profile.role,
    old_values:  { status: 'uploaded' },
    new_values: {
      status:      'approved',
      approved_by: user.id,
      approved_at: approvedAt,
    },
    metadata: {
      deal_id:       waiver.deal_id,
      milestone_id:  waiver.milestone_id,
      waiver_type:   waiver.waiver_type,
      waiver_amount: waiver.waiver_amount,
      through_date:  waiver.through_date,
    },
  })

  return NextResponse.json(
    {
      lien_waiver: updatedWaiver,
      message: 'Lien waiver approved. This milestone is now cleared for release (subject to all other gate conditions).',
    },
    { status: 200 },
  )
}
