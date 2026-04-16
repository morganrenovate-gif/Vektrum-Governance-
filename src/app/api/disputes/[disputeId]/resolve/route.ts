import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── PATCH /api/disputes/[disputeId]/resolve ──────────────────────────────────
//
// Resolves an open dispute and determines what happens to the locked milestone.
//
// Resolution outcomes (controlled by `outcome` field in the request body):
//
//   'release'   — Dispute is resolved in the contractor's favour.
//                 Milestone protection_status → 'ready_for_release'.
//                 The funder can now proceed to release funds normally.
//
//   'write_off' — Dispute is resolved against the contractor.
//                 Milestone protection_status → 'disputed' stays, status → 'released'
//                 with $0 transfer (or a partial amount). In practice, the
//                 funder would handle any refund separately. The milestone is
//                 marked closed so it doesn't block the deal forever.
//
//   'escalate'  — Dispute is escalated for admin/legal review.
//                 Milestone remains locked. dispute.status → 'escalated'.
//                 No protection_status change — the lock stays in place.
//
// Only admins and funders can resolve. Contractors cannot self-resolve.
//
// Body: { outcome: 'release' | 'write_off' | 'escalate', resolution: string }

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> },
) {
  const { disputeId } = await params

  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const supabase = await createClient()

  // ── Role check — contractors cannot resolve disputes ────────────────────────
  if (profile.role === 'contractor') {
    return errorResponse(
      403,
      'Contractors cannot resolve disputes. Only funders and admins can resolve a dispute. ' +
        'If you believe this dispute should be closed, contact your funder.',
    )
  }

  // ── Parse Body ──────────────────────────────────────────────────────────────
  let body: {
    outcome?: string
    resolution?: string
  }

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'Request body could not be parsed as JSON. Send: { "outcome": "release" | "write_off" | "escalate", "resolution": "..." }',
    )
  }

  const { outcome, resolution } = body

  const VALID_OUTCOMES = ['release', 'write_off', 'escalate'] as const
  type Outcome = (typeof VALID_OUTCOMES)[number]

  if (!outcome || !VALID_OUTCOMES.includes(outcome as Outcome)) {
    return errorResponse(
      400,
      `outcome is required. Valid values are: ${VALID_OUTCOMES.join(', ')}.`,
    )
  }

  if (!resolution || typeof resolution !== 'string' || resolution.trim().length < 10) {
    return errorResponse(400, 'resolution is required and must be at least 10 characters.')
  }

  const resolvedOutcome = outcome as Outcome

  // ── Fetch Dispute ───────────────────────────────────────────────────────────
  const { data: dispute, error: disputeError } = await supabase
    .from('disputes')
    .select('id, milestone_id, deal_id, amount_in_dispute, status, opened_by')
    .eq('id', disputeId)
    .single()

  if (disputeError || !dispute) {
    return notFoundError(`Dispute ${disputeId} could not be found.`)
  }

  // ── Guard: Already resolved ─────────────────────────────────────────────────
  if (dispute.status === 'resolved') {
    return errorResponse(
      400,
      `This dispute has already been resolved and cannot be modified.`,
    )
  }

  // ── Deal Access Check ───────────────────────────────────────────────────────
  try {
    await requireDealAccess(supabase, dispute.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Fetch Milestone (to confirm current protection_status) ──────────────────
  const { data: milestone, error: milestoneError } = await supabase
    .from('milestones')
    .select('id, protection_status, status, title, amount')
    .eq('id', dispute.milestone_id)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(`Milestone ${dispute.milestone_id} could not be found.`)
  }

  // ── Apply Resolution ────────────────────────────────────────────────────────
  try {
    const now = new Date().toISOString()

    if (resolvedOutcome === 'release') {
      // ── Outcome: Release ──────────────────────────────────────────────────
      // Milestone is unlocked. Funder proceeds to release funds normally
      // through the existing /release endpoint.

      const { error: milestoneUpdateError } = await supabase
        .from('milestones')
        .update({
          protection_status: 'ready_for_release',
          updated_at: now,
        })
        .eq('id', dispute.milestone_id)

      if (milestoneUpdateError) {
        return internalError(
          'Failed to unlock the milestone after resolving the dispute.',
          milestoneUpdateError.message,
        )
      }

      const { error: disputeUpdateError } = await supabase
        .from('disputes')
        .update({
          status: 'resolved',
          resolved_by: user.id,
          resolution: resolution.trim(),
          resolved_at: now,
        })
        .eq('id', disputeId)

      if (disputeUpdateError) {
        return internalError(
          'Milestone was unlocked but the dispute record could not be updated. ' +
            `Contact support with Dispute ID: ${disputeId}.`,
          disputeUpdateError.message,
        )
      }

      await logAudit({
        entity_type: 'dispute',
        entity_id: disputeId,
        action: 'dispute_resolved_release',
        actor_id: user.id,
        old_values: {
          dispute_status: dispute.status,
          protection_status: milestone.protection_status,
        },
        new_values: {
          dispute_status: 'resolved',
          protection_status: 'ready_for_release',
        },
        metadata: {
          outcome: 'release',
          resolution: resolution.trim(),
          milestone_id: dispute.milestone_id,
          deal_id: dispute.deal_id,
          milestone_title: milestone.title,
          resolved_by_role: profile.role,
          isolation_note:
            'Only this milestone was affected. All other milestones on this deal were unaffected throughout the dispute.',
        },
      })

      return NextResponse.json({
        dispute: { ...dispute, status: 'resolved', resolved_by: user.id, resolved_at: now },
        milestone_unlocked: true,
        next_step:
          'The milestone is now cleared for release. Use the release endpoint to disburse funds.',
      })
    }

    if (resolvedOutcome === 'write_off') {
      // ── Outcome: Write-Off ────────────────────────────────────────────────
      // Work is rejected. Milestone is closed without payment.
      // protection_status is set to 'disputed' (stays locked — no payout).
      // The milestone status can be left as-is or the admin can manually handle.

      const { error: disputeUpdateError } = await supabase
        .from('disputes')
        .update({
          status: 'resolved',
          resolved_by: user.id,
          resolution: resolution.trim(),
          resolved_at: now,
        })
        .eq('id', disputeId)

      if (disputeUpdateError) {
        return internalError(
          'Failed to close the dispute record.',
          disputeUpdateError.message,
        )
      }

      await logAudit({
        entity_type: 'dispute',
        entity_id: disputeId,
        action: 'dispute_resolved_write_off',
        actor_id: user.id,
        old_values: { dispute_status: dispute.status },
        new_values: { dispute_status: 'resolved' },
        metadata: {
          outcome: 'write_off',
          resolution: resolution.trim(),
          milestone_id: dispute.milestone_id,
          deal_id: dispute.deal_id,
          milestone_title: milestone.title,
          amount_written_off: dispute.amount_in_dispute,
          resolved_by_role: profile.role,
          isolation_note:
            'Only this milestone was affected. All other milestones on this deal were unaffected throughout the dispute.',
        },
      })

      return NextResponse.json({
        dispute: { ...dispute, status: 'resolved', resolved_by: user.id, resolved_at: now },
        milestone_unlocked: false,
        next_step:
          'The dispute is closed. The milestone remains locked with no payout. Any partial payment must be handled manually.',
      })
    }

    if (resolvedOutcome === 'escalate') {
      // ── Outcome: Escalate ─────────────────────────────────────────────────
      // Dispute is escalated for admin/legal review.
      // Milestone stays locked. dispute.status → 'escalated'.

      const { error: disputeUpdateError } = await supabase
        .from('disputes')
        .update({
          status: 'escalated',
          resolved_by: user.id,
          resolution: resolution.trim(),
        })
        .eq('id', disputeId)

      if (disputeUpdateError) {
        return internalError(
          'Failed to escalate the dispute.',
          disputeUpdateError.message,
        )
      }

      await logAudit({
        entity_type: 'dispute',
        entity_id: disputeId,
        action: 'dispute_escalated',
        actor_id: user.id,
        old_values: { dispute_status: dispute.status },
        new_values: { dispute_status: 'escalated' },
        metadata: {
          outcome: 'escalate',
          escalation_note: resolution.trim(),
          milestone_id: dispute.milestone_id,
          deal_id: dispute.deal_id,
          milestone_title: milestone.title,
          escalated_by_role: profile.role,
        },
      })

      return NextResponse.json({
        dispute: { ...dispute, status: 'escalated' },
        milestone_unlocked: false,
        next_step:
          'The dispute has been escalated. An admin will review and issue a final resolution.',
      })
    }

    // Should never reach here given the VALID_OUTCOMES guard above
    return errorResponse(400, 'Invalid outcome.')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError('An unexpected error occurred while resolving the dispute.', message)
  }
}
