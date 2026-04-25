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
import { calculateFee, calculateRetainage } from '@/lib/engine/billing'
import { internalError, notFoundError, validationError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── POST /api/releases/[releaseId]/confirm-external ─────────────────────────
//
// PHASE-1 RAIL-ABSTRACTION ENDPOINT — External/manual confirmation.
//
// Records that the funder (or their partner treasury) has executed the
// authorised payment OUTSIDE Vektrum and provides evidence. This is the moment
// at which:
//
//   ✅ The release's execution_status transitions pending → confirmed.
//   ✅ A billing_records row is inserted — this preserves the invariant
//      "billing = verified disbursement" (never billed before execution).
//   ✅ The deal's released_amount / fees_collected are incremented via
//      increment_deal_financials, settling the reservation.
//   ✅ The deal's retainage_held is incremented via increment_deal_retainage,
//      completing the reservation conversion (no-op when retainage = 0).
//   ✅ The audit trail captures: method, reference, timestamp, actor, notes,
//      and (optionally) a proof-of-payment document id.
//
// Caller:
//   - Funder of the deal (MFA required), OR
//   - Admin (MFA required + admin_justification ≥ 20 chars; dual-writes to
//     admin_audit_log).
//
// Request body:
//   {
//     payment_method:    'wire'|'ach'|'check'|'other'   (required)
//     payment_reference: string                          (required)
//     executed_at?:      ISO-8601 string                 (defaults to now)
//     notes?:            string
//     proof_document_id?: uuid                           (milestone_documents FK)
//   }
//
// Idempotency: a release already at execution_status='confirmed' returns 409
// rather than re-writing the billing row or re-incrementing the ledger.

const VALID_METHODS = ['wire', 'ach', 'check', 'other'] as const
type ExternalPaymentMethod = (typeof VALID_METHODS)[number]

interface ConfirmExternalBody {
  payment_method?:     string
  payment_reference?:  string
  executed_at?:        string
  notes?:              string
  proof_document_id?:  string
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

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: ConfirmExternalBody
  try {
    body = (await request.json()) as ConfirmExternalBody
  } catch {
    return validationError(['Request body must be valid JSON.'])
  }

  const method    = typeof body.payment_method    === 'string' ? body.payment_method.trim().toLowerCase() : ''
  const reference = typeof body.payment_reference === 'string' ? body.payment_reference.trim() : ''
  const notes     = typeof body.notes             === 'string' ? body.notes.trim() : null
  const proofDocumentId = typeof body.proof_document_id === 'string' && body.proof_document_id.trim().length > 0
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
      'payment_reference is required. Provide the bank reference, check number, or partner transfer ID used to execute payment.',
    )
  } else if (reference.length > 512) {
    validationErrors.push('payment_reference is too long (max 512 characters).')
  }

  // executed_at: allow override so operators can record when the bank
  // actually executed, but clamp to "not in the future, not more than 90 days old".
  let executedAtIso: string
  if (body.executed_at && typeof body.executed_at === 'string') {
    const parsed = new Date(body.executed_at)
    if (Number.isNaN(parsed.getTime())) {
      validationErrors.push('executed_at must be a valid ISO-8601 timestamp.')
      executedAtIso = new Date().toISOString()
    } else {
      const now = Date.now()
      const tsMs = parsed.getTime()
      const ninetyDays = 90 * 24 * 3_600_000
      if (tsMs > now + 60_000) {
        validationErrors.push('executed_at cannot be in the future.')
      } else if (tsMs < now - ninetyDays) {
        validationErrors.push('executed_at cannot be more than 90 days in the past.')
      }
      executedAtIso = parsed.toISOString()
    }
  } else {
    executedAtIso = new Date().toISOString()
  }

  if (validationErrors.length > 0) {
    return validationError(validationErrors)
  }

  // ── Fetch release ──────────────────────────────────────────────────────────
  // Use admin client so we can read regardless of user RLS policy nuances for
  // the new columns. The caller role is re-verified via requireDealAccess below.
  const adminClient = createSupabaseAdminClient()

  const { data: release, error: releaseError } = await adminClient
    .from('releases')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select(
      'id, milestone_id, deal_id, amount, stripe_transfer_id, released_by, execution_rail, execution_status, external_payment_reference, external_executed_at, external_executed_by' as any,
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
      'This release is executed on the Stripe Connect rail and cannot be confirmed as external. ' +
        `execution_rail is '${r.execution_rail}'.`,
    ])
  }

  if (r.execution_status === 'confirmed') {
    // Idempotent short-circuit: already confirmed. Do not re-write billing.
    return NextResponse.json(
      {
        success: true,
        releaseId: r.id,
        alreadyConfirmed: true,
        execution_status: 'confirmed',
        external_payment_reference: r.external_payment_reference,
        external_executed_at:       r.external_executed_at,
        external_executed_by:       r.external_executed_by,
        note:
          'This external release has already been confirmed. No further action was taken.',
      },
      { status: 200 },
    )
  }

  if (r.execution_status !== 'pending') {
    return validationError([
      `Only 'pending' external releases can be confirmed. Current execution_status: '${r.execution_status}'.`,
    ])
  }

  // ── Fetch deal + milestone (for billing, ledger math, audit) ───────────────
  const { data: deal, error: dealError } = await adminClient
    .from('deals')
    .select(
      'id, title, contractor_id, funder_id, billing_rate_bps, retainage_percentage',
    )
    .eq('id', r.deal_id)
    .single()

  if (dealError || !deal) {
    return notFoundError(
      `The deal for release ${releaseId} could not be found.`,
    )
  }

  if (!deal.funder_id) {
    return internalError(
      'This deal has no funder assigned. Confirmation cannot proceed without a funder-of-record.',
    )
  }

  const { data: milestone, error: milestoneError } = await adminClient
    .from('milestones')
    .select('id, title, amount, status, protection_status')
    .eq('id', r.milestone_id)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(
      `The milestone for release ${releaseId} could not be found.`,
    )
  }

  // ── Caller authorisation ───────────────────────────────────────────────────
  // Funder of the deal OR admin. Contractors cannot confirm their own payment.
  const isAdmin = profile.role === 'admin'
  const isFunder = profile.role === 'funder'

  if (!isAdmin && !isFunder) {
    return NextResponse.json(
      {
        error:
          'Only the deal funder or an admin can confirm external execution. ' +
          `Your account is registered as a '${profile.role}'.`,
      },
      { status: 403 },
    )
  }

  if (isFunder) {
    // Ensure this funder owns the deal (admins skip — admins can confirm any
    // deal with a documented justification, dual-logged to admin_audit_log).
    try {
      await requireDealAccess(supabase, r.deal_id, user.id, profile.role)
    } catch (err) {
      return err as NextResponse
    }
    if (deal.funder_id !== user.id) {
      return NextResponse.json(
        {
          error: 'Only the deal funder can confirm external payment execution.',
        },
        { status: 403 },
      )
    }
  }

  // If admin, require justification AND proof document BEFORE any writes.
  // Admins confirming payment on behalf of the funder must attach evidence —
  // there is no implicit trust that the admin personally executed the transfer.
  let adminJustification: string | null = null
  if (isAdmin) {
    if (!proofDocumentId) {
      return validationError([
        'Admin confirmations require a proof_document_id. ' +
        'Attach a signed wire confirmation, check image, or bank statement to the milestone ' +
        'and supply its document id before recording admin-confirmed external payment.',
      ])
    }
    try {
      adminJustification = extractAdminJustification(request, body as unknown as Record<string, unknown>)
    } catch (err) {
      return err as NextResponse
    }
  }

  // ── Proof document sanity check (if supplied) ──────────────────────────────
  // Best-effort: confirm the doc belongs to this milestone. A mismatch is
  // treated as a validation error — attaching unrelated proof is a red flag.
  if (proofDocumentId) {
    const { data: doc, error: docError } = await adminClient
      .from('milestone_documents')
      .select('id, milestone_id')
      .eq('id', proofDocumentId)
      .maybeSingle()

    if (docError || !doc) {
      return validationError([
        'proof_document_id does not reference a valid milestone document.',
      ])
    }
    if (doc.milestone_id !== r.milestone_id) {
      return validationError([
        'proof_document_id belongs to a different milestone than this release.',
      ])
    }
  }

  // ── Derive fee + retainage (identical math to authorize-external) ──────────
  // Read authoritative values off the deal and release so confirmation cannot
  // disagree with authorisation.
  const fee       = calculateFee(r.amount, deal.billing_rate_bps)
  const retainage = calculateRetainage(r.amount, deal.retainage_percentage ?? 0)
  const netToContractor = retainage.netToContractor

  // ── STEP 1: Update release row to confirmed ───────────────────────────────
  // Conditional update on execution_status='pending' gives us atomic
  // idempotency against concurrent confirmation attempts. If 0 rows returned,
  // another request beat us to it — abort without re-writing billing/ledger.
  const { data: confirmedRows, error: confirmError } = await (adminClient as unknown as {
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
      execution_status:              'confirmed',
      external_payment_method:       method,
      external_payment_reference:    reference,
      external_executed_at:          executedAtIso,
      external_executed_by:          user.id,
      external_execution_notes:      notes,
      proof_of_payment_document_id:  proofDocumentId,
    })
    .eq('id', r.id)
    .eq('execution_status', 'pending')
    .select('id')

  if (confirmError) {
    await logAudit({
      entity_type: 'release',
      entity_id:   r.id,
      action:      'external_release_confirm_update_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        error:           confirmError.message,
        execution_rail:  'external_manual',
        deal_id:         r.deal_id,
        milestone_id:    r.milestone_id,
      },
    })
    return internalError(
      'The release could not be marked as confirmed. Please try again.',
      confirmError.message,
    )
  }

  if (!confirmedRows || confirmedRows.length === 0) {
    return NextResponse.json(
      {
        error:
          'This release was confirmed by a concurrent request. No duplicate confirmation was recorded.',
      },
      { status: 409 },
    )
  }

  // ── STEP 2: Insert billing record ──────────────────────────────────────────
  // From this point forward, failures are logged for reconciliation but do
  // NOT revert the release confirmation — the funder has asserted funds moved
  // externally and Vektrum's job is to record that truthfully. A failed
  // billing insert surfaces in the admin ops dashboard.
  const { error: billingInsertError } = await adminClient
    .from('billing_records')
    .insert({
      deal_id:            r.deal_id,
      milestone_id:       r.milestone_id,
      release_id:         r.id,
      funder_id:          deal.funder_id,
      gross_amount:       fee.grossAmount,
      billing_rate_bps:   fee.billingRateBps,
      fee_amount:         fee.feeAmount,
      net_amount:         netToContractor,
      retainage_amount:   retainage.retainageAmount,
      stripe_transfer_id: null,              // External rail — no Stripe transfer id
      billing_source:     'governance_layer',
    })

  if (billingInsertError) {
    await logAudit({
      entity_type: 'billing_record',
      entity_id:   r.id,
      action:      'external_billing_record_insert_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        execution_rail:     'external_manual',
        deal_id:            r.deal_id,
        milestone_id:       r.milestone_id,
        gross_amount:       fee.grossAmount,
        fee_amount:         fee.feeAmount,
        billing_rate_bps:   fee.billingRateBps,
        error:              billingInsertError.message,
        note:
          'Release is confirmed but billing_records insert failed — requires reconciliation.',
      },
    })
    // Intentionally do NOT return early. Confirmation is already persisted;
    // the ledger must be updated to remain consistent with the release state.
  }

  // ── STEP 3: Increment deal financials (settle reservation) ────────────────
  const { error: dealUpdateError } = await supabase.rpc(
    'increment_deal_financials',
    {
      p_deal_id:         r.deal_id,
      p_released_amount: netToContractor,
      p_fee_amount:      fee.feeAmount,
    },
  )

  if (dealUpdateError) {
    await logAudit({
      entity_type: 'deal',
      entity_id:   r.deal_id,
      action:      'external_release_deal_financials_update_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values: {
        released_amount_increment: netToContractor,
        fee_amount_increment:      fee.feeAmount,
        retainage_amount:          retainage.retainageAmount,
      },
      metadata: {
        execution_rail:  'external_manual',
        release_id:      r.id,
        error:           dealUpdateError.message,
        note:
          'Release confirmed but deal financials increment failed — requires reconciliation.',
      },
    })
  }

  // ── STEP 4: Increment retainage (if any) ───────────────────────────────────
  if (retainage.retainageAmount > 0) {
    const { error: retainageUpdateError } = await supabase.rpc(
      'increment_deal_retainage',
      {
        p_deal_id:   r.deal_id,
        p_retainage: retainage.retainageAmount,
      },
    )

    if (retainageUpdateError) {
      await logAudit({
        entity_type: 'deal',
        entity_id:   r.deal_id,
        action:      'external_release_retainage_increment_failed',
        actor_id:    user.id,
        old_values:  null,
        new_values:  { retainage_amount: retainage.retainageAmount },
        metadata: {
          execution_rail:  'external_manual',
          release_id:      r.id,
          error:           retainageUpdateError.message,
          note:
            'Release confirmed but retainage increment failed — reserved_amount has orphaned retainage; requires reconciliation.',
        },
      })
    }
  }

  // ── STEP 5: Audit log (success) ────────────────────────────────────────────
  await logAudit({
    entity_type: 'release',
    entity_id:   r.id,
    action:      'external_release_confirmed',
    actor_id:    user.id,
    old_values: {
      execution_status: 'pending',
    },
    new_values: {
      execution_status:             'confirmed',
      external_payment_method:      method,
      external_payment_reference:   reference,
      external_executed_at:         executedAtIso,
      external_executed_by:         user.id,
      external_execution_notes:     notes,
      proof_of_payment_document_id: proofDocumentId,
    },
    metadata: {
      deal_id:              r.deal_id,
      milestone_id:         r.milestone_id,
      contractor_id:        deal.contractor_id,
      funder_id:            deal.funder_id,
      gross_amount:         fee.grossAmount,
      fee_amount:           fee.feeAmount,
      retainage_amount:     retainage.retainageAmount,
      retainage_percentage: retainage.retainagePercentage,
      net_to_contractor:    netToContractor,
      billing_rate_bps:     fee.billingRateBps,
      total_debit:          fee.totalDebit,
      execution_rail:       'external_manual',
      confirmed_by_role:    profile.role,
      billing_committed:    !billingInsertError,
      ledger_updated:       !dealUpdateError,
      proof_attached:       !!proofDocumentId,
      admin_override:       isAdmin,
    },
  })

  // ── STEP 5b: Admin dual-write (if admin confirmed) ─────────────────────────
  if (isAdmin && adminJustification) {
    await requireAdminAudit(
      profile,
      { id: user.id, email: user.email ?? '' },
      adminJustification,
      {
        action:       'external_release_confirmed_by_admin',
        entityType:   'release',
        entityId:     r.id,
        systemSource: 'api/releases/[releaseId]/confirm-external',
        oldValues:    { execution_status: 'pending' },
        newValues: {
          execution_status:             'confirmed',
          external_payment_method:      method,
          external_payment_reference:   reference,
          external_executed_at:         executedAtIso,
          external_executed_by:         user.id,
          proof_of_payment_document_id: proofDocumentId,
        },
        metadata: {
          deal_id:              r.deal_id,
          milestone_id:         r.milestone_id,
          gross_amount:         fee.grossAmount,
          fee_amount:           fee.feeAmount,
          net_to_contractor:    netToContractor,
          retainage_amount:     retainage.retainageAmount,
          execution_rail:       'external_manual',
          actual_funder_id:     deal.funder_id,
          note:
            'Admin recorded external-payment confirmation on behalf of funder. Funder notification should follow out of band.',
        },
      },
    )
  }

  return NextResponse.json({
    success: true,
    releaseId: r.id,
    execution_status: 'confirmed',
    execution_rail:   'external_manual',
    external: {
      payment_method:    method,
      payment_reference: reference,
      executed_at:       executedAtIso,
      executed_by:       user.id,
      notes,
      proof_document_id: proofDocumentId,
    },
    billing: {
      gross_amount:         fee.grossAmount,
      fee_amount:           fee.feeAmount,
      retainage_amount:     retainage.retainageAmount,
      retainage_percentage: retainage.retainagePercentage,
      net_to_contractor:    netToContractor,
      billing_rate_bps:     fee.billingRateBps,
      rate_label:           fee.rateLabel,
      total_debit:          fee.totalDebit,
      committed:            !billingInsertError,
    },
    ledger_updated: !dealUpdateError,
    warnings: [
      ...(billingInsertError ? ['billing_record insert failed — flagged for reconciliation'] : []),
      ...(dealUpdateError ? ['deal financials increment failed — flagged for reconciliation'] : []),
    ],
  })
}
