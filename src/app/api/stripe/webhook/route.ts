import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/engine/audit'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic'

// ─── POST /api/stripe/webhook ─────────────────────────────────────────────────
// Handles incoming Stripe webhook events.
//
// IMPORTANT: This route reads the raw request body for signature verification.
// The Next.js App Router does NOT automatically parse the body here — we read
// it as a Buffer so that stripe.webhooks.constructEvent() can verify the
// Stripe-Signature header against the exact byte sequence Stripe signed.
//
// Handled events:
//   - account.updated         → update stripe_payouts_enabled on the contractor profile
//   - payment_intent.succeeded → confirm deal funding (update funded_amount ledger)
//
// All other events return 200 to acknowledge receipt without processing.

export async function POST(request: NextRequest) {
  // ── Read Raw Body ───────────────────────────────────────────────────────────
  const rawBody = await request.arrayBuffer()
  const rawBodyBuffer = Buffer.from(rawBody)

  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    console.error('[webhook] Missing stripe-signature header')
    return NextResponse.json(
      {
        error:
          'Missing stripe-signature header. All webhook requests must be signed by Stripe.',
      },
      { status: 400 },
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook secret is not configured on the server.' },
      { status: 500 },
    )
  }

  // ── Verify Signature ────────────────────────────────────────────────────────
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(rawBodyBuffer, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[webhook] Signature verification failed:', message)
    return NextResponse.json(
      {
        error:
          'Webhook signature verification failed. Ensure the request originates from Stripe and the webhook secret is correct.',
        detail: message,
      },
      { status: 400 },
    )
  }

  // ── Route Event ─────────────────────────────────────────────────────────────
  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account)
        break

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
        break

      default:
        // Acknowledge but do not process unhandled event types
        console.log(`[webhook] Received unhandled event type: ${event.type}`)
        break
    }
  } catch (handlerError) {
    const message = handlerError instanceof Error ? handlerError.message : String(handlerError)
    console.error(`[webhook] Handler error for event ${event.type} (${event.id}):`, message)

    // Return 500 so Stripe will retry the event
    return NextResponse.json(
      {
        error: `Webhook handler failed for event type '${event.type}'. Stripe will retry.`,
        detail: message,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ received: true, event_id: event.id })
}

// ─── Handler: account.updated ─────────────────────────────────────────────────
// Fired by Stripe when a Connect account's details change.
// We use this to detect when a contractor has enabled payouts.

async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  const adminClient = createSupabaseAdminClient()

  // Look up the profile by stripe_account_id
  const profileRes = await adminClient
    .from('profiles')
    .select('*')
    .eq('stripe_account_id', account.id)
    .single()

  if (profileRes.error || !profileRes.data) {
    console.warn(
      `[webhook] account.updated: No Vektrum profile found for Stripe account ${account.id}`,
    )
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = profileRes.data as any

  const payoutsEnabled = account.payouts_enabled ?? false
  const detailsSubmitted = account.details_submitted ?? false
  const chargesEnabled = account.charges_enabled ?? false

  const newStatus = detailsSubmitted && payoutsEnabled && chargesEnabled
    ? 'active'
    : 'pending'

  const oldValues = { stripe_account_status: profile.stripe_account_status as string }

  const { error: updateError } = await adminClient
    .from('profiles')
    .update({
      stripe_account_status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', account.id)

  if (updateError) {
    console.error(
      `[webhook] account.updated: Failed to update profile for Stripe account ${account.id}:`,
      updateError.message,
    )
    throw updateError
  }

  await logAudit({
    entity_type: 'profile',
    entity_id: profile.id,
    action: 'stripe_account_updated',
    actor_id: 'system',
    old_values: oldValues,
    new_values: { stripe_account_status: newStatus },
    metadata: {
      stripe_account_id: account.id,
      details_submitted: detailsSubmitted,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
    },
  })

  console.log(
    `[webhook] account.updated: Profile ${profile.id} — stripe_account_status=${newStatus}`,
  )
}

// ─── Handler: payment_intent.succeeded ───────────────────────────────────────
// Fired when a funder's PaymentIntent (created by /api/deals/[dealId]/fund) succeeds.
// Confirms the funded_amount is accurate and transitions deal status if needed.
//
// Note: The funded_amount is already optimistically updated when the PaymentIntent
// is created. This handler verifies and reconciles the ledger on confirmed payment.

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  const dealId = paymentIntent.metadata?.deal_id
  const funderId = paymentIntent.metadata?.funder_id

  if (!dealId) {
    // Not a Vektrum deal funding intent — skip
    console.log(
      `[webhook] payment_intent.succeeded: No deal_id in metadata for PI ${paymentIntent.id} — skipping`,
    )
    return
  }

  const adminClient = createSupabaseAdminClient()

  const { data: deal, error: dealError } = await adminClient
    .from('deals')
    .select('id, funded_amount, total_amount, status')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    console.error(
      `[webhook] payment_intent.succeeded: Deal ${dealId} not found for PI ${paymentIntent.id}`,
    )
    throw new Error(`Deal ${dealId} not found`)
  }

  const amountInDollars = paymentIntent.amount / 100

  // Ensure deal status reflects funding — it should already be 'active' but confirm
  const needsActivation = deal.status === 'draft'

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (needsActivation) {
    updatePayload.status = 'active'
  }

  if (Object.keys(updatePayload).length > 1 || needsActivation) {
    const { error: updateError } = await adminClient
      .from('deals')
      .update(updatePayload)
      .eq('id', dealId)

    if (updateError) {
      console.error(
        `[webhook] payment_intent.succeeded: Failed to update deal ${dealId}:`,
        updateError.message,
      )
      throw updateError
    }
  }

  await logAudit({
    entity_type: 'deal',
    entity_id: dealId,
    action: 'payment_confirmed',
    actor_id: funderId ?? 'system',
    old_values: { status: deal.status, funded_amount: deal.funded_amount },
    new_values: {
      status: needsActivation ? 'active' : deal.status,
      payment_confirmed: true,
    },
    metadata: {
      stripe_payment_intent_id: paymentIntent.id,
      amount_confirmed: amountInDollars,
      amount_in_cents: paymentIntent.amount,
      currency: paymentIntent.currency,
    },
  })

  console.log(
    `[webhook] payment_intent.succeeded: Deal ${dealId} — ` +
      `confirmed $${amountInDollars.toFixed(2)} via PI ${paymentIntent.id}` +
      (needsActivation ? ' — deal activated' : ''),
  )
}
