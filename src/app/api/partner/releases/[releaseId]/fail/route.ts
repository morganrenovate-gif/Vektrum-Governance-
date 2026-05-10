import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requirePartnerAuth } from '@/lib/auth/partner'
import { logAudit } from '@/lib/engine/audit'
import { calculateFee } from '@/lib/engine/billing'
import { internalError, notFoundError, validationError } from '@/lib/errors'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'

// ─── POST /api/partner/releases/[releaseId]/fail ──────────────────────────────
//
// Partner-authenticated endpoint. Called by an institutional execution-rail
// partner when they cannot execute an authorised payment (e.g. contractor
// bank account closed, wire rejected, insufficient beneficiary details).
//
// Mirrors the user-facing POST /api/releases/[releaseId]/mark-external-failed
// endpoint. The partner must be the partner_id on the deal owning this release.
//
// Authentication: Authorization: Bearer <partner_api_key>
//
// Request body:
//   { reason: string }   (required, ≥ 10 chars)
//
// Effects:
//   - Transitions execution_status 'pending' → 'failed'
//   - Frees the deal's reserved_amount via cancel_release_reservation
//   - Audit-logs the failure
//   - Does NOT revert milestone.status from 'released' — admin action required

interface PartnerFailBody {
  reason?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  const { releaseId } = await params

  // ── Partner authentication ─────────────────────────────────────────────────
  let partnerCtx
  try {
    partnerCtx = await requirePartnerAuth(request)
  } catch (err) {
    return err as NextResponse
  }

  // ── Rate limit — partner API ───────────────────────────────────────────────
  {
    const rl = await checkRateLimit(`partner:${partnerCtx.partnerId}:partner_api`, POLICIES.partner_api)
    if (!rl.allowed) {
      logRateLimitViolation(`partner:${partnerCtx.partnerId}:partner_api`, rl, {
        actorId: partnerCtx.partnerId, policyName: 'partner_api',
        entityType: 'release', entityId: releaseId,
      })
      return rateLimitResponse(rl, POLICIES.partner_api.description)
    }
  }

  // ── Parse body + hash for audit binding ───────────────────────────────────
  // Read the raw request body once so we can (a) parse it and (b) hash it for
  // partner_ack_hash binding in every audit event — mirroring the confirm route.
  let rawBody: Buffer
  try {
    rawBody = Buffer.from(await request.arrayBuffer())
  } catch {
    return validationError(['Could not read request body.'])
  }
  const partnerAckHash = createHash('sha256').update(rawBody).digest('hex')

  let body: PartnerFailBody
  try {
    body = JSON.parse(rawBody.toString('utf-8')) as PartnerFailBody
  } catch {
    return validationError(['Request body must be valid JSON.'])
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (!reason || reason.length < 10) {
    return validationError([
      'reason is required and must be at least 10 characters — it is captured in the audit trail.',
    ])
  }
  if (reason.length > 2000) {
    return validationError(['reason must be at most 2000 characters.'])
  }

  const admin = createSupabaseAdminClient()

  // ── Fetch release ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: release, error: releaseError } = await (admin as any)
    .from('releases')
    .select('id, milestone_id, deal_id, amount, execution_rail, execution_status, external_execution_notes')
    .eq('id', releaseId)
    .single()

  if (releaseError || !release) {
    return notFoundError(`Release ${releaseId} was not found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = release as any

  if (r.execution_rail !== 'external_manual') {
    return validationError([
      `Only external-rail releases can be marked failed via the partner API. execution_rail is '${r.execution_rail}'.`,
    ])
  }

  // ── Fetch deal — verify this partner owns it ───────────────────────────────
  const { data: deal, error: dealError } = await admin
    .from('deals')
    .select('id, contractor_id, funder_id, billing_rate_bps, partner_id')
    .eq('id', r.deal_id)
    .single()

  if (dealError || !deal) {
    return notFoundError(`The deal for release ${releaseId} could not be found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = deal as any

  if (d.partner_id !== partnerCtx.partnerId) {
    return NextResponse.json(
      {
        error:
          'This release belongs to a deal not associated with your partner account. ' +
          'Partners can only report failures for their own deals.',
      },
      { status: 403 },
    )
  }

  // ── STEP 1: Atomic state transition via DB-level SELECT FOR UPDATE ─────────
  //
  // partner_fail_release_atomic acquires a row lock before reading or writing
  // execution_status. Concurrent confirm/fail calls on the same release are
  // serialised at the lock so exactly one terminal outcome can win.
  //
  //   - Two concurrent fails: the loser reads 'failed' and returns 'already_failed'.
  //   - Fail racing with a concurrent confirm: the loser reads 'confirmed' and
  //     returns 'conflict', which routes to a 409 with an audit event.
  //
  const existingNotes = typeof r.external_execution_notes === 'string' && r.external_execution_notes.length > 0
    ? `${r.external_execution_notes}\n---\n`
    : ''
  const failureNote = `${existingNotes}[PARTNER FAILED ${new Date().toISOString()}] ${reason}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcResult, error: rpcError } = await (admin as any).rpc(
    'partner_fail_release_atomic',
    {
      p_release_id:   r.id,
      p_failure_note: failureNote,
    },
  )

  if (rpcError) {
    await logAudit({
      entity_type:      'release',
      entity_id:        r.id,
      action:           'partner_fail_update_failed',
      actor_id:         null,
      partner_ack_hash: partnerAckHash,
      metadata: {
        partner_id:   partnerCtx.partnerId,
        partner_name: partnerCtx.partnerName,
        deal_id:      r.deal_id,
        error:        rpcError.message,
      },
    })
    return internalError('The release could not be marked as failed. Please try again.', rpcError.message)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpcRow  = (Array.isArray(rpcResult) ? rpcResult[0] : rpcResult) as any
  const outcome = rpcRow?.outcome as string | undefined

  // ── Handle: idempotent fail (release already in failed state) ───────────────
  if (outcome === 'already_failed') {
    await logAudit({
      entity_type:      'release',
      entity_id:        r.id,
      action:           'partner_release_fail_idempotent',
      actor_id:         null,
      system_source:    'api/partner/releases/fail',
      partner_ack_hash: partnerAckHash,
      metadata: {
        partner_id:   partnerCtx.partnerId,
        partner_name: partnerCtx.partnerName,
        deal_id:      r.deal_id,
        reason,
        note: 'Repeated fail call — release was already in failed state. No state change.',
      },
    })
    return NextResponse.json(
      {
        success:                    true,
        releaseId:                  r.id,
        alreadyFailed:              true,
        execution_status:           'failed',
        note: 'This release was already marked as failed. No further action was taken.',
      },
      { status: 200 },
    )
  }

  // ── Handle: conflict — release already confirmed ────────────────────────────
  if (outcome === 'conflict') {
    await logAudit({
      entity_type:      'release',
      entity_id:        r.id,
      action:           'partner_release_fail_rejected',
      actor_id:         null,
      system_source:    'api/partner/releases/fail',
      partner_ack_hash: partnerAckHash,
      metadata: {
        partner_id:    partnerCtx.partnerId,
        partner_name:  partnerCtx.partnerName,
        deal_id:       r.deal_id,
        reason,
        current_status: rpcRow.current_execution_status,
        note: 'Fail rejected: release is already confirmed. Admin intervention required to reverse.',
      },
    })
    return NextResponse.json(
      {
        error:
          'This release has already been confirmed. A confirmed release cannot be marked ' +
          'failed via the partner API — contact Vektrum admin for a reversal.',
        code:           'EXECUTION_CONFLICT',
        current_status: 'confirmed',
      },
      { status: 409 },
    )
  }

  // ── Handle: wrong status (reversed, executing, etc.) ───────────────────────
  if (outcome === 'wrong_status') {
    return validationError([
      `Only 'pending' external releases can be marked failed. Current status: '${rpcRow.current_execution_status}'.`,
    ])
  }

  // ── Handle: not found (defensive — route pre-validates existence above) ─────
  if (outcome !== 'failed') {
    return notFoundError(`Release ${releaseId} was not found or could not be marked as failed.`)
  }

  // ── outcome === 'failed': state transitioned successfully ───────────────────

  // ── STEP 2: Cancel the funded-balance reservation ──────────────────────────
  const fee = calculateFee(r.amount, d.billing_rate_bps)

  const { error: cancelError } = await admin.rpc('cancel_release_reservation', {
    p_deal_id: r.deal_id,
    p_gross:   fee.grossAmount,
    p_fee:     fee.feeAmount,
  })

  if (cancelError) {
    await logAudit({
      entity_type:      'deal',
      entity_id:        r.deal_id,
      action:           'partner_fail_reservation_cancel_failed',
      actor_id:         null,
      partner_ack_hash: partnerAckHash,
      metadata: {
        partner_id:   partnerCtx.partnerId,
        release_id:   r.id,
        gross_amount: fee.grossAmount,
        fee_amount:   fee.feeAmount,
        error:        cancelError.message,
        note:         'Release marked failed but reservation cancel failed — orphaned reserved_amount.',
      },
    })
  }

  // ── STEP 3: Audit log ──────────────────────────────────────────────────────
  await logAudit({
    entity_type:      'release',
    entity_id:        r.id,
    action:           'partner_release_failed',
    actor_id:         null,
    system_source:    'api/partner/releases/fail',
    partner_ack_hash: partnerAckHash,
    old_values:       { execution_status: 'pending' },
    new_values:       { execution_status: 'failed' },
    metadata: {
      partner_id:              partnerCtx.partnerId,
      partner_name:            partnerCtx.partnerName,
      deal_id:                 r.deal_id,
      milestone_id:            r.milestone_id,
      contractor_id:           d.contractor_id,
      funder_id:               d.funder_id,
      execution_rail:          'external_manual',
      gross_amount:            fee.grossAmount,
      fee_amount:              fee.feeAmount,
      reason,
      reservation_cancelled:   !cancelError,
      milestone_status_note:
        'Milestone remains in released state. Admin action required if the funder wants to re-authorise.',
    },
  })

  return NextResponse.json({
    success:                    true,
    releaseId:                  r.id,
    execution_status:           'failed',
    execution_rail:             'external_manual',
    reason,
    reservation_cancelled:      !cancelError,
    milestone_status_unchanged: true,
    note:
      'Release marked failed and funded-balance reservation freed. ' +
      'Milestone remains in released state — contact Vektrum admin to revert if needed.',
  })
}
