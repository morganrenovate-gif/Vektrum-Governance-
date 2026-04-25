import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  getAuthUser,
  requireDealAccess,
  requireMFA,
  extractAdminJustification,
  requireAdminAudit,
} from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { calculateFee } from '@/lib/engine/billing'
import { internalError, notFoundError, validationError } from '@/lib/errors'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'

// ─── POST /api/releases/[releaseId]/mark-external-failed ─────────────────────
//
// PHASE-1 RAIL-ABSTRACTION ENDPOINT — Controlled failure for an authorised-but-
// not-yet-confirmed external release.
//
// Semantics:
//
//   ✅ Transitions execution_status 'pending' → 'failed'.
//   ✅ Captures a reason in external_execution_notes.
//   ✅ Frees the deal's reserved_amount via cancel_release_reservation so the
//      funded balance is available for a re-authorisation.
//   ✅ Audit-logs the failure with full context.
//
//   ❌ Does NOT revert milestone.status from 'released' → 'approved'. The DB
//      trigger enforce_milestone_status_transition blocks that transition for
//      non-system callers (by design — a released milestone means "governance
//      authorised payment"). Admin action is required to revert milestone
//      state if the funder wants to re-authorise the SAME milestone.
//   ❌ Does NOT delete the release row (releases are immutable evidence).
//   ❌ Does NOT touch billing_records (none exists yet — billing is only
//      written at confirm-external).
//   ❌ Does NOT touch released_amount / fees_collected / retainage_held (none
//      was incremented — those are deferred until confirmation).
//
// Caller:
//   - Funder of the deal (MFA), OR
//   - Admin (MFA + admin_justification; dual-writes to admin_audit_log).
//
// Body:
//   {
//     reason: string      (required, ≥ 10 chars; written to notes)
//     admin_justification?: string  (required if caller is admin)
//   }

interface MarkExternalFailedBody {
  reason?:              string
  admin_justification?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  const { releaseId } = await params

  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const supabase = await createClient()

  // ── MFA Guard ──────────────────────────────────────────────────────────────
  try {
    await requireMFA(supabase, profile)
  } catch (err) {
    return err as NextResponse
  }

  // ── Rate limit — financial writes ──────────────────────────────────────────
  {
    const rl = await checkRateLimit(`user:${user.id}:financial_write`, POLICIES.financial_write)
    if (!rl.allowed) {
      logRateLimitViolation(`user:${user.id}:financial_write`, rl, {
        actorId: user.id, policyName: 'financial_write',
        entityType: 'release', entityId: releaseId,
      })
      return rateLimitResponse(rl, POLICIES.financial_write.description)
    }
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: MarkExternalFailedBody
  try {
    body = (await request.json()) as MarkExternalFailedBody
  } catch {
    return validationError(['Request body must be valid JSON.'])
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (!reason || reason.length < 10) {
    return validationError([
      'reason is required and must be at least 10 characters — this is captured in the audit trail.',
    ])
  }
  if (reason.length > 2000) {
    return validationError(['reason must be at most 2000 characters.'])
  }

  // ── Fetch release ──────────────────────────────────────────────────────────
  const adminClient = createSupabaseAdminClient()

  const { data: release, error: releaseError } = await adminClient
    .from('releases')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select(
      'id, milestone_id, deal_id, amount, execution_rail, execution_status, external_execution_notes' as any,
    )
    .eq('id', releaseId)
    .single()

  if (releaseError || !release) {
    return notFoundError(
      `Release ${releaseId} was not found. Verify the release id and try again.`,
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = release as any

  if (r.execution_rail !== 'external_manual') {
    return validationError([
      'Only external-rail releases can be marked external-failed. ' +
        `execution_rail is '${r.execution_rail}'.`,
    ])
  }

  if (r.execution_status !== 'pending') {
    return validationError([
      `Only 'pending' external releases can be marked failed. Current execution_status: '${r.execution_status}'. ` +
        (r.execution_status === 'confirmed'
          ? 'A confirmed release cannot be marked failed — contact admin for a reversal.'
          : 'No action taken.'),
    ])
  }

  // ── Fetch deal (for authorisation + reservation cancel math) ───────────────
  const { data: deal, error: dealError } = await adminClient
    .from('deals')
    .select('id, title, contractor_id, funder_id, billing_rate_bps')
    .eq('id', r.deal_id)
    .single()

  if (dealError || !deal) {
    return notFoundError(`The deal for release ${releaseId} could not be found.`)
  }

  // ── Caller authorisation ───────────────────────────────────────────────────
  const isAdmin  = profile.role === 'admin'
  const isFunder = profile.role === 'funder'

  if (!isAdmin && !isFunder) {
    return NextResponse.json(
      {
        error:
          'Only the deal funder or an admin can mark an external release as failed.',
      },
      { status: 403 },
    )
  }

  if (isFunder) {
    try {
      await requireDealAccess(supabase, r.deal_id, user.id, profile.role)
    } catch (err) {
      return err as NextResponse
    }
    if (deal.funder_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the deal funder can mark this release as externally failed.' },
        { status: 403 },
      )
    }
  }

  let adminJustification: string | null = null
  if (isAdmin) {
    try {
      adminJustification = extractAdminJustification(request, body as unknown as Record<string, unknown>)
    } catch (err) {
      return err as NextResponse
    }
  }

  // ── STEP 1: Update release row to failed (atomic) ─────────────────────────
  // Conditional update on execution_status='pending' — if a concurrent
  // confirm-external already ran, this will return 0 rows and we abort.
  const existingNotes = typeof r.external_execution_notes === 'string' && r.external_execution_notes.length > 0
    ? `${r.external_execution_notes}\n---\n`
    : ''
  const failureNote = `${existingNotes}[FAILED ${new Date().toISOString()}] ${reason}`

  const { data: failedRows, error: updateError } = await (adminClient as unknown as {
    from: (t: string) => {
      update: (v: Record<string, unknown>) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            select: (s: string) => Promise<{ data: Array<{ id: string }> | null; error: { message: string } | null }>
          }
        }
      }
    }
  })
    .from('releases')
    .update({
      execution_status:         'failed',
      external_execution_notes: failureNote,
    })
    .eq('id', r.id)
    .eq('execution_status', 'pending')
    .select('id')

  if (updateError) {
    await logAudit({
      entity_type: 'release',
      entity_id:   r.id,
      action:      'external_release_mark_failed_update_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        execution_rail: 'external_manual',
        deal_id:        r.deal_id,
        milestone_id:   r.milestone_id,
        reason,
        error:          updateError.message,
      },
    })
    return internalError(
      'The release could not be marked as failed. Please try again.',
      updateError.message,
    )
  }

  if (!failedRows || failedRows.length === 0) {
    return NextResponse.json(
      {
        error:
          'This release state changed concurrently (it may have been confirmed or failed already). No action taken.',
      },
      { status: 409 },
    )
  }

  // ── STEP 2: Cancel the funded-balance reservation ──────────────────────────
  // Release authorization had reserved gross+fee on the deal. Since no funds
  // moved, free the reservation so the capacity can be re-used.
  const fee = calculateFee(r.amount, deal.billing_rate_bps)

  const { error: cancelError } = await supabase.rpc('cancel_release_reservation', {
    p_deal_id: r.deal_id,
    p_gross:   fee.grossAmount,
    p_fee:     fee.feeAmount,
  })

  if (cancelError) {
    // Non-fatal: release is already marked failed. Reservation will need
    // manual reconciliation — reconciliation engine surfaces this as a
    // stale reserved_amount.
    await logAudit({
      entity_type: 'deal',
      entity_id:   r.deal_id,
      action:      'external_release_reservation_cancel_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        release_id:     r.id,
        gross_amount:   fee.grossAmount,
        fee_amount:     fee.feeAmount,
        error:          cancelError.message,
        note:
          'Release marked failed but reservation cancel failed — reserved_amount has orphaned capacity.',
      },
    })
  }

  // ── STEP 3: Audit log ──────────────────────────────────────────────────────
  await logAudit({
    entity_type: 'release',
    entity_id:   r.id,
    action:      'external_release_marked_failed',
    actor_id:    user.id,
    old_values:  { execution_status: 'pending' },
    new_values:  { execution_status: 'failed' },
    metadata: {
      deal_id:                 r.deal_id,
      milestone_id:            r.milestone_id,
      contractor_id:           deal.contractor_id,
      funder_id:               deal.funder_id,
      execution_rail:          'external_manual',
      gross_amount:            fee.grossAmount,
      fee_amount:              fee.feeAmount,
      reason,
      marked_by_role:          profile.role,
      admin_override:          isAdmin,
      reservation_cancelled:   !cancelError,
      milestone_status_note:
        'Milestone remains in released state — DB trigger blocks automatic revert. Admin action required if the funder wants to re-authorise the same milestone.',
    },
  })

  if (isAdmin && adminJustification) {
    await requireAdminAudit(
      profile,
      { id: user.id, email: user.email ?? '' },
      adminJustification,
      {
        action:       'external_release_marked_failed_by_admin',
        entityType:   'release',
        entityId:     r.id,
        systemSource: 'api/releases/[releaseId]/mark-external-failed',
        oldValues:    { execution_status: 'pending' },
        newValues:    { execution_status: 'failed' },
        metadata: {
          deal_id:          r.deal_id,
          milestone_id:     r.milestone_id,
          actual_funder_id: deal.funder_id,
          execution_rail:   'external_manual',
          gross_amount:     fee.grossAmount,
          fee_amount:       fee.feeAmount,
          reason,
        },
      },
    )
  }

  return NextResponse.json({
    success: true,
    releaseId: r.id,
    execution_status: 'failed',
    execution_rail:   'external_manual',
    reason,
    reservation_cancelled: !cancelError,
    milestone_status_unchanged: true,
    note:
      'Release is marked failed and the funded-balance reservation has been freed. ' +
      'The milestone remains in released state — contact admin if you need to revert milestone status to re-authorise.',
  })
}
