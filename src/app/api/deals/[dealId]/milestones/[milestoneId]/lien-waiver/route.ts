import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'
import type { LienWaiverType } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_WAIVER_TYPES: LienWaiverType[] = [
  'conditional_progress',
  'unconditional_progress',
  'conditional_final',
  'unconditional_final',
]


// ─── POST /api/deals/[dealId]/milestones/[milestoneId]/lien-waiver ─────────────
//
// Requests a lien waiver from the contractor for a specific milestone.
// Funder action only.
//
// Creates a lien_waivers record with status = 'requested'. The contractor is
// expected to upload a signed PDF (POST /api/lien-waivers/[id]/upload), which
// the funder then reviews and approves or rejects.
//
// For milestone releases, always request waiver_type = 'conditional_progress' —
// the standard pre-disbursement form (AIA G702/G703 equivalent). The funder
// may also request other types for project close-out documentation.
//
// Body: {
//   waiver_type: LienWaiverType,   // default: 'conditional_progress'
//   waiver_amount?: number,        // default: milestone.amount
//   through_date?: string,         // ISO date e.g. '2026-05-01'
// }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string; milestoneId: string }> },
) {
  const { dealId, milestoneId } = await params

  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  if (profile.role !== 'funder' && profile.role !== 'admin') {
    return errorResponse(403, 'Only the deal funder may request lien waivers.')
  }

  const adminClient = createSupabaseAdminClient()

  // ── Deal Access ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseForAccess = adminClient as any
  try {
    await requireDealAccess(supabaseForAccess, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Fetch Milestone (verify it belongs to this deal) ─────────────────────
  const { data: milestone, error: milestoneError } = await adminClient
    .from('milestones')
    .select('id, deal_id, amount, title, status')
    .eq('id', milestoneId)
    .eq('deal_id', dealId)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(
      `Milestone ${milestoneId} was not found on deal ${dealId}.`,
    )
  }

  // ── Parse Body ─────────────────────────────────────────────────────────────
  let body: { waiver_type?: unknown; waiver_amount?: unknown; through_date?: unknown }

  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const waiverType: LienWaiverType =
    typeof body.waiver_type === 'string' && VALID_WAIVER_TYPES.includes(body.waiver_type as LienWaiverType)
      ? (body.waiver_type as LienWaiverType)
      : 'conditional_progress'

  const waiverAmount =
    typeof body.waiver_amount === 'number' && body.waiver_amount > 0
      ? Math.round(body.waiver_amount * 100) / 100
      : milestone.amount

  const throughDate =
    typeof body.through_date === 'string' && body.through_date.match(/^\d{4}-\d{2}-\d{2}$/)
      ? body.through_date
      : null

  // ── Prevent duplicate pending requests ───────────────────────────────────
  // If a 'requested' or 'uploaded' waiver of this type already exists for
  // this milestone, return it instead of creating a duplicate.
  const { data: existingWaiver } = await adminClient
    .from('lien_waivers')
    .select('id, status')
    .eq('milestone_id', milestoneId)
    .eq('waiver_type', waiverType)
    .in('status', ['requested', 'uploaded'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingWaiver) {
    return NextResponse.json(
      {
        lien_waiver: existingWaiver,
        message:
          `A ${waiverType.replace(/_/g, ' ')} lien waiver is already ` +
          `${existingWaiver.status} for this milestone.`,
      },
      { status: 200 },
    )
  }

  // ── Create Waiver Record ───────────────────────────────────────────────────
  const { data: waiver, error: insertError } = await adminClient
    .from('lien_waivers')
    .insert({
      deal_id:      dealId,
      milestone_id: milestoneId,
      waiver_type:  waiverType,
      status:       'requested',
      waiver_amount: waiverAmount,
      through_date:  throughDate,
      requested_at:  new Date().toISOString(),
    })
    .select()
    .single()

  if (insertError || !waiver) {
    return internalError(
      'Failed to create lien waiver request. Please try again.',
      insertError?.message,
    )
  }

  await logAudit({
    entity_type: 'lien_waiver',
    entity_id:   waiver.id,
    action:      'lien_waiver_requested',
    actor_id:    user.id,
    actor_role:  profile.role,
    old_values:  null,
    new_values: {
      waiver_type:   waiverType,
      waiver_amount: waiverAmount,
      through_date:  throughDate,
      milestone_id:  milestoneId,
      deal_id:       dealId,
      milestone_title: milestone.title,
    },
  })

  return NextResponse.json({ lien_waiver: waiver }, { status: 201 })
}
