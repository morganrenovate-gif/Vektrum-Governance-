import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { validateTransition } from '@/lib/engine/state-machine'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'
import type { MilestoneStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'



// ─── POST /api/milestones/[milestoneId]/transition ────────────────────────────
// Transition a milestone's status according to the state machine rules.
//
// The 'approved' → 'released' transition is SYSTEM ONLY and is deliberately
// blocked here. Use the dedicated /release endpoint instead.
//
// Body: { new_status: MilestoneStatus }

export async function POST(request: NextRequest, { params }: { params: Promise<{ milestoneId: string }> }) {
  const { milestoneId } = await params

  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const supabase = await createClient()

  // ── Parse Body ──────────────────────────────────────────────────────────────
  let body: { new_status?: string }

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'The request body could not be parsed as JSON. Send: { "new_status": "<milestone_status>" }',
    )
  }

  if (!body.new_status || typeof body.new_status !== 'string') {
    return errorResponse(
      400,
      'new_status is required and must be a string. ' +
        'Valid values are: not_started, in_progress, ready_for_review, approved, disputed.',
    )
  }

  const VALID_STATUSES: MilestoneStatus[] = [
    'not_started',
    'in_progress',
    'ready_for_review',
    'approved',
    'disputed',
  ]

  if (!VALID_STATUSES.includes(body.new_status as MilestoneStatus)) {
    return errorResponse(
      400,
      `'${body.new_status}' is not a recognised milestone status. ` +
        `Valid statuses are: ${VALID_STATUSES.join(', ')}.`,
    )
  }

  const newStatus = body.new_status as MilestoneStatus

  // ── Fetch Milestone ─────────────────────────────────────────────────────────
  const { data: milestone, error: milestoneError } = await supabase
    .from('milestones')
    .select('id, deal_id, status, title, amount')
    .eq('id', milestoneId)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(
      `Milestone ${milestoneId} was not found. Verify the milestone ID and try again.`,
    )
  }

  // ── Deal Access Check ───────────────────────────────────────────────────────
  try {
    await requireDealAccess(supabase, milestone.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── State Machine Validation ────────────────────────────────────────────────
  const result = validateTransition(
    milestone.status as MilestoneStatus,
    newStatus,
    profile.role,
  )

  if (!result.valid) {
    return errorResponse(400, result.error!)
  }

  // ── Apply Transition ────────────────────────────────────────────────────────
  try {
    const oldStatus = milestone.status

    const { data: updatedMilestone, error: updateError } = await supabase
      .from('milestones')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', milestoneId)
      .select()
      .single()

    if (updateError || !updatedMilestone) {
      return internalError(
        'Failed to update the milestone status. Please try again. If this problem continues, contact support.',
        updateError?.message,
      )
    }

    await logAudit({
      entity_type: 'milestone',
      entity_id: milestoneId,
      action: 'status_transitioned',
      actor_id: user.id,
      old_values: {
        status: oldStatus,
      },
      new_values: {
        status: newStatus,
      },
      metadata: {
        deal_id: milestone.deal_id,
        milestone_title: milestone.title,
        transitioned_by_role: profile.role,
      },
    })
    // ── Auto-trigger AI draw review when submitted ─────────────────────────────
if (body.new_status === 'ready_for_review') {
  try {
    fetch(`${request.nextUrl.origin}/api/ai/draw-review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // pass auth cookie through
        cookie: request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ milestoneId }),
    }).catch((err) => {
      console.error('[transition] AI draw review trigger failed:', err)
    })
  } catch (err) {
    console.error('[transition] AI trigger error:', err)
  }
}

    return NextResponse.json({
      milestone: updatedMilestone,
      transition: {
        from: oldStatus,
        to: newStatus,
        performed_by: user.id,
        role: profile.role,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError(
      'An unexpected error occurred while transitioning the milestone status. Please try again.',
      message,
    )
  }
}

