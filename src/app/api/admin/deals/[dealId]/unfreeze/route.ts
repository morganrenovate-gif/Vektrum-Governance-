export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  getAuthUser,
  requireRole,
  requireMFA,
  extractAdminJustification,
  requireAdminAudit,
} from '@/lib/auth/middleware'
import { notFoundError, errorResponse } from '@/lib/errors'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

// ─── POST /api/admin/deals/[dealId]/unfreeze ──────────────────────────────────
//
// Unfreezes a deal that was frozen by the DocuSign envelope-voided webhook after
// milestone releases had already occurred on the deal.
//
// WHY THIS EXISTS
// ───────────────
// When a contract is voided AFTER payments have been released, the deal is
// automatically set to status='frozen' and deal_freeze_on_void=true. This
// prevents any further releases until a human with admin authority reviews
// the situation and determines it is safe to resume.
//
// This endpoint is the ONLY automated path to unfreeze. It requires:
//   • Admin role
//   • Active AAL2 MFA session
//   • Written justification (≥ 20 characters)
//   • Optionally: a new_status to restore to (default: frozen_from_status)
//
// The justification, action, actor identity, and timestamp are permanently
// written to both audit_log and admin_audit_log. These records cannot be
// edited or deleted (append-only audit log, hash-chained).
//
// WHAT IT DOES
// ────────────
// 1. Verifies the deal is currently frozen (deal.status === 'frozen').
// 2. Restores deal.status to the provided new_status (or frozen_from_status).
// 3. Clears deal_freeze_on_void = false and frozen_from_status = null.
// 4. Dual-writes an admin_unfreeze_deal audit event to both log tables.
//
// BODY:
//   {
//     admin_justification: string  // ≥ 20 chars — why it is safe to unfreeze
//     new_status?: string          // optional target status; defaults to frozen_from_status
//                                  // must be one of: draft | active | in_progress |
//                                  //   completed | disputed | cancelled
//   }
//
// RESPONSE:
//   200 { success, deal_id, restored_status, message }

const VALID_RESTORE_STATUSES = ['draft', 'active', 'in_progress', 'completed', 'disputed', 'cancelled'] as const
type RestoreStatus = typeof VALID_RESTORE_STATUSES[number]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params

  // ── Auth ───────────────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try {
    requireRole(profile, 'admin')
  } catch (err) {
    return err as NextResponse
  }

  // Build supabase user client for MFA check
  const supabase = await createClient()
  try {
    await requireMFA(supabase, profile)
  } catch (err) {
    return err as NextResponse
  }

  // ── Rate limit — admin write ───────────────────────────────────────────────
  {
    const rl = await checkRateLimit(`user:${user.id}:admin_write`, POLICIES.admin_write)
    if (!rl.allowed) {
      logRateLimitViolation(`user:${user.id}:admin_write`, rl, {
        actorId: user.id, policyName: 'admin_write',
        entityType: 'deal', entityId: dealId,
      })
      return rateLimitResponse(rl, POLICIES.admin_write.description)
    }
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'Request body must be valid JSON.')
  }

  let justification: string
  try {
    justification = extractAdminJustification(request, body)
  } catch (err) {
    return err as NextResponse
  }

  // Optional new_status override
  const requestedStatus = typeof body.new_status === 'string' ? body.new_status : null

  if (requestedStatus !== null && !VALID_RESTORE_STATUSES.includes(requestedStatus as RestoreStatus)) {
    return errorResponse(
      400,
      `Invalid new_status '${requestedStatus}'. ` +
      `Must be one of: ${VALID_RESTORE_STATUSES.join(', ')}.`,
    )
  }

  // ── Fetch deal ─────────────────────────────────────────────────────────────
  const admin = createSupabaseAdminClient()

  const { data: deal, error: dealError } = await admin
    .from('deals')
    .select('id, status, frozen_from_status, deal_freeze_on_void, title')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return notFoundError(`Deal ${dealId} was not found.`)
  }

  if (deal.status !== 'frozen') {
    return errorResponse(
      409,
      `Deal ${dealId} is not currently frozen (status: '${deal.status}'). ` +
      'Only frozen deals can be unfrozen.',
    )
  }

  // ── Determine restore status ───────────────────────────────────────────────
  const restoreStatus: RestoreStatus = (
    requestedStatus as RestoreStatus | null
    ?? (deal.frozen_from_status as RestoreStatus | null)
    ?? 'active'
  )

  // ── Update deal ────────────────────────────────────────────────────────────
  const { error: updateError } = await admin
    .from('deals')
    .update({
      status:             restoreStatus,
      deal_freeze_on_void: false,
      frozen_from_status: null,
    })
    .eq('id', dealId)
    .eq('status', 'frozen') // optimistic concurrency guard

  if (updateError) {
    console.error('[admin-unfreeze] Failed to update deal:', updateError.message)
    return errorResponse(
      500,
      'The deal could not be unfrozen due to a database error. Please try again.',
    )
  }

  // ── Dual-write audit ───────────────────────────────────────────────────────
  await requireAdminAudit(profile, user, justification, {
    action:      'admin_unfreeze_deal',
    entityType:  'deal',
    entityId:    dealId,
    systemSource: 'api/admin/deals/unfreeze',
    oldValues:   {
      status:             'frozen',
      deal_freeze_on_void: true,
      frozen_from_status: deal.frozen_from_status,
    },
    newValues:   {
      status:             restoreStatus,
      deal_freeze_on_void: false,
      frozen_from_status: null,
    },
    metadata: {
      deal_title:      deal.title,
      requested_by:    user.email,
      justification,
      restored_to:     restoreStatus,
      prior_status:    deal.frozen_from_status,
    },
  })

  return NextResponse.json(
    {
      success:         true,
      deal_id:         dealId,
      restored_status: restoreStatus,
      message:
        `Deal '${deal.title}' has been unfrozen and restored to status '${restoreStatus}'. ` +
        `This action has been permanently recorded in the audit log.`,
    },
    { status: 200 },
  )
}
