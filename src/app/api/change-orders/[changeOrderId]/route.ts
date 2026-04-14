import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getAuthUser, requireRole, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError, validationError } from '@/lib/errors'
import type { ChangeOrderStatus } from '@/lib/types'

type RouteContext = { params: { changeOrderId: string } }

// ─── PATCH /api/change-orders/[changeOrderId] ─────────────────────────────────
// Approve or reject a change order (funder only).
//
// If approved:
//   - The change order status is updated to 'approved'.
//   - The milestone's amount is adjusted by the change order's amount delta.
//   - The change is audit-logged.
//
// If rejected:
//   - The change order status is updated to 'rejected'.
//   - The milestone's amount is NOT changed.
//
// Body: { decision: 'approved' | 'rejected' }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { changeOrderId } = params

  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try {
    requireRole(profile, 'funder', 'admin')
  } catch (err) {
    return err as NextResponse
  }

  // ── Parse Body ──────────────────────────────────────────────────────────────
  let body: { decision?: string }

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'The request body could not be parsed as JSON. Send: { "decision": "approved" | "rejected" }',
    )
  }

  if (!body.decision || !['approved', 'rejected'].includes(body.decision)) {
    return errorResponse(
      400,
      `'decision' must be either 'approved' or 'rejected'. You provided: '${body.decision ?? 'nothing'}'. ` +
        'Please specify your decision on the change order.',
    )
  }

  const decision = body.decision as Extract<ChangeOrderStatus, 'approved' | 'rejected'>

  const supabase = buildSupabaseFromRequest(request)

  // ── Fetch Change Order ──────────────────────────────────────────────────────
  const { data: changeOrder, error: fetchError } = await supabase
    .from('change_orders')
    .select('id, milestone_id, deal_id, amount, description, status, requestor_id')
    .eq('id', changeOrderId)
    .single()

  if (fetchError || !changeOrder) {
    return notFoundError(
      `Change order ${changeOrderId} was not found. Verify the change order ID and try again.`,
    )
  }

  // ── Deal Access Check ───────────────────────────────────────────────────────
  try {
    await requireDealAccess(supabase, changeOrder.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Guard: Cannot Act on Already-Reviewed Change Orders ────────────────────
  if (changeOrder.status !== 'submitted') {
    return errorResponse(
      400,
      `This change order has already been reviewed (status: '${changeOrder.status}'). ` +
        'Only change orders in \'submitted\' status can be approved or rejected. ' +
        'No further action is required.',
    )
  }

  // ── Fetch Current Milestone Amount (needed for approved path) ───────────────
  const { data: milestone, error: milestoneError } = await supabase
    .from('milestones')
    .select('id, amount, status, deal_id')
    .eq('id', changeOrder.milestone_id)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(
      `The milestone (${changeOrder.milestone_id}) associated with this change order was not found. ` +
        'Contact support if this problem persists.',
    )
  }

  if (milestone.status === 'released') {
    return errorResponse(
      400,
      `Cannot review a change order on a milestone that has already been released. ` +
        `Milestone ${changeOrder.milestone_id} is in a terminal 'released' state.`,
    )
  }

  try {
    const now = new Date().toISOString()
    const oldChangeOrderStatus = changeOrder.status

    // ── Update Change Order Status ────────────────────────────────────────────
    const { data: updatedChangeOrder, error: updateError } = await supabase
      .from('change_orders')
      .update({
        status: decision,
        reviewed_by: user.id,
        reviewed_at: now,
        updated_at: now,
      })
      .eq('id', changeOrderId)
      .select()
      .single()

    if (updateError || !updatedChangeOrder) {
      return internalError(
        'Failed to update the change order status. Please try again. If this problem continues, contact support.',
        updateError?.message,
      )
    }

    // ── If Approved: Adjust Milestone Amount ──────────────────────────────────
    let updatedMilestone = null

    if (decision === 'approved') {
      const oldMilestoneAmount = milestone.amount
      const newMilestoneAmount = milestone.amount + changeOrder.amount

      if (newMilestoneAmount <= 0) {
        // Roll back the change order update — we cannot allow a milestone with a zero or negative amount
        await supabase
          .from('change_orders')
          .update({ status: 'submitted', reviewed_by: null, reviewed_at: null })
          .eq('id', changeOrderId)

        return errorResponse(
          400,
          `Approving this change order would result in a milestone amount of $${newMilestoneAmount.toFixed(2)}, ` +
            'which is not permitted. Milestone amounts must remain greater than $0.00. ' +
            'Reject this change order or adjust the requested amount.',
        )
      }

      const { data: updatedMs, error: milestoneUpdateError } = await supabase
        .from('milestones')
        .update({
          amount: newMilestoneAmount,
          updated_at: now,
        })
        .eq('id', changeOrder.milestone_id)
        .select()
        .single()

      if (milestoneUpdateError || !updatedMs) {
        return internalError(
          'The change order was approved but the milestone amount could not be updated. ' +
            'Please contact support to manually apply the change. ' +
            `Change order ID: ${changeOrderId}, Milestone ID: ${changeOrder.milestone_id}.`,
          milestoneUpdateError?.message,
        )
      }

      updatedMilestone = updatedMs

      await logAudit({
        entity_type: 'milestone',
        entity_id: changeOrder.milestone_id,
        action: 'amount_adjusted_via_change_order',
        actor_id: user.id,
        old_values: { amount: oldMilestoneAmount },
        new_values: { amount: newMilestoneAmount },
        metadata: {
          change_order_id: changeOrderId,
          change_order_amount: changeOrder.amount,
          deal_id: changeOrder.deal_id,
          decision,
        },
      })
    }

    await logAudit({
      entity_type: 'change_order',
      entity_id: changeOrderId,
      action: `change_order_${decision}`,
      actor_id: user.id,
      old_values: { status: oldChangeOrderStatus },
      new_values: { status: decision, reviewed_by: user.id, reviewed_at: now },
      metadata: {
        milestone_id: changeOrder.milestone_id,
        deal_id: changeOrder.deal_id,
        change_amount: changeOrder.amount,
        decision,
      },
    })

    return NextResponse.json({
      change_order: updatedChangeOrder,
      ...(updatedMilestone && { milestone: updatedMilestone }),
      decision,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError(
      'An unexpected error occurred while processing the change order decision. Please try again.',
      message,
    )
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSupabaseFromRequest(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    },
  )
}
