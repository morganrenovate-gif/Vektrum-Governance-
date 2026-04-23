import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { stripe } from '@/lib/stripe'
import { billingRateFromTier, calculateGovernanceFacility, type SubscriptionTier } from '@/lib/engine/billing'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'



// ─── POST /api/deals/[dealId]/fund ────────────────────────────────────────────
// Initiate funding for a deal (funder only).
//
// IMPORTANT — two-phase funding model:
//   Phase 1 (this route):   Create a Stripe PaymentIntent. Increment
//                           funds_pending_amount. Store stripe_payment_intent_id
//                           on the deal. Do NOT touch funded_amount.
//
//   Phase 2 (webhook):      payment_intent.succeeded increments funded_amount,
//                           decrements funds_pending_amount, and sets
//                           funds_captured = true. Only then is the deal
//                           considered funded.
//
// This separation ensures funded_amount only ever reflects bank-confirmed money,
// eliminating the phantom-balance bug where PI creation preceded bank confirmation.
//
// IDEMPOTENCY:
//   If stripe_payment_intent_id is already set on the deal and that PI is still
//   in a pending Stripe state, the existing client_secret is returned rather than
//   creating a duplicate charge. A new PI is only created when:
//     - No existing PI is on the deal, OR
//     - The existing PI has succeeded (funded_amount already updated by webhook), OR
//     - The existing PI was cancelled or expired.

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deal, error: dealError } = await (supabase as any)
    .from('deals')
    .select('id, total_amount, funded_amount, released_amount, status, funder_id, stripe_payment_intent_id, funds_pending_amount')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return notFoundError(
      `Deal ${dealId} was not found. Verify the deal ID and try again.`,
    )
  }

  // ── Resolve Funder Billing Rate ─────────────────────────────────────────────
  //
  // billing_rate_bps is always set server-side from the funder's subscription_tier.
  // It is locked in at first funding so that the rate is immutable for the life of
  // the deal — subsequent top-ups do not change it, and user input is never accepted.
  const { data: funderProfile, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  if (profileError || !funderProfile) {
    return internalError(
      'Could not retrieve your account profile to determine the billing rate. Please try again.',
      profileError?.message,
    )
  }

  const billingRateBps = billingRateFromTier(
    (funderProfile.subscription_tier ?? 'standalone') as SubscriptionTier,
  )

  // Compute the governance facility with the funder's actual tier rate.
  // This supersedes the STANDALONE default set at deal creation.
  const governance = calculateGovernanceFacility(deal.total_amount, billingRateBps)

  // ── Contract Gate: signed contract required before funding ─────────────────
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
  // Always computed server-side — never trust a client-provided amount.
  // funded_amount reflects only confirmed payments (updated by webhook), so
  // this correctly represents the true unfunded balance.
  const remainingToFund = deal.total_amount - deal.funded_amount

  if (remainingToFund <= 0) {
    return errorResponse(
      400,
      `This deal is already fully funded. The total contract value of $${deal.total_amount.toFixed(2)} ` +
        `has been funded in full. No additional funding is required.`,
    )
  }

  const amountInCents = Math.round(remainingToFund * 100)

  if (amountInCents < 50) {
    return errorResponse(
      400,
      `The remaining amount to fund ($${remainingToFund.toFixed(2)}) is below Stripe's minimum ` +
        `charge of $0.50. Adjust the deal total or contact support.`,
    )
  }

  // ── Idempotency Check: return existing pending PaymentIntent if present ─────
  //
  // If a PaymentIntent was already created for this deal and is still in a
  // payment-pending state, return it rather than creating a duplicate charge.
  // This handles the case where the funder's browser closed mid-checkout.
  //
  // Stripe PI lifecycle states that indicate payment is still in flight:
  //   requires_payment_method — awaiting card/bank entry
  //   requires_confirmation   — created but not yet confirmed
  //   requires_action         — 3DS / bank redirect in progress
  //   processing              — submitted to network, awaiting result
  const PENDING_PI_STATUSES = new Set([
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'processing',
  ])

  if (deal.stripe_payment_intent_id) {
    let existingIntent
    try {
      existingIntent = await stripe.paymentIntents.retrieve(deal.stripe_payment_intent_id)
    } catch (err) {
      // If Stripe can't find the PI (deleted/expired), proceed to create a new one
      console.warn(
        `[fund] Could not retrieve PI ${deal.stripe_payment_intent_id} from Stripe — will create new:`,
        err instanceof Error ? err.message : String(err),
      )
    }

    if (existingIntent) {
      if (PENDING_PI_STATUSES.has(existingIntent.status)) {
        // In-flight PI: return existing client_secret — do not create a duplicate
        return NextResponse.json({
          deal,
          payment_intent: {
            id:              existingIntent.id,
            client_secret:   existingIntent.client_secret,
            amount:          remainingToFund,
            amount_in_cents: amountInCents,
            status:          existingIntent.status,
          },
          reused: true,
        })
      }

      if (existingIntent.status === 'succeeded') {
        // PI succeeded but webhook hasn't fired yet (or there's a race).
        // Return a conflict — the webhook will update funded_amount shortly.
        return NextResponse.json(
          {
            error: 'Payment already confirmed.',
            detail: 'Your Stripe payment was accepted. The deal balance will update within seconds ' +
              'once the confirmation webhook is processed.',
            stripe_payment_intent_id: existingIntent.id,
          },
          { status: 409 },
        )
      }

      // PI is canceled or expired — clear it from the deal so we can create a new one
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deals')
        .update({
          stripe_payment_intent_id: null,
          funds_pending_amount:     0,
          updated_at:               new Date().toISOString(),
        })
        .eq('id', dealId)
    }
  }

  // ── Create Stripe PaymentIntent ─────────────────────────────────────────────
  // Idempotency key scoped to deal + amount so that network-level retries for
  // the same amount don't create duplicate PIs, while a new amount (partial
  // top-up after confirmed payment) correctly creates a fresh intent.
  const idempotencyKey = `fund-${dealId}-${amountInCents}`
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

  // ── Update Deal (pending state only — funded_amount is NOT touched) ─────────
  //
  // Transition:
  //   funds_pending_amount += remainingToFund   (in-flight uncommitted money)
  //   stripe_payment_intent_id = paymentIntent.id
  //   funded_amount            = UNCHANGED       ← only updated by webhook
  //   status                   = UNCHANGED       ← only set to 'active' by webhook
  //
  // Governance fields and billing_rate_bps are locked in here so the funder's
  // tier is captured at the moment they committed to funding, not at webhook time.
  const newPendingAmount = (deal.funds_pending_amount ?? 0) + remainingToFund

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedDeal, error: updateError } = await (supabase as any)
    .from('deals')
    .update({
      // ── Pending funding state (two-phase model) ──────────────────────────
      funds_pending_amount:     newPendingAmount,
      stripe_payment_intent_id: paymentIntent.id,
      // ── Funder assignment ────────────────────────────────────────────────
      funder_id:                deal.funder_id ?? user.id,
      // ── Billing rate — locked in at funding initiation ───────────────────
      // Written here so that the rate reflects the funder's tier at the time
      // they committed. The webhook uses whatever is already on the deal.
      billing_rate_bps:         billingRateBps,
      construction_budget:      governance.constructionBudget,
      governance_fee_bps:       governance.governanceFeeBps,
      governance_fee_total:     governance.governanceFeeTotal,
      facility_total:           governance.facilityTotal,
      updated_at:               new Date().toISOString(),
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
    entity_type:   'deal',
    entity_id:     dealId,
    action:        'deal_funding_initiated',
    actor_id:      user.id,
    system_source: 'api/deals/fund',
    old_values: {
      funded_amount:        deal.funded_amount,
      funds_pending_amount: deal.funds_pending_amount ?? 0,
      status:               deal.status,
    },
    new_values: {
      funds_pending_amount:     newPendingAmount,
      stripe_payment_intent_id: paymentIntent.id,
      billing_rate_bps:         billingRateBps,
      remaining_to_fund:        remainingToFund,
      construction_budget:      governance.constructionBudget,
      governance_fee_bps:       governance.governanceFeeBps,
      governance_fee_total:     governance.governanceFeeTotal,
      facility_total:           governance.facilityTotal,
    },
    metadata: {
      stripe_payment_intent_id: paymentIntent.id,
      stripe_client_secret:     paymentIntent.client_secret,
      amount_in_cents:          amountInCents,
      funder_subscription_tier: funderProfile.subscription_tier,
      note: 'funded_amount will be incremented by payment_intent.succeeded webhook, not here',
    },
  })

  return NextResponse.json({
    deal:    updatedDeal,
    payment_intent: {
      id:              paymentIntent.id,
      client_secret:   paymentIntent.client_secret,
      amount:          remainingToFund,
      amount_in_cents: amountInCents,
      status:          paymentIntent.status,
    },
    reused: false,
  })
}
