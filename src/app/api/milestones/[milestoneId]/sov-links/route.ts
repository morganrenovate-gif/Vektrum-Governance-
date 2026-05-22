import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, validationError, internalError, notFoundError } from '@/lib/errors'
import type { MilestoneSovLink } from '@/lib/types'

export const dynamic = 'force-dynamic'

// ─── GET /api/milestones/[milestoneId]/sov-links ─────────────────────────────
//
// Returns all SOV links for a milestone, with joined SOV line item data.
// Requires authentication. Deal participants + admins only.
//
// Response: { links: MilestoneSovLink[] }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> },
) {
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const { milestoneId } = await params

  const supabase = await createClient()

  // Fetch milestone to resolve deal_id
  const { data: milestone, error: msErr } = await supabase
    .from('milestones')
    .select('id, deal_id')
    .eq('id', milestoneId)
    .single()

  if (msErr || !milestone) {
    return notFoundError(`Milestone ${milestoneId} not found.`)
  }

  try {
    await requireDealAccess(supabase, milestone.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  const { data: links, error } = await supabase
    .from('milestone_sov_links')
    .select('*, sov_line_item:sov_line_items(*)')
    .eq('milestone_id', milestoneId)
    .order('created_at', { ascending: true })

  if (error) {
    return internalError(`Failed to fetch SOV links: ${error.message}`)
  }

  return NextResponse.json({ links: (links ?? []) as MilestoneSovLink[] })
}

// ─── POST /api/milestones/[milestoneId]/sov-links ────────────────────────────
//
// Links a milestone to an SOV line item with an allocated amount.
// Requires: contractor or admin role. Deal participant.
// Blocks: duplicate links, negative allocated_amount.
// Advisory only — does not affect the release gate.
//
// Body: { sov_line_item_id: string, allocated_amount: number }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> },
) {
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const { milestoneId } = await params

  // Contractors and admins only
  if (profile.role !== 'contractor' && profile.role !== 'admin') {
    return errorResponse(403, 'Only contractors and admins can link milestones to SOV line items.')
  }

  // Parse body
  let body: { sov_line_item_id?: string; allocated_amount?: unknown }
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'Request body must be valid JSON.')
  }

  const { sov_line_item_id, allocated_amount } = body

  if (!sov_line_item_id || typeof sov_line_item_id !== 'string') {
    return validationError(['sov_line_item_id is required and must be a string.'])
  }

  const amount = Number(allocated_amount)
  if (!Number.isFinite(amount) || amount < 0) {
    return validationError(['allocated_amount must be a non-negative number.'])
  }

  const supabase = await createClient()

  // Fetch milestone to resolve deal_id
  const { data: milestone, error: msErr } = await supabase
    .from('milestones')
    .select('id, deal_id')
    .eq('id', milestoneId)
    .single()

  if (msErr || !milestone) {
    return notFoundError(`Milestone ${milestoneId} not found.`)
  }

  try {
    await requireDealAccess(supabase, milestone.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // Verify SOV line item belongs to the same deal
  const { data: sovItem, error: sovErr } = await supabase
    .from('sov_line_items')
    .select('id, deal_id, description, status')
    .eq('id', sov_line_item_id)
    .single()

  if (sovErr || !sovItem) {
    return notFoundError(`SOV line item ${sov_line_item_id} not found.`)
  }

  if (sovItem.deal_id !== milestone.deal_id) {
    return errorResponse(422, 'SOV line item does not belong to the same deal as this milestone.')
  }

  // Use admin client to insert (bypasses RLS INSERT policy nuances)
  const adminClient = createSupabaseAdminClient()

  const { data: link, error: insertError } = await adminClient
    .from('milestone_sov_links')
    .insert({
      milestone_id:     milestoneId,
      sov_line_item_id,
      allocated_amount: amount,
    })
    .select('*, sov_line_item:sov_line_items(*)')
    .single()

  if (insertError) {
    // Unique constraint violation — duplicate link
    if (insertError.code === '23505') {
      return errorResponse(409, 'This milestone is already linked to that SOV line item.')
    }
    return internalError(`Failed to create SOV link: ${insertError.message}`)
  }

  await logAudit({
    entity_type: 'milestone_sov_link',
    entity_id:   (link as MilestoneSovLink).id,
    action:      'milestone_sov_linked',
    actor_id:    user.id,
    actor_role:  profile.role,
    new_values: {
      milestone_id:     milestoneId,
      sov_line_item_id,
      allocated_amount: amount,
      sov_description:  sovItem.description,
    },
    metadata: { deal_id: milestone.deal_id },
  })

  return NextResponse.json({ link }, { status: 201 })
}
