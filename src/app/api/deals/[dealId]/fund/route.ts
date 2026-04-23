import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { stripe } from '@/lib/stripe'
import { errorResponse, internalError, notFoundError, validationError } from '@/lib/errors'

export const dynamic = 'force-dynamic'



// ─── POST /api/deals/[dealId]/fund ────────────────────────────────────────────
// Fund a deal (funder only).
//
// Calculates the remaining amount to fund server-side
// (total_amount - funded_amount) to prevent client-side manipulation.
// Creates a Stripe PaymentIntent for the remaining amount, updates
// funded_amount, and transitions the deal to 'active' if it was in 'draft'.
//
// Body: {} (no required fields — amount is always computed server-side)

export async function POST(request: NextRequest, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params

  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try {
    requireRole(profile, 'funder', 'admin')
  } catch (err) {
    return err as NextResponse
  }

  const supabase = await createClient()

  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Fetch Deal ──────────────────────────────────────────────────────────────
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, total_amount, funded_amount, released_amount, status, funder_id')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return notFoundError(
      `Deal ${dealId} was not found. Verify the deal ID and try again.`,
    )
  }

  // ── Contract Gate: signed contract required before funding ─────────────────
  //
  // A deal cannot receive funding without a fully-executed contract.
  // Both parties must have signed via DocuSign before escrow is opened.
  //
  // This query intentionally uses the user-scoped client (not admin) so that
  // RLS confirms the caller is a deal participant.
  const { data: contract, error: contractLookupError } = await supabase
    .from('contracts')
    .select('status')
    .eq('deal_id', dealId)
    .maybeSingle()

  if (contractLookupError) {
    return internalError(
      'Could not verify contract status before funding. Please try again.',
      contractLookupError.message,
    )
  }

  if (!contract) {
    return NextResponse.json(
      {
        error: 'No contract on file.',
        detail: 'A signed contract is required before funding can be accepted. ' +
          'The contractor must upload the contract PDF and both parties must sign via DocuSign.',
        contract_status: null,
      },
      { status: 403 },
    )
  }

  if (contract.status !== 'signed') {
    const pendingParty =
      contract.status === 'pending_signatures' ? 'both parties' :
      contract.status === 'funder_signed'      ? 'the contractor' :
      contract.status === 'contractor_signed'  ? 'the funder' :
      contract.status === 'voided'             ? null : 'both parties'

    const detail =
      contract.status === 'voided'
        ? 'The contract has been voided. A new contract must be uploaded and signed before funding.'
        : `Waiting for ${pendingParty} to sign. Funding is unlocked only after both parties ` +
          'have executed the contract.'

    return NextResponse.json(
      {
        error: 'Contract not fully signed.',
        detail,
        contract_status: contract.status,
      },
      { status: 403 },
    )
  }

  if (deal.status === 'completed' || deal.status === 'cancelled') {
    return errorResponse(
      400,
      `This deal is ${deal.status} and cannot receive additional funding. ` +
        `Only deals in 'draft' or 'active' status can be funded.`,
    )
  }

  // ── Calculate Remaining Amount ──────────────────────────────────────────────
  // Always computed server-side — never trust a client-provided amount
  const remainingToFund = deal.total_amount - deal.funded_amount

  if (remainingToFund <= 0) {
    return errorResponse(
      400,
      `This deal is already fully funded. The total contract value of $${deal.total_amount.toFixed(2)} ` +
        `has been funded in full. No additional funding is required.`,
    )
  }

  // Stripe amounts are in cents (integer)
  const amountInCents = Math.round(remainingToFund * 100)

  if (amountInCents < 50) {
    return errorResponse(
      400,
      `The remaining amount to fund ($${remainingToFund.toFixed(2)}) is below Stripe's minimum ` +
        `charge of $0.50. Adjust the deal total or contact support.`,
    )
  }

  // ── Create Stripe PaymentIntent ─────────────────────────────────────────────
  // Stable idempotency key prevents duplicate charges on retries
  const idempotencyKey = `fund-${dealId}`
  let paymentIntent

  try {
    paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountInCents,
        currency: 'usd',
        metadata: {
          deal_id: dealId,
          funder_id: user.id,
          vektrum_action: 'deal_funding',
        },
        description: `Vektrum deal funding — Deal ${dealId}`,
      },
      { idempotencyKey },
    )
  } catch (stripeError) {
    const message =
      stripeError instanceof Error ? stripeError.message : String(stripeError)
    return internalError(
      'Failed to create the payment intent with Stripe. Please try again. ' +
        'If this problem persists, contact support.',
      message,
    )
  }

  // ── Update Deal ─────────────────────────────────────────────────────────────
  const newFundedAmount = deal.funded_amount + remainingToFund
  const newStatus = deal.status === 'draft' ? 'active' : deal.status
  const oldValues = {
    funded_amount: deal.funded_amount,
    status: deal.status,
  }

  const { data: updatedDeal, error: updateError } = await supabase
    .from('deals')
    .update({
      funded_amount: newFundedAmount,
      status: newStatus,
      funder_id: deal.funder_id ?? user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dealId)
    .select()
    .single()

  if (updateError || !updatedDeal) {
    return internalError(
      'The payment intent was created with Stripe but the deal could not be updated. ' +
        `Payment intent ID: ${paymentIntent.id}. Contact support immediately with this ID.`,
      updateError?.message,
    )
  }

  await logAudit({
    entity_type: 'deal',
    entity_id: dealId,
    action: 'deal_funded',
    actor_id: user.id,
    old_values: oldValues,
    new_values: {
      funded_amount: newFundedAmount,
      status: newStatus,
      remaining_to_fund: remainingToFund,
    },
    metadata: {
      stripe_payment_intent_id: paymentIntent.id,
      stripe_client_secret: paymentIntent.client_secret,
      amount_in_cents: amountInCents,
    },
  })

  return NextResponse.json({
    deal: updatedDeal,
    payment_intent: {
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      amount: remainingToFund,
      amount_in_cents: amountInCents,
      status: paymentIntent.status,
    },
  })
}
