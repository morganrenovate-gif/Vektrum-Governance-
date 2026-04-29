import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── DELETE /api/milestones/[milestoneId]/sov-links/[linkId] ─────────────────
//
// Removes a milestone–SOV link. Advisory only — does not affect release gate.
// Requires: contractor or admin role. Deal participant.

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string; linkId: string }> },
) {
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const { milestoneId, linkId } = await params

  // Contractors and admins only
  if (profile.role !== 'contractor' && profile.role !== 'admin') {
    return errorResponse(403, 'Only contractors and admins can remove SOV links.')
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

  // Fetch the link to confirm it belongs to this milestone and to capture old values
  const { data: link, error: linkErr } = await supabase
    .from('milestone_sov_links')
    .select('id, milestone_id, sov_line_item_id, allocated_amount')
    .eq('id', linkId)
    .eq('milestone_id', milestoneId)
    .single()

  if (linkErr || !link) {
    return notFoundError(`SOV link ${linkId} not found on milestone ${milestoneId}.`)
  }

  const adminClient = createSupabaseAdminClient()

  const { error: deleteError } = await adminClient
    .from('milestone_sov_links')
    .delete()
    .eq('id', linkId)

  if (deleteError) {
    return internalError(`Failed to delete SOV link: ${deleteError.message}`)
  }

  await logAudit({
    entity_type: 'milestone_sov_link',
    entity_id:   linkId,
    action:      'milestone_sov_unlinked',
    actor_id:    user.id,
    actor_role:  profile.role,
    old_values: {
      milestone_id:     milestoneId,
      sov_line_item_id: link.sov_line_item_id,
      allocated_amount: link.allocated_amount,
    },
    metadata: { deal_id: milestone.deal_id },
  })

  return new NextResponse(null, { status: 204 })
}
