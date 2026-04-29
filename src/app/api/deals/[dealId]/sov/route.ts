import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, validationError, internalError } from '@/lib/errors'
import type { SovLineItem } from '@/lib/types'

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

// ─── GET /api/deals/[dealId]/sov ─────────────────────────────────────────────
//
// Returns all SOV line items for a deal plus computed totals.
// Requires authentication. Deal participants + admins only.
//
// Response: { items: SovLineItem[], totals: SovTotals, warnings: string[] }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const { dealId } = await params

  // Verify deal access
  const supabase = await createClient()
  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  const { data: items, error } = await supabase
    .from('sov_line_items')
    .select('*')
    .eq('deal_id', dealId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return internalError(`Failed to fetch SOV line items: ${error.message}`)
  }

  const sovItems = (items ?? []) as SovLineItem[]

  // Totals
  const totals = {
    scheduled_value:        sovItems.reduce((s, i) => s + i.scheduled_value, 0),
    approved_change_orders: sovItems.reduce((s, i) => s + i.approved_change_orders, 0),
    revised_value:          sovItems.reduce((s, i) => s + i.revised_value, 0),
    previous_released:      sovItems.reduce((s, i) => s + i.previous_released, 0),
    current_requested:      sovItems.reduce((s, i) => s + i.current_requested, 0),
    retainage_amount:       sovItems.reduce((s, i) => s + i.retainage_amount, 0),
    balance_to_finish:      sovItems.reduce((s, i) => s + i.balance_to_finish, 0),
  }

  // ── Advisory warnings — do NOT affect release eligibility ────────────────
  const { data: deal } = await supabase
    .from('deals')
    .select('total_amount')
    .eq('id', dealId)
    .single()

  const warnings: string[] = []
  if (deal && Math.abs(totals.revised_value - deal.total_amount) > 0.01) {
    warnings.push(
      `SOV revised contract value (${totals.revised_value.toFixed(2)}) does not match deal contract amount (${deal.total_amount.toFixed(2)}).`,
    )
  }

  return NextResponse.json({ items: sovItems, totals, warnings })
}

// ─── POST /api/deals/[dealId]/sov ────────────────────────────────────────────
//
// Creates a new draft SOV line item on a deal.
// Requires: contractor or admin role. Deal participant.
//
// Body: { description, scheduled_value, item_number?, sort_order?,
//         approved_change_orders?, previous_released?, current_requested?,
//         retainage_amount? }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const { dealId } = await params

  // Only contractors and admins can create SOV line items
  if (profile.role !== 'contractor' && profile.role !== 'admin') {
    return errorResponse(403, 'Only contractors and admins can create SOV line items.')
  }

  // Verify deal access
  const supabase = await createClient()
  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    description?: string
    scheduled_value?: number
    item_number?: string
    sort_order?: number
    approved_change_orders?: number
    previous_released?: number
    current_requested?: number
    retainage_amount?: number
  }

  try {
    body = await request.json()
  } catch {
    return validationError('Request body must be valid JSON.')
  }

  if (!body.description?.trim()) {
    return validationError('description is required.')
  }
  if (typeof body.scheduled_value !== 'number' || body.scheduled_value < 0) {
    return validationError('scheduled_value must be a non-negative number.')
  }

  const approved_change_orders = body.approved_change_orders ?? 0
  const previous_released = body.previous_released ?? 0
  const current_requested = body.current_requested ?? 0
  const retainage_amount = body.retainage_amount ?? 0

  if (approved_change_orders < 0) return validationError('approved_change_orders must be >= 0.')
  if (previous_released < 0) return validationError('previous_released must be >= 0.')
  if (current_requested < 0) return validationError('current_requested must be >= 0.')
  if (retainage_amount < 0) return validationError('retainage_amount must be >= 0.')

  const computed = computeSovFields(
    body.scheduled_value,
    approved_change_orders,
    previous_released,
    current_requested,
  )

  // Use admin client for insert so we bypass RLS and can set created_by safely
  const adminClient = createSupabaseAdminClient()

  const { data: item, error } = await adminClient
    .from('sov_line_items')
    .insert({
      deal_id:                dealId,
      description:            body.description.trim(),
      scheduled_value:        body.scheduled_value,
      approved_change_orders,
      previous_released,
      current_requested,
      retainage_amount,
      ...computed,
      item_number:            body.item_number ?? null,
      sort_order:             body.sort_order ?? 0,
      status:                 'draft',
      created_by:             user.id,
    })
    .select()
    .single()

  if (error) {
    return internalError(`Failed to create SOV line item: ${error.message}`)
  }

  // Audit
  void logAudit({
    entity_type: 'sov_line_item',
    entity_id:   item.id,
    action:      'sov_line_item_created',
    actor_id:    user.id,
    actor_role:  profile.role,
    new_values: {
      deal_id:         dealId,
      description:     item.description,
      scheduled_value: item.scheduled_value,
      status:          item.status,
    },
    metadata: { deal_id: dealId },
  })

  return NextResponse.json({ item }, { status: 201 })
}
