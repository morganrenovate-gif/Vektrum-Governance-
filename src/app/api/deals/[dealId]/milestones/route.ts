import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getAuthUser, requireRole, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError, validationError } from '@/lib/errors'

type RouteContext = { params: { dealId: string } }

// ─── GET /api/deals/[dealId]/milestones ───────────────────────────────────────
// List all milestones for a deal.
// Participants and admins only.

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { dealId } = params

  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const supabase = buildSupabaseFromRequest(request)

  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  try {
    const { data: milestones, error } = await supabase
      .from('milestones')
      .select(
        `
        id,
        title,
        description,
        amount,
        status,
        protection_status,
        order_index,
        contractor_id,
        created_at,
        updated_at
      `,
      )
      .eq('deal_id', dealId)
      .order('order_index', { ascending: true })

    if (error) {
      return internalError(
        'Could not retrieve milestones for this deal. Please try again.',
        error.message,
      )
    }

    return NextResponse.json({ milestones })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError(
      'An unexpected error occurred while retrieving milestones. Please try again.',
      message,
    )
  }
}

// ─── POST /api/deals/[dealId]/milestones ──────────────────────────────────────
// Create a milestone for a deal (contractor only).
//
// Requirements:
//   - Deal must be in 'draft' status.
//   - The sum of all existing milestone amounts + new milestone amount
//     must not exceed the deal's total_amount.
//
// Body: { title, description?, amount, order_index? }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { dealId } = params

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

  const supabase = buildSupabaseFromRequest(request)

  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Fetch Deal ──────────────────────────────────────────────────────────────
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, total_amount, status, contractor_id')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return notFoundError(
      `Deal ${dealId} was not found. Verify the deal ID and try again.`,
    )
  }

  if (deal.status !== 'draft') {
    return errorResponse(
      400,
      `Milestones can only be added while the deal is in 'draft' status. ` +
        `This deal is currently '${deal.status}'. ` +
        `Milestones cannot be added to an active or completed deal without first raising a change order.`,
    )
  }

  // Contractors can only create milestones on their own deals
  if (profile.role === 'contractor' && deal.contractor_id !== user.id) {
    return errorResponse(
      403,
      `You are not the contractor on deal ${dealId} and cannot add milestones to it.`,
    )
  }

  // ── Parse Body ──────────────────────────────────────────────────────────────
  let body: {
    title?: string
    description?: string
    amount?: number
    order_index?: number
  }

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'The request body could not be parsed as JSON. Send a valid JSON object with: title, amount.',
    )
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  const validationErrors: string[] = []

  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    validationErrors.push('A milestone title is required and must be a non-empty string.')
  }

  if (body.amount === undefined || body.amount === null || typeof body.amount !== 'number') {
    validationErrors.push(
      'A milestone amount is required and must be a number representing the payment value for this milestone.',
    )
  } else if (body.amount <= 0) {
    validationErrors.push(
      `Milestone amount must be greater than $0.00. The value you provided (${body.amount}) is invalid.`,
    )
  }

  if (validationErrors.length > 0) {
    return validationError(validationErrors)
  }

  // ── Check Sum of Milestone Amounts ──────────────────────────────────────────
  const { data: existingMilestones, error: sumError } = await supabase
    .from('milestones')
    .select('amount')
    .eq('deal_id', dealId)

  if (sumError) {
    return internalError(
      'Could not verify existing milestone totals. Please try again.',
      sumError.message,
    )
  }

  const existingSum = (existingMilestones ?? []).reduce(
    (acc, m) => acc + (m.amount ?? 0),
    0,
  )
  const proposedTotal = existingSum + body.amount!

  if (proposedTotal > deal.total_amount) {
    const remaining = deal.total_amount - existingSum
    return errorResponse(
      400,
      `Adding this milestone would cause the total milestone amount ($${proposedTotal.toFixed(2)}) ` +
        `to exceed the deal's contract value ($${deal.total_amount.toFixed(2)}). ` +
        `You can add at most $${remaining.toFixed(2)} across all remaining milestones. ` +
        `Reduce the milestone amount or increase the deal's total_amount first.`,
    )
  }

  // ── Determine order_index ───────────────────────────────────────────────────
  const orderIndex =
    typeof body.order_index === 'number'
      ? body.order_index
      : (existingMilestones?.length ?? 0) + 1

  // ── Insert Milestone ────────────────────────────────────────────────────────
  try {
    const { data: milestone, error: insertError } = await supabase
      .from('milestones')
      .insert({
        deal_id: dealId,
        contractor_id: user.id,
        title: body.title!.trim(),
        description: body.description?.trim() ?? null,
        amount: body.amount!,
        order_index: orderIndex,
        status: 'not_started',
        protection_status: 'pending',
      })
      .select()
      .single()

    if (insertError || !milestone) {
      return internalError(
        'Failed to create the milestone. Please try again. If this problem continues, contact support.',
        insertError?.message,
      )
    }

    await logAudit({
      entity_type: 'milestone',
      entity_id: milestone.id,
      action: 'milestone_created',
      actor_id: user.id,
      old_values: null,
      new_values: {
        deal_id: dealId,
        title: milestone.title,
        amount: milestone.amount,
        status: milestone.status,
        order_index: milestone.order_index,
      },
    })

    return NextResponse.json({ milestone }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError(
      'An unexpected error occurred while creating the milestone. Please try again.',
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
