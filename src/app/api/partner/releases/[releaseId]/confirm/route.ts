import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requirePartnerAuth } from '@/lib/auth/partner'
import { logAudit } from '@/lib/engine/audit'
import { calculateFee, calculateRetainage } from '@/lib/engine/billing'
import { internalError, notFoundError, validationError } from '@/lib/errors'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'

// ─── POST /api/partner/releases/[releaseId]/confirm ───────────────────────────
//
// Partner-authenticated endpoint. Called by an institutional execution-rail
// partner (escrow company, construction loan servicer, title company) to record
// that they have executed the authorised payment and provide evidence.
//
// This is the machine-to-machine equivalent of the user-facing
// POST /api/releases/[releaseId]/confirm-external endpoint. It accepts the
// same body shape and performs identical ledger settlement — the only
// difference is authentication: API key (partner) vs. session cookie (funder).
//
// Authentication: Authorization: Bearer <partner_api_key>
//
// Authorization: the partner must be the partner_id associated with the deal
// that owns this release. A partner cannot confirm releases for deals that
// belong to other partners.
//
// Request body:
//   {
//     payment_method:    'wire'|'ach'|'check'|'other'   (required)
//     payment_reference: string                          (required)
//     executed_at?:      ISO-8601 string                 (defaults to now)
//     notes?:            string
//     proof_document_id?: uuid
//   }
//
// Idempotency: already-confirmed releases return 200 with alreadyConfirmed: true.

const VALID_METHODS = ['wire', 'ach', 'check', 'other'] as const
type ExternalPaymentMethod = (typeof VALID_METHODS)[number]

interface PartnerConfirmBody {
  payment_method?:    string
  payment_reference?: string
  executed_at?:       string
  notes?:             string
  proof_document_id?: string
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

  // ── Read raw body (for ack hash) and parse ─────────────────────────────────
  // Read the exact bytes of the partner ack payload first so we can compute a
  // deterministic SHA-256 of what arrived over the wire. Threaded into every
  // audit event below via partner_ack_hash so the chain commits to the exact
  // partner acknowledgement bytes (Tier A — patent candidate #4).
  let rawBody: Buffer
  try {
    rawBody = Buffer.from(await request.arrayBuffer())
  } catch {
    return validationError(['Request body could not be read.'])
  }
  const partnerAckHash = createHash('sha256').update(rawBody).digest('hex')

  let body: PartnerConfirmBody
  try {
    body = JSON.parse(rawBody.toString('utf-8')) as PartnerConfirmBody
  } catch {
    return validationError(['Request body must be valid JSON.'])
  }

  const method    = typeof body.payment_method    === 'string' ? body.payment_method.trim().toLowerCase()    : ''
  const reference = typeof body.payment_reference === 'string' ? body.payment_reference.trim()               : ''
  const notes     = typeof body.notes             === 'string' ? body.notes.trim()                           : null
  const proofDocumentId = typeof body.proof_document_id === 'string' && body.proof_document_id.trim()
    ? body.proof_document_id.trim()
    : null

  const validationErrors: string[] = []
  if (!method) {
    validationErrors.push('payment_method is required (wire | ach | check | other).')
  } else if (!VALID_METHODS.includes(method as ExternalPaymentMethod)) {
    validationErrors.push(
      `payment_method must be one of: ${VALID_METHODS.join(', ')}. Received: '${method}'.`,
    )
  }
  if (!reference) {
    validationErrors.push(
      'payment_reference is required. Provide the bank reference, check number, or transfer ID.',
    )
  } else if (reference.length > 512) {
    validationErrors.push('payment_reference is too long (max 512 characters).')
  }

  let executedAtIso: string
  if (body.executed_at && typeof body.executed_at === 'string') {
    const parsed = new Date(body.executed_at)
    if (Number.isNaN(parsed.getTime())) {
      validationErrors.push('executed_at must be a valid ISO-8601 timestamp.')
      executedAtIso = new Date().toISOString()
    } else {
      const now        = Date.now()
      const tsMs       = parsed.getTime()
      const ninetyDays = 90 * 24 * 3_600_000
      if (tsMs > now + 60_000)           validationErrors.push('executed_at cannot be in the future.')
      else if (tsMs < now - ninetyDays)  validationErrors.push('executed_at cannot be more than 90 days in the past.')
      executedAtIso = parsed.toISOString()
    }
  } else {
    executedAtIso = new Date().toISOString()
  }

  if (validationErrors.length > 0) return validationError(validationErrors)

  const admin = createSupabaseAdminClient()

  // ── Fetch release ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: release, error: releaseError } = await (admin as any)
    .from('releases')
    .select(
      'id, milestone_id, deal_id, amount, execution_rail, execution_status, authorization_token_id',
    )
    .eq('id', releaseId)
    .single()

  if (releaseError || !release) {
    return notFoundError(`Release ${releaseId} was not found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = release as any

  if (r.execution_rail !== 'external_manual') {
    return validationError([
      `Only external-rail releases can be confirmed via the partner API. execution_rail is '${r.execution_rail}'.`,
    ])
  }

  // ── Fetch deal — verify this partner owns it ───────────────────────────────
  const { data: deal, error: dealError } = await admin
    .from('deals')
    .select('id, title, contractor_id, funder_id, billing_rate_bps, retainage_percentage, partner_id')
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
          'Partners can only confirm releases for their own deals.',
      },
      { status: 403 },
    )
  }

  if (!d.funder_id) {
    return internalError('This deal has no funder assigned. Confirmation cannot proceed.')
  }

  // ── Fetch milestone ────────────────────────────────────────────────────────
  const { data: milestone, error: milestoneError } = await admin
    .from('milestones')
    .select('id, title, amount')
    .eq('id', r.milestone_id)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(`The milestone for release ${releaseId} could not be found.`)
  }

  // ── Proof document sanity check ────────────────────────────────────────────
  if (proofDocumentId) {
    const { data: doc, error: docError } = await admin
      .from('milestone_documents')
      .select('id, milestone_id')
      .eq('id', proofDocumentId)
      .maybeSingle()

    if (docError || !doc) {
      return validationError(['proof_document_id does not reference a valid milestone document.'])
    }
    if (doc.milestone_id !== r.milestone_id) {
      return validationError(['proof_document_id belongs to a different milestone than this release.'])
    }
  }

  // ── Derive fee + retainage ─────────────────────────────────────────────────
  const fee       = calculateFee(r.amount, d.billing_rate_bps)
  const retainage = calculateRetainage(r.amount, d.retainage_percentage ?? 0)
  const netToContractor = retainage.netToContractor

  // ── STEP 1: Atomic state transition via DB-level SELECT FOR UPDATE ─────────
  //
  // partner_confirm_release_atomic acquires a row lock on the release before
  // reading or writing execution_status. This eliminates the TOCTOU race
  // between a JavaScript-level status check and the conditional UPDATE:
  //
  //   - Two concurrent confirms that both read 'pending' before either writes
  //     are now serialised at the lock. The winner transitions to 'confirmed';
  //     the loser reads the winner's committed state and returns 'already_confirmed'
  //     (same reference) or 'conflict' (different reference).
  //
  //   - A concurrent fail that races with this confirm is similarly serialised.
  //     If the fail wins first, this call reads 'failed' and returns 'wrong_status'.
  //
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcResult, error: rpcError } = await (admin as any).rpc(
    'partner_confirm_release_atomic',
    {
      p_release_id:        r.id,
      p_payment_method:    method,
      p_payment_reference: reference,
      p_executed_at:       executedAtIso,
      p_executed_by:       d.funder_id,   // attribute to funder-of-record
      p_notes:             notes,
      p_proof_doc_id:      proofDocumentId,
    },
  )

  if (rpcError) {
    await logAudit({
      entity_type: 'release',
      entity_id:   r.id,
      action:      'partner_confirm_update_failed',
      actor_id:    null,
      metadata: {
        partner_id:     partnerCtx.partnerId,
        partner_name:   partnerCtx.partnerName,
        execution_rail: 'external_manual',
        deal_id:        r.deal_id,
        error:          rpcError.message,
      },
      partner_ack_hash: partnerAckHash,
    })
    return internalError('The release could not be marked confirmed. Please try again.', rpcError.message)
  }

  // RPC returns a single-row TABLE result — Supabase JS wraps it as an array.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpcRow    = (Array.isArray(rpcResult) ? rpcResult[0] : rpcResult) as any
  const outcome   = rpcRow?.outcome as string | undefined

  // ── Handle: idempotent confirm (same payment_reference) ────────────────────
  if (outcome === 'already_confirmed') {
    await logAudit({
      entity_type:   'release',
      entity_id:     r.id,
      action:        'partner_release_confirm_idempotent',
      actor_id:      null,
      system_source: 'api/partner/releases/confirm',
      metadata: {
        partner_id:                 partnerCtx.partnerId,
        partner_name:               partnerCtx.partnerName,
        deal_id:                    r.deal_id,
        payment_reference_matched:  true,
        note: 'Repeated confirm with matching payment_reference — no state change.',
      },
      partner_ack_hash: partnerAckHash,
    })
    return NextResponse.json(
      {
        success:                    true,
        releaseId:                  r.id,
        alreadyConfirmed:           true,
        execution_status:           'confirmed',
        external_payment_reference: rpcRow.current_payment_reference ?? reference,
        external_executed_at:       rpcRow.current_executed_at       ?? executedAtIso,
        note: 'This release has already been confirmed with a matching payment reference.',
      },
      { status: 200 },
    )
  }

  // ── Handle: conflicting confirm (different payment_reference) ───────────────
  if (outcome === 'conflict') {
    await logAudit({
      entity_type:   'release',
      entity_id:     r.id,
      action:        'partner_release_confirm_conflict',
      actor_id:      null,
      system_source: 'api/partner/releases/confirm',
      metadata: {
        partner_id:                    partnerCtx.partnerId,
        partner_name:                  partnerCtx.partnerName,
        deal_id:                       r.deal_id,
        attempted_payment_reference:   reference,
        existing_payment_reference:    rpcRow.current_payment_reference,
        note: 'Conflicting confirm attempt: release already confirmed with a different payment reference.',
      },
      partner_ack_hash: partnerAckHash,
    })
    return NextResponse.json(
      {
        error:
          'This release was already confirmed with a different payment reference. ' +
          'Conflicting confirmation rejected. Contact Vektrum support if this is unexpected.',
        code:            'EXECUTION_CONFLICT',
        current_status:  'confirmed',
      },
      { status: 409 },
    )
  }

  // ── Handle: wrong status (failed, reversed, etc.) ───────────────────────────
  if (outcome === 'wrong_status') {
    return validationError([
      `Only 'pending' external releases can be confirmed. Current status: '${rpcRow.current_execution_status}'.`,
    ])
  }

  // ── Handle: not found (defensive — route pre-validates existence above) ─────
  if (outcome !== 'confirmed') {
    return notFoundError(`Release ${releaseId} was not found or could not be confirmed.`)
  }

  // ── outcome === 'confirmed': release successfully transitioned ──────────────

  // ── STEP 2: Insert billing record ──────────────────────────────────────────
  // From here, failures are logged but do NOT revert the confirmation.
  const { error: billingError } = await admin
    .from('billing_records')
    .insert({
      deal_id:            r.deal_id,
      milestone_id:       r.milestone_id,
      release_id:         r.id,
      funder_id:          d.funder_id,
      gross_amount:       fee.grossAmount,
      billing_rate_bps:   fee.billingRateBps,
      fee_amount:         fee.feeAmount,
      net_amount:         netToContractor,
      retainage_amount:   retainage.retainageAmount,
      stripe_transfer_id: null,
      billing_source:     'governance_layer',
    })

  if (billingError) {
    await logAudit({
      entity_type: 'billing_record',
      entity_id:   r.id,
      action:      'partner_confirm_billing_failed',
      actor_id:    null,
      metadata: {
        partner_id:   partnerCtx.partnerId,
        error:        billingError.message,
        release_id:   r.id,
        note:         'Release confirmed but billing_records insert failed — requires reconciliation.',
      },
      partner_ack_hash: partnerAckHash,
    })
  }

  // ── STEP 3: Increment deal financials ──────────────────────────────────────
  const { error: ledgerError } = await admin.rpc('increment_deal_financials', {
    p_deal_id:         r.deal_id,
    p_released_amount: netToContractor,
    p_fee_amount:      fee.feeAmount,
  })

  if (ledgerError) {
    await logAudit({
      entity_type: 'deal',
      entity_id:   r.deal_id,
      action:      'partner_confirm_ledger_failed',
      actor_id:    null,
      metadata: {
        partner_id: partnerCtx.partnerId,
        release_id: r.id,
        error:      ledgerError.message,
        note:       'Release confirmed but ledger increment failed — requires reconciliation.',
      },
      partner_ack_hash: partnerAckHash,
    })
  }

  // ── STEP 4: Increment retainage ────────────────────────────────────────────
  if (retainage.retainageAmount > 0) {
    const { error: retainageError } = await admin.rpc('increment_deal_retainage', {
      p_deal_id:   r.deal_id,
      p_retainage: retainage.retainageAmount,
    })
    if (retainageError) {
      await logAudit({
        entity_type: 'deal',
        entity_id:   r.deal_id,
        action:      'partner_confirm_retainage_failed',
        actor_id:    null,
        metadata: {
          partner_id: partnerCtx.partnerId,
          release_id: r.id,
          error:      retainageError.message,
        },
        partner_ack_hash: partnerAckHash,
      })
    }
  }

  // ── Look up the authorization token to bind into the audit chain (B3.2) ───
  // Same pattern as /confirm-external. Token status flips 'delivered'/'issued'
  // → 'confirmed' on settlement.
  let tokenHashForAudit: string | null = null
  let tokenJtiForAudit:  string | null = null
  if (r.authorization_token_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tokenRow } = await (admin as any)
      .from('authorization_tokens')
      .select('id, jti, token_hash, status')
      .eq('id', r.authorization_token_id)
      .maybeSingle()
    if (tokenRow) {
      tokenHashForAudit = tokenRow.token_hash
      tokenJtiForAudit  = tokenRow.jti
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: tokenStatusErr } = await (admin as any)
        .from('authorization_tokens')
        .update({
          status:       'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', tokenRow.id)
        .in('status', ['issued', 'delivered'])
      if (tokenStatusErr) {
        console.error(
          '[partner-confirm] authorization_token confirm-status update failed (non-fatal):',
          tokenStatusErr.message,
        )
      }
    }
  }

  // ── STEP 5: Audit log ──────────────────────────────────────────────────────
  await logAudit({
    entity_type:   'release',
    entity_id:     r.id,
    action:        'partner_release_confirmed',
    actor_id:      null,
    system_source: 'api/partner/releases/confirm',
    old_values:    { execution_status: 'pending' },
    new_values: {
      execution_status:             'confirmed',
      external_payment_method:      method,
      external_payment_reference:   reference,
      external_executed_at:         executedAtIso,
      proof_of_payment_document_id: proofDocumentId,
    },
    metadata: {
      partner_id:             partnerCtx.partnerId,
      partner_name:           partnerCtx.partnerName,
      deal_id:                r.deal_id,
      milestone_id:           r.milestone_id,
      contractor_id:          d.contractor_id,
      funder_id:              d.funder_id,
      gross_amount:           fee.grossAmount,
      fee_amount:             fee.feeAmount,
      retainage_amount:       retainage.retainageAmount,
      net_to_contractor:      netToContractor,
      billing_rate_bps:       fee.billingRateBps,
      total_debit:            fee.totalDebit,
      execution_rail:         'external_manual',
      billing_committed:      !billingError,
      ledger_updated:         !ledgerError,
      proof_attached:         !!proofDocumentId,
      authorization_token_id: r.authorization_token_id ?? null,
      token_jti:              tokenJtiForAudit,
    },
    partner_ack_hash: partnerAckHash,
    token_hash:       tokenHashForAudit,
  })

  return NextResponse.json({
    success:          true,
    releaseId:        r.id,
    execution_status: 'confirmed',
    execution_rail:   'external_manual',
    confirmed_by:     'partner',
    partner_id:       partnerCtx.partnerId,
    external: {
      payment_method:    method,
      payment_reference: reference,
      executed_at:       executedAtIso,
      notes,
      proof_document_id: proofDocumentId,
    },
    billing: {
      gross_amount:         fee.grossAmount,
      fee_amount:           fee.feeAmount,
      retainage_amount:     retainage.retainageAmount,
      net_to_contractor:    netToContractor,
      billing_rate_bps:     fee.billingRateBps,
      total_debit:          fee.totalDebit,
      committed:            !billingError,
    },
    ledger_updated: !ledgerError,
    warnings: [
      ...(billingError  ? ['billing_record insert failed — flagged for reconciliation'] : []),
      ...(ledgerError   ? ['deal financials increment failed — flagged for reconciliation'] : []),
    ],
  })
}
