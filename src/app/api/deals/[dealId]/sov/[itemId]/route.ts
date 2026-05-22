import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, validationError, internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── Computed field helpers ───────────────────────────────────────────────────

function computeSovFields(
  scheduled_value: number,
  approved_change_orders: number,
  previous_released: number,
  current_requested: number,
): { revised_value: number; balance_to_finish: number; percent_complete: number } {
  const revised_value = scheduled_value + approved_change_orders
  const balance_to_finish = Math.max(0, revised_value - previous_released - current_requested)
  const percent_complete =
    revised_value > 0
      ? Math.min(100, ((previous_released + current_requested) / revised_value) * 100)
      : 0
  return { revised_value, balance_to_finish, percent_complete }
}

// ─── PATCH /api/deals/[dealId]/sov/[itemId] ──────────────────────────────────
//
// Update or approve a SOV line item.
//
// Contractors can update draft/pending items (field updates).
// Funders and admins can approve (action: 'approve') pending items.
// Admins can supersede items (action: 'supersede').
//
// Body (field update): { description?, scheduled_value?, approved_change_orders?,
//                        previous_released?, current_requested?, retainage_amount?,
//                        item_number?, sort_order? }
// Body (approval):     { action: 'approve' }
// Body (submit):       { action: 'submit' }

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string; itemId: string }> },
) {
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const { dealId, itemId } = await params

  // Verify deal access
  const supabase = await createClient()
  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return validationError(['Request body must be valid JSON.'])
  }

  const adminClient = createSupabaseAdminClient()

  // Fetch the existing item (via admin client to avoid RLS complications)
  const { data: existing, error: fetchErr } = await adminClient
    .from('sov_line_items')
    .select('*')
    .eq('id', itemId)
    .eq('deal_id', dealId)
    .single()

  if (fetchErr || !existing) {
    return notFoundError('SOV line item not found.')
  }

  // ── Action: approve ────────────────────────────────────────────────────────
  if (body.action === 'approve') {
    if (profile.role !== 'funder' && profile.role !== 'admin') {
      return errorResponse(403, 'Only funders and admins can approve SOV line items.')
    }
    if (existing.status !== 'pending_review') {
      return validationError([`Cannot approve a line item with status '${existing.status}'. It must be 'pending_review'.`])
    }

    const { data: approved, error: approveErr } = await adminClient
      .from('sov_line_items')
      .update({
        status:      'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single()

    if (approveErr) {
      return internalError(`Failed to approve SOV line item: ${approveErr.message}`)
    }

    void logAudit({
      entity_type: 'sov_line_item',
      entity_id:   itemId,
      action:      'sov_line_item_approved',
      actor_id:    user.id,
      actor_role:  profile.role,
      old_values:  { status: 'pending_review' },
      new_values:  { status: 'approved', approved_by: user.id },
      metadata:    { deal_id: dealId },
    })

    return NextResponse.json({ item: approved })
  }

  // ── Action: submit (draft → pending_review) ────────────────────────────────
  if (body.action === 'submit') {
    if (profile.role !== 'contractor' && profile.role !== 'admin') {
      return errorResponse(403, 'Only contractors and admins can submit SOV line items for review.')
    }
    if (existing.status !== 'draft') {
      return validationError([`Cannot submit a line item with status '${existing.status}'. It must be 'draft'.`])
    }

    const { data: submitted, error: submitErr } = await adminClient
      .from('sov_line_items')
      .update({ status: 'pending_review' })
      .eq('id', itemId)
      .select()
      .single()

    if (submitErr) {
      return internalError(`Failed to submit SOV line item: ${submitErr.message}`)
    }

    void logAudit({
      entity_type: 'sov_line_item',
      entity_id:   itemId,
      action:      'sov_line_item_updated',
      actor_id:    user.id,
      actor_role:  profile.role,
      old_values:  { status: 'draft' },
      new_values:  { status: 'pending_review' },
      metadata:    { deal_id: dealId },
    })

    return NextResponse.json({ item: submitted })
  }

  // ── Field update ───────────────────────────────────────────────────────────
  // Only contractors and admins can update field values.
  // Approved items are locked (use supersede for corrections).
  if (profile.role !== 'contractor' && profile.role !== 'admin') {
    return errorResponse(403, 'Only contractors and admins can update SOV line items.')
  }
  if (existing.status === 'approved' && profile.role !== 'admin') {
    return errorResponse(409, 'Approved SOV line items cannot be edited. Contact an admin to supersede.')
  }
  if (existing.status === 'superseded') {
    return errorResponse(409, 'Superseded SOV line items cannot be edited.')
  }

  const updates: Record<string, unknown> = {}

  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || !body.description.trim()) {
      return validationError(['description must be a non-empty string.'])
    }
    updates.description = (body.description as string).trim()
  }

  const numericFields = [
    'scheduled_value',
    'approved_change_orders',
    'previous_released',
    'current_requested',
    'retainage_amount',
  ] as const

  for (const field of numericFields) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'number' || (body[field] as number) < 0) {
        return validationError([`${field} must be a non-negative number.`])
      }
      updates[field] = body[field]
    }
  }

  if (body.item_number !== undefined) updates.item_number = body.item_number
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order

  // Recompute derived fields from merged values
  const mergedScheduled = (updates.scheduled_value ?? existing.scheduled_value) as number
  const mergedCO        = (updates.approved_change_orders ?? existing.approved_change_orders) as number
  const mergedPrev      = (updates.previous_released ?? existing.previous_released) as number
  const mergedCurrent   = (updates.current_requested ?? existing.current_requested) as number

  const computed = computeSovFields(mergedScheduled, mergedCO, mergedPrev, mergedCurrent)
  Object.assign(updates, computed)

  if (Object.keys(updates).length === 0) {
    return validationError(['No updatable fields provided.'])
  }

  const { data: updated, error: updateErr } = await adminClient
    .from('sov_line_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single()

  if (updateErr) {
    return internalError(`Failed to update SOV line item: ${updateErr.message}`)
  }

  void logAudit({
    entity_type: 'sov_line_item',
    entity_id:   itemId,
    action:      'sov_line_item_updated',
    actor_id:    user.id,
    actor_role:  profile.role,
    old_values: {
      scheduled_value: existing.scheduled_value,
      status:          existing.status,
    },
    new_values:  updates,
    metadata:    { deal_id: dealId },
  })

  return NextResponse.json({ item: updated })
}
