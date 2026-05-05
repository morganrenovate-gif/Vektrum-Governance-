import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { internalError, notFoundError, validationError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── POST /api/releases/[releaseId]/expire-if-stale ───────────────────────────
//
// Stage B3 (G7): explicit helper to transition a stale `pending` external-rail
// release into a terminal expired state, freeing the funded-balance reservation
// that has been held since authorization time.
//
// This endpoint is the substrate for a future cron job. Until that exists,
// it can be called on demand (admin or funder) when the configured TTL on
// the authorization token has passed and the partner has not confirmed.
//
// Behavior:
//   1. Look up the release, the joined deal, and the authorization token.
//   2. Refuse unless ALL of:
//        - release.execution_status = 'pending'
//        - release.execution_rail   = 'external_manual'
//        - token.status IN ('issued','delivered')
//        - token.expires_at < now()
//   3. Update token: status='expired', expired_at=now()
//   4. Update release: execution_status='failed' (terminal)
//   5. Call cancel_release_reservation(deal, gross, fee) to free the reserved
//      funded balance.
//   6. Write an audit row that binds token_hash and the inbound request body's
//      partner_ack_hash (idempotency / traceability).
//
// Idempotency: a second call after step 4 lands returns 409 (already expired/
// failed) so callers can safely retry on transient network errors.

interface ExpireIfStaleBody {
  reason?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  const { releaseId } = await params

  // ── Auth ──────────────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }
  const { user, profile } = authContext

  // Funders + admins only. Contractors do not own the funded-balance reservation.
  if (profile.role !== 'funder' && profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only funders or admins may expire stale releases.' },
      { status: 403 },
    )
  }

  // ── Read body for ack hash ────────────────────────────────────────────────
  // The body is optional; we only use the bytes for chain binding. Empty body
  // is fine.
  let rawBody: Buffer
  try {
    rawBody = Buffer.from(await request.arrayBuffer())
  } catch {
    return validationError(['Request body could not be read.'])
  }
  const partnerAckHash = createHash('sha256').update(rawBody).digest('hex')

  let body: ExpireIfStaleBody = {}
  if (rawBody.length > 0) {
    try {
      body = JSON.parse(rawBody.toString('utf-8')) as ExpireIfStaleBody
    } catch {
      // Tolerated: empty/invalid body — proceed with no reason.
    }
  }
  const reason = (typeof body.reason === 'string' && body.reason.trim()) || 'token_expired'

  // ── Fetch release ─────────────────────────────────────────────────────────
  const adminClient = createSupabaseAdminClient()
  const supabase    = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: release, error: releaseError } = await (adminClient as any)
    .from('releases')
    .select('id, deal_id, milestone_id, amount, execution_rail, execution_status, authorization_token_id')
    .eq('id', releaseId)
    .single()

  if (releaseError || !release) {
    return notFoundError(`Release ${releaseId} was not found.`)
  }

  if (release.execution_rail !== 'external_manual') {
    return validationError([
      'expire-if-stale only applies to external-rail releases. ' +
      'Stripe-rail releases settle synchronously and do not have a pending state.',
    ])
  }
  if (release.execution_status !== 'pending') {
    return NextResponse.json(
      {
        error: `Release execution_status is "${release.execution_status}" — already in a terminal or settled state. No action taken.`,
        code:  'NOT_PENDING',
      },
      { status: 409 },
    )
  }

  // ── Deal access check ────────────────────────────────────────────────────
  try {
    await requireDealAccess(supabase, release.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Fetch token + deal ───────────────────────────────────────────────────
  if (!release.authorization_token_id) {
    return internalError(
      `Release ${releaseId} has no authorization_token_id — pre-Stage-B1 release row. ` +
      'Manual support intervention required to free the reservation.',
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: token, error: tokenError } = await (adminClient as any)
    .from('authorization_tokens')
    .select('id, jti, token_hash, status, expires_at, total_amount')
    .eq('id', release.authorization_token_id)
    .single()

  if (tokenError || !token) {
    return internalError(
      `Authorization token for release ${releaseId} could not be loaded.`,
      tokenError?.message,
    )
  }

  if (!['issued', 'delivered'].includes(token.status)) {
    return NextResponse.json(
      {
        error: `Authorization token is in status "${token.status}" — not eligible for expiry.`,
        code:  'TOKEN_NOT_ACTIVE',
      },
      { status: 409 },
    )
  }

  const now = new Date()
  const expiresAt = new Date(token.expires_at)
  if (expiresAt > now) {
    return NextResponse.json(
      {
        error:
          `Authorization token is not yet stale (expires_at=${token.expires_at}, now=${now.toISOString()}). ` +
          'Wait until expires_at has passed before calling expire-if-stale.',
        code: 'TOKEN_NOT_STALE',
        token_expires_at: token.expires_at,
      },
      { status: 409 },
    )
  }

  // ── Fetch deal + amounts (needed by cancel_release_reservation RPC) ──────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deal, error: dealError } = await (adminClient as any)
    .from('deals')
    .select('id, billing_rate_bps')
    .eq('id', release.deal_id)
    .single()

  if (dealError || !deal) {
    return internalError(
      `Deal ${release.deal_id} could not be loaded for reservation cancel.`,
      dealError?.message,
    )
  }

  // Recompute fee from milestone amount × billing_rate_bps. Same math the
  // milestone-release route used at reservation time. Reservation = gross + fee.
  const grossAmount = release.amount
  const feeAmount   = Math.max(50, Math.round(grossAmount * deal.billing_rate_bps / 10000 * 100) / 100)

  // ── Atomic state transitions ─────────────────────────────────────────────
  // Order matters: token first, release second, reservation cancel third.
  // If any step fails the audit row records exactly which one and the rest
  // can be replayed manually.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: tokenUpdateError } = await (adminClient as any)
    .from('authorization_tokens')
    .update({
      status:      'expired',
      expired_at:  now.toISOString(),
    })
    .eq('id', token.id)
    .in('status', ['issued', 'delivered'])

  if (tokenUpdateError) {
    await logAudit({
      entity_type: 'release',
      entity_id:   releaseId,
      action:      'release_expiry_token_update_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        deal_id:                release.deal_id,
        execution_rail:         'external_manual',
        authorization_token_id: token.id,
        error:                  tokenUpdateError.message,
      },
      partner_ack_hash: partnerAckHash,
    })
    return internalError('The authorization token could not be marked expired.', tokenUpdateError.message)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: releaseUpdateError } = await (adminClient as any)
    .from('releases')
    .update({
      execution_status: 'failed',
    })
    .eq('id', releaseId)
    .eq('execution_status', 'pending')

  if (releaseUpdateError) {
    await logAudit({
      entity_type: 'release',
      entity_id:   releaseId,
      action:      'release_expiry_release_update_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        deal_id:                release.deal_id,
        execution_rail:         'external_manual',
        authorization_token_id: token.id,
        error:                  releaseUpdateError.message,
        note:                   'token marked expired but release row update failed — needs reconciliation',
      },
      partner_ack_hash: partnerAckHash,
      token_hash:       token.token_hash,
    })
    return internalError(
      'The authorization token was marked expired but the release row could not be updated.',
      releaseUpdateError.message,
    )
  }

  // Cancel the funded-balance reservation. Idempotent at the RPC level (uses
  // GREATEST(0, ...) on the decrement).
  const { error: cancelError } = await supabase.rpc('cancel_release_reservation', {
    p_deal_id: release.deal_id,
    p_gross:   grossAmount,
    p_fee:     feeAmount,
  })

  if (cancelError) {
    await logAudit({
      entity_type: 'deal',
      entity_id:   release.deal_id,
      action:      'release_expiry_reservation_cancel_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        execution_rail:         'external_manual',
        release_id:             releaseId,
        authorization_token_id: token.id,
        gross_amount:           grossAmount,
        fee_amount:             feeAmount,
        error:                  cancelError.message,
        note:
          'token expired and release marked failed but reserved_amount has orphaned reservation; requires reconciliation',
      },
      partner_ack_hash: partnerAckHash,
      token_hash:       token.token_hash,
    })
    // Best-effort response — money has not moved (external rail never executed).
    return NextResponse.json(
      {
        success:           true,
        partial:           true,
        reservation_freed: false,
        reason:            cancelError.message,
      },
      { status: 200 },
    )
  }

  // ── Success audit ────────────────────────────────────────────────────────
  await logAudit({
    entity_type: 'release',
    entity_id:   releaseId,
    action:      'release_authorization_expired',
    actor_id:    user.id,
    old_values:  { execution_status: 'pending', token_status: token.status },
    new_values:  { execution_status: 'failed',  token_status: 'expired' },
    metadata: {
      deal_id:                release.deal_id,
      milestone_id:           release.milestone_id,
      execution_rail:         'external_manual',
      authorization_token_id: token.id,
      token_jti:              token.jti,
      gross_amount:           grossAmount,
      fee_amount:             feeAmount,
      reservation_cancelled:  true,
      reason,
    },
    partner_ack_hash: partnerAckHash,
    token_hash:       token.token_hash,
  })

  return NextResponse.json({
    success:           true,
    partial:           false,
    reservation_freed: true,
    release: {
      id:               releaseId,
      execution_status: 'failed',
    },
    authorization_token: {
      id:         token.id,
      jti:        token.jti,
      status:     'expired',
      expired_at: now.toISOString(),
    },
  })
}
