import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess, requireMFA } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { toStripeCents } from '@/lib/engine/billing'
import { stripe } from '@/lib/stripe'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'
import { notifyRetainageReleased } from '@/lib/engine/notify'

export const dynamic = 'force-dynamic'


// ─── POST /api/deals/[dealId]/retainage/release ────────────────────────────────
//
// Releases withheld retainage to the contractor's Stripe Connect account.
// Callable by funders only, on deals that have retainage_held > 0.
//
// Partial releases are permitted — the funder may release retainage incrementally.
// Common pattern: release full retainage at substantial completion (deal status
// transitions to 'completed'), or release partial retainage as punch-list items
// are closed out.
//
// Body: { amount: number, notes?: string }
//
// Safety guarantees:
//   1. MFA required (same as milestone release).
//   2. amount validated server-side: 0 < amount <= retainage_held.
//   3. increment_deal_retainage_released() uses SELECT FOR UPDATE to prevent
//      concurrent retainage releases from both passing the balance check.
//   4. If Stripe fails, NO database records are written.
//   5. All actions are audit-logged.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params

  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  // ── Role guard — funders only ────────────────────────────────────────────────
  if (profile.role !== 'funder' && profile.role !== 'admin') {
    return errorResponse(403, 'Only funders may release retainage.')
  }

  const supabase = await createClient()

  // ── MFA Guard ────────────────────────────────────────────────────────────────
  try {
    await requireMFA(supabase, profile)
  } catch (err) {
    return err as NextResponse
  }

  // ── Deal Access Check ────────────────────────────────────────────────────────
  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Fetch Deal ───────────────────────────────────────────────────────────────
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select(
      'id, title, contractor_id, funder_id, funded_amount, retainage_held, retainage_released, retainage_percentage, status',
    )
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return notFoundError(`Deal ${dealId} was not found.`)
  }

  // ── Parse + Validate Body ────────────────────────────────────────────────────
  let body: { amount?: unknown; notes?: unknown }

  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'The request body could not be parsed as JSON.')
  }

  const amount = typeof body.amount === 'number' ? body.amount : null

  if (amount === null || isNaN(amount)) {
    return errorResponse(400, 'amount is required and must be a number.')
  }
  if (amount <= 0) {
    return errorResponse(400, 'amount must be greater than $0.')
  }

  const notes = typeof body.notes === 'string' && body.notes.trim() !== ''
    ? body.notes.trim()
    : null

  // ── Business Rule Checks ─────────────────────────────────────────────────────
  const retainageHeld = deal.retainage_held ?? 0

  if (retainageHeld <= 0) {
    return errorResponse(
      422,
      'This deal has no withheld retainage to release. ' +
        'Retainage is accumulated as milestones are released on deals with retainage_percentage > 0.',
    )
  }

  if (deal.status === 'cancelled') {
    return errorResponse(422, 'Cannot release retainage on a cancelled deal.')
  }

  if (deal.status === 'disputed') {
    return errorResponse(
      422,
      'Retainage release is paused while this deal is under dispute. ' +
        'Resolve the dispute before releasing retainage.',
    )
  }

  const roundedAmount = Math.round(amount * 100) / 100
  if (roundedAmount > retainageHeld) {
    return errorResponse(
      422,
      `Requested retainage release of $${roundedAmount.toFixed(2)} exceeds the ` +
        `current held balance of $${retainageHeld.toFixed(2)}.`,
    )
  }

  // ── Fetch Contractor Stripe Account ──────────────────────────────────────────
  const { data: contractorProfile, error: contractorError } = await supabase
    .from('profiles')
    .select('stripe_account_id, full_name, company_name')
    .eq('id', deal.contractor_id)
    .single()

  if (contractorError || !contractorProfile?.stripe_account_id) {
    return internalError(
      'Could not retrieve the contractor\'s Stripe account ID. ' +
        'Ensure the contractor has completed Stripe Connect onboarding.',
      contractorError?.message,
    )
  }

  // ── Idempotency Key ───────────────────────────────────────────────────────────
  // Include a timestamp-based component because partial retainage releases are
  // allowed — multiple releases on the same deal are valid and should not be
  // collapsed by Stripe's idempotency into a single transfer.
  const idempotencyKey = `retainage_release_${dealId}_${Date.now()}`

  const amountInCents = toStripeCents(roundedAmount)

  // ── Stripe Transfer ───────────────────────────────────────────────────────────
  let stripeTransferId: string | null = null

  try {
    const transfer = await stripe.transfers.create(
      {
        amount:         amountInCents,
        currency:       'usd',
        destination:    contractorProfile.stripe_account_id,
        transfer_group: dealId,
        metadata: {
          deal_id:         dealId,
          contractor_id:   deal.contractor_id,
          vektrum_action:  'retainage_release',
          idempotency_key: idempotencyKey,
          released_by:     user.id,
          amount:          roundedAmount.toFixed(2),
        },
        description: `Vektrum retainage release — ${deal.title}`,
      },
      { idempotencyKey },
    )

    stripeTransferId = transfer.id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    await logAudit({
      entity_type: 'deal',
      entity_id:   dealId,
      action:      'retainage_release_stripe_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        amount:          roundedAmount,
        retainage_held:  retainageHeld,
        error:           message,
        idempotency_key: idempotencyKey,
      },
    })

    return internalError(
      'The Stripe transfer could not be completed. No retainage has been released. ' +
        'Please try again. If this problem persists, contact support.',
      message,
    )
  }

  // Stripe transfer succeeded. From this point, every DB failure is a partial
  // state that requires manual reconciliation (money has moved).

  // ── Insert retainage_releases record ─────────────────────────────────────────
  // Use admin client — same pattern as billing_records inserts.
  const adminClient = createSupabaseAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: releaseRecord, error: releaseInsertError } = await (adminClient as any)
    .from('retainage_releases')
    .insert({
      deal_id:            dealId,
      amount:             roundedAmount,
      stripe_transfer_id: stripeTransferId,
      idempotency_key:    idempotencyKey,
      released_by:        user.id,
      notes,
    })
    .select('id')
    .single()

  if (releaseInsertError) {
    await logAudit({
      entity_type: 'deal',
      entity_id:   dealId,
      action:      'retainage_release_record_insert_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        stripe_transfer_id: stripeTransferId,
        idempotency_key:    idempotencyKey,
        amount:             roundedAmount,
        error:              releaseInsertError.message,
      },
    })

    return internalError(
      'A Stripe transfer was completed but the retainage release record could not be saved. ' +
        `CRITICAL: Contact support immediately with Stripe Transfer ID: ${stripeTransferId}, ` +
        `Deal ID: ${dealId}, amount: $${roundedAmount.toFixed(2)}.`,
      releaseInsertError.message,
    )
  }

  // ── Update deal retainage balances (atomic RPC) ───────────────────────────────
  const { error: retainageUpdateError } = await supabase.rpc(
    'increment_deal_retainage_released',
    {
      p_deal_id: dealId,
      p_amount:  roundedAmount,
    },
  )

  if (retainageUpdateError) {
    await logAudit({
      entity_type: 'deal',
      entity_id:   dealId,
      action:      'retainage_release_ledger_update_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        stripe_transfer_id: stripeTransferId,
        idempotency_key:    idempotencyKey,
        amount:             roundedAmount,
        retainage_held:     retainageHeld,
        error:              retainageUpdateError.message,
      },
    })

    return internalError(
      'Retainage transfer completed but the deal ledger (retainage_held / retainage_released) ' +
        'could not be updated. This requires manual reconciliation. ' +
        `Contact support with Stripe Transfer ID: ${stripeTransferId}, ` +
        `Deal ID: ${dealId}, amount: $${roundedAmount.toFixed(2)}.`,
      retainageUpdateError.message,
    )
  }

  // ── Audit Log (success) ───────────────────────────────────────────────────────
  await logAudit({
    entity_type: 'deal',
    entity_id:   dealId,
    action:      'retainage_released',
    actor_id:    user.id,
    old_values: {
      retainage_held:     retainageHeld,
      retainage_released: deal.retainage_released ?? 0,
    },
    new_values: {
      retainage_held:     retainageHeld - roundedAmount,
      retainage_released: (deal.retainage_released ?? 0) + roundedAmount,
    },
    metadata: {
      stripe_transfer_id: stripeTransferId,
      idempotency_key:    idempotencyKey,
      amount:             roundedAmount,
      amount_in_cents:    amountInCents,
      notes,
      released_by_role:   profile.role,
      contractor_id:      deal.contractor_id,
    },
  })

  // Fire-and-forget — notify contractor of retainage release
  void notifyRetainageReleased({
    retainageReleaseId: releaseRecord.id,
    dealId:             dealId,
    funderId:           user.id,
    amount:             roundedAmount,
  })

  return NextResponse.json(
    {
      success: true,
      retainage_release: {
        id:                 releaseRecord.id,
        deal_id:            dealId,
        amount:             roundedAmount,
        stripe_transfer_id: stripeTransferId,
        idempotency_key:    idempotencyKey,
        notes,
        retainage_remaining: retainageHeld - roundedAmount,
      },
    },
    { status: 201 },
  )
}
