import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { notifyChangeOrderSubmitted } from '@/lib/engine/notify'
import { errorResponse, internalError, notFoundError, validationError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── POST /api/change-orders ──────────────────────────────────────────────────
// Create a change order against a milestone (contractor only).
//
// A change order requests an adjustment to a milestone's agreed amount.
// The funder must approve or reject it via PATCH /api/change-orders/[changeOrderId].
//
// Body: { milestone_id, amount, description }
//   - amount: the delta amount (positive for increase, negative for decrease)
//   - description: human-readable explanation of why the change is needed

export async function POST(request: NextRequest) {
  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try {
    requireRole(profile, 'contractor', 'admin')
  } catch (err) {
    return err as NextResponse
  }

  // ── Parse Body ──────────────────────────────────────────────────────────────
  let body: {
    milestone_id?: string
    amount?: number
    description?: string
  }

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'The request body could not be parsed as JSON. Send: { milestone_id, amount, description }',
    )
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  const validationErrors: string[] = []

  if (!body.milestone_id || typeof body.milestone_id !== 'string') {
    validationErrors.push(
      'milestone_id is required. Provide the UUID of the milestone you are raising this change order against.',
    )
  }

  if (body.amount === undefined || body.amount === null || typeof body.amount !== 'number') {
    validationErrors.push(
      'amount is required and must be a number. ' +
        'Use a positive value to request an increase and a negative value to request a decrease in the milestone amount.',
    )
  } else if (body.amount === 0) {
    validationErrors.push(
      'amount cannot be zero. A change order must request a meaningful adjustment to the milestone amount.',
    )
  }

  if (
    !body.description ||
    typeof body.description !== 'string' ||
    body.description.trim().length < 10
  ) {
    validationErrors.push(
      'description is required and must be at least 10 characters. ' +
        'Provide a clear explanation of why this change order is needed to help the funder make an informed decision.',
    )
  }

  if (validationErrors.length > 0) {
    return validationError(validationErrors)
  }

  const supabase = await createClient()

  // ── Fetch Milestone & Deal ──────────────────────────────────────────────────
  const { data: milestone, error: milestoneError } = await supabase
    .from('milestones')
    .select('id, deal_id, status, contractor_id, amount')
    .eq('id', body.milestone_id!)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(
      `Milestone ${body.milestone_id} was not found. Verify the milestone ID and try again.`,
    )
  }

  // ── Deal Access Check ───────────────────────────────────────────────────────
  try {
    await requireDealAccess(supabase, milestone.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Validate Milestone Status ───────────────────────────────────────────────
  if (milestone.status === 'released') {
    return errorResponse(
      400,
      `Change orders cannot be raised on milestones that have already been released. ` +
        `Milestone ${body.milestone_id} has been fully released and is immutable.`,
    )
  }

  // ── Validate Contractor Ownership ───────────────────────────────────────────
  if (profile.role === 'contractor' && milestone.contractor_id !== user.id) {
    return errorResponse(
      403,
      'You can only raise change orders on milestones assigned to you. ' +
        `Milestone ${body.milestone_id} is assigned to a different contractor.`,
    )
  }

  // ── Check for Existing Open Change Orders ───────────────────────────────────
  const { data: existingOpen, error: openError } = await supabase
    .from('change_orders')
    .select('id')
    .eq('milestone_id', body.milestone_id!)
    .eq('status', 'submitted')

  if (openError) {
    return internalError(
      'Could not verify existing change orders. Please try again.',
      openError.message,
    )
  }

  if (existingOpen && existingOpen.length > 0) {
    return errorResponse(
      409,
      `There is already an open change order on milestone ${body.milestone_id}. ` +
        'You must wait for the funder to approve or reject the existing change order before submitting another.',
    )
  }

  // ── Insert Change Order ─────────────────────────────────────────────────────
  try {
    const { data: changeOrder, error: insertError } = await supabase
      .from('change_orders')
      .insert({
        milestone_id: body.milestone_id!,
        deal_id: milestone.deal_id,
        submitted_by: user.id,
        amount: body.amount!,
        description: body.description!.trim(),
        status: 'submitted',
      })
      .select()
      .single()

    if (insertError || !changeOrder) {
      return internalError(
        'Failed to create the change order. Please try again. If this problem continues, contact support.',
        insertError?.message,
      )
    }

    await logAudit({
      entity_type: 'change_order',
      entity_id: changeOrder.id,
      action: 'change_order_created',
      actor_id: user.id,
      old_values: null,
      new_values: {
        milestone_id: body.milestone_id,
        deal_id: milestone.deal_id,
        amount: body.amount,
        status: 'submitted',
      },
    })

    // Fire-and-forget — notification failure must never block the 201 response.
    notifyChangeOrderSubmitted({
      changeOrderId: changeOrder.id,
      milestoneId:   milestone.id,
      dealId:        milestone.deal_id,
      amount:        body.amount!,
      description:   body.description!.trim(),
      contractorId:  user.id,
    }).catch(() => { /* swallowed — see notify.ts safety contract */ })

    return NextResponse.json({ change_order: changeOrder }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError(
      'An unexpected error occurred while creating the change order. Please try again.',
      message,
    )
  }
}
