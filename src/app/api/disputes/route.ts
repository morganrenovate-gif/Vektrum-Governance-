import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'

// ─── POST /api/disputes ───────────────────────────────────────────────────────
//
// Opens a formal dispute against a specific milestone.
//
// ISOLATION GUARANTEE: Only the disputed milestone is locked. Every other
// milestone on the same deal continues through its normal approval and release
// flow unaffected. A $15K dispute on a $9M deal locks $15K — not $9M.
//
// What this route does:
//   1. Verifies the caller has access to the deal.
//   2. Confirms the milestone exists and is not already disputed/released.
//   3. Inserts a dispute record (append-only — never deleted).
//   4. Sets milestone.protection_status = 'disputed', blocking release gate Condition 2.
//   5. Writes to the immutable audit log.
//
// Body: { milestone_id, amount_in_dispute, reason }

export async function POST(request: NextRequest) {
  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const supabase = buildSupabaseFromRequest(request)

  // ── Parse Body ──────────────────────────────────────────────────────────────
  let body: {
    milestone_id?: string
    amount_in_dispute?: number
    reason?: string
  }

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'Request body could not be parsed as JSON. Send: { "milestone_id": "...", "amount_in_dispute": 15000, "reason": "..." }',
    )
  }

  const { milestone_id, amount_in_dispute, reason } = body

  if (!milestone_id || typeof milestone_id !== 'string') {
    return errorResponse(400, 'milestone_id is required.')
  }
  if (!amount_in_dispute || typeof amount_in_dispute !== 'number' || amount_in_dispute <= 0) {
    return errorResponse(400, 'amount_in_dispute is required and must be a positive number.')
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    return errorResponse(400, 'reason is required and must be at least 10 characters.')
  }

  // ── Fetch Milestone ─────────────────────────────────────────────────────────
  const { data: milestone, error: milestoneError } = await supabase
    .from('milestones')
    .select('id, deal_id, amount, status, protection_status, title')
    .eq('id', milestone_id)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(`Milestone ${milestone_id} could not be found.`)
  }

  // ── Deal Access Check ───────────────────────────────────────────────────────
  try {
    await requireDealAccess(supabase, milestone.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Guard: Cannot dispute a released milestone ──────────────────────────────
  if (milestone.status === 'released' || milestone.protection_status === 'released') {
    return errorResponse(
      400,
      `This milestone has already been released. Funds have been disbursed and cannot be disputed retroactively. ` +
        `If you believe there was an error, contact support.`,
    )
  }

  // ── Guard: Cannot open a duplicate dispute ──────────────────────────────────
  if (milestone.protection_status === 'disputed') {
    return errorResponse(
      400,
      `This milestone already has an active dispute. ` +
        `The existing dispute must be resolved before a new one can be opened.`,
    )
  }

  // ── Guard: Amount in dispute cannot exceed milestone amount ─────────────────
  if (amount_in_dispute > milestone.amount) {
    return errorResponse(
      400,
      `The disputed amount ($${amount_in_dispute.toFixed(2)}) cannot exceed the milestone amount ` +
        `($${milestone.amount.toFixed(2)}).`,
    )
  }

  // ── Open Dispute + Lock Milestone (two writes, both must succeed) ────────────
  try {
    // 1. Insert dispute record
    const { data: dispute, error: disputeInsertError } = await supabase
      .from('disputes')
      .insert({
        milestone_id,
        deal_id: milestone.deal_id,
        amount_in_dispute,
        reason: reason.trim(),
        status: 'open',
        opened_by: user.id,
      })
      .select()
      .single()

    if (disputeInsertError || !dispute) {
      return internalError(
        'Failed to create the dispute record. Please try again.',
        disputeInsertError?.message,
      )
    }

    // 2. Lock the milestone — set protection_status to 'disputed'
    //    This is the ONLY write that affects this milestone.
    //    Every other milestone on the deal is completely unaffected.
    const { error: milestoneUpdateError } = await supabase
      .from('milestones')
      .update({
        protection_status: 'disputed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', milestone_id)

    if (milestoneUpdateError) {
      // Dispute record was inserted but milestone wasn't locked — this is a
      // partial state. Log it and return an error so it can be manually resolved.
      await logAudit({
        entity_type: 'dispute',
        entity_id: dispute.id,
        action: 'dispute_milestone_lock_failed',
        actor_id: user.id,
        old_values: { protection_status: milestone.protection_status },
        new_values: { protection_status: 'disputed' },
        metadata: {
          dispute_id: dispute.id,
          milestone_id,
          deal_id: milestone.deal_id,
          error: milestoneUpdateError.message,
        },
      })

      return internalError(
        'The dispute was recorded but the milestone could not be locked. ' +
          `Contact support with Dispute ID: ${dispute.id} and Milestone ID: ${milestone_id}.`,
        milestoneUpdateError.message,
      )
    }

    // 3. Audit log — success path
    await logAudit({
      entity_type: 'dispute',
      entity_id: dispute.id,
      action: 'dispute_opened',
      actor_id: user.id,
      old_values: { protection_status: milestone.protection_status },
      new_values: { protection_status: 'disputed' },
      metadata: {
        milestone_id,
        deal_id: milestone.deal_id,
        milestone_title: milestone.title,
        amount_in_dispute,
        reason: reason.trim(),
        opened_by_role: profile.role,
        // Make the isolation guarantee explicit in every audit record
        isolation_note:
          'Only this milestone is locked. All other milestones on this deal are unaffected.',
      },
    })

    return NextResponse.json(
      {
        dispute,
        milestone_locked: true,
        isolation_guarantee:
          'Only this milestone is locked. All other milestones on this deal remain in their current state and can proceed to release independently.',
      },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError('An unexpected error occurred while opening the dispute.', message)
  }
}

// ── GET /api/disputes ──────────────────────────────────────────────────────────
// List disputes the caller has access to. Admins see all; funders and
// contractors see only disputes on their own deals.

export async function GET(request: NextRequest) {
  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { profile } = authContext
  const supabase = buildSupabaseFromRequest(request)

  const { searchParams } = new URL(request.url)
  const dealId = searchParams.get('deal_id')
  const milestoneId = searchParams.get('milestone_id')
  const status = searchParams.get('status')

  try {
    let query = supabase
      .from('disputes')
      .select('*, milestones(title, amount), deals(title)')
      .order('opened_at', { ascending: false })

    if (dealId) query = query.eq('deal_id', dealId)
    if (milestoneId) query = query.eq('milestone_id', milestoneId)
    if (status) query = query.eq('status', status)

    // Non-admins are filtered to their own deals via RLS — no extra filter needed
    const { data: disputes, error } = await query

    if (error) {
      return internalError('Failed to retrieve disputes.', error.message)
    }

    return NextResponse.json({ disputes: disputes ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError('An unexpected error occurred while fetching disputes.', message)
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
