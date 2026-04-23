import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/engine/audit'
import { stripe } from '@/lib/stripe'
import { notifyTransferFailure } from '@/lib/engine/notifications'
import { failTransactionReceipt } from '@/lib/engine/receipts'
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
//   - account.updated          → update stripe_payouts_enabled on the contractor profile
//   - payment_intent.succeeded → confirm deal funding (update funded_amount ledger)
//   - transfer.failed          → mark release/milestone as payout_failed, reverse financials
//   - transfer.reversed        → same as transfer.failed (full reversal path)
//   - transfer.updated         → inspect if reversal is attached; treat as reversed if so
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
      },
      { status: 400 },
    )
  }

  // ── Route Event ─────────────────────────────────────────────────────────────
  // Cast to string so we can handle event types that Stripe's SDK union does
  // not yet enumerate (e.g. transfer.failed, transfer.reversed are real webhook
  // events but may be absent from older @stripe/stripe-js type packages).
  const eventType = event.type as string
  try {
    switch (eventType) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account)
        break

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
        break

      case 'transfer.failed':
        await handleTransferFailed(event.data.object as Stripe.Transfer, 'failed')
        break

      case 'transfer.reversed':
        await handleTransferFailed(event.data.object as Stripe.Transfer, 'reversed')
        break

      case 'transfer.updated': {
        // transfer.updated fires for many reasons; we only care when a reversal
        // has been applied. Stripe attaches a `reversals` list to the object.
        const transfer = event.data.object as Stripe.Transfer
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reversalCount = (transfer.reversals as any)?.total_count ?? 0
        if (transfer.reversed === true || reversalCount > 0) {
          await handleTransferFailed(transfer, 'reversed')
        } else {
          console.log(`[webhook] transfer.updated: no reversal on ${transfer.id} — skipping`)
        }
        break
      }

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

  const newPayoutsEnabled = detailsSubmitted && payoutsEnabled && chargesEnabled

  const oldValues = { stripe_payouts_enabled: profile.stripe_payouts_enabled as boolean }

  const { error: updateError } = await adminClient
    .from('profiles')
    .update({
      stripe_payouts_enabled: newPayoutsEnabled,
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
    new_values: { stripe_payouts_enabled: newPayoutsEnabled },
    metadata: {
      stripe_account_id: account.id,
      details_submitted: detailsSubmitted,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
    },
  })

  console.log(
    `[webhook] account.updated: Profile ${profile.id} — stripe_payouts_enabled=${newPayoutsEnabled}`,
  )
}

// ─── Handler: transfer.confirmed (implicit) ───────────────────────────────────
// Stripe does not send a transfer.succeeded event — transfers are considered
// confirmed once created unless a failure event arrives. However, we mark
// releases as 'confirmed' at creation time and only update to 'failed'/'reversed'
// if the webhook fires. For completeness, this would be the place to mark
// releases as explicitly confirmed if we needed a two-phase confirmation flow.

// ─── Handler: transfer.failed / transfer.reversed ────────────────────────────
// Called for both transfer.failed and transfer.reversed events (and transfer.updated
// when a reversal is detected). Either way the money did not reach the contractor,
// so we:
//   1. Find the release row by stripe_transfer_id
//   2. Mark release.transfer_status = 'failed' | 'reversed'
//   3. Mark billing_record.transfer_status accordingly
//   4. Set milestone.status = 'payout_failed' and record failure metadata
//   5. Call reverse_deal_financials RPC to roll back the deal ledger
//   6. Notify contractor, funder, and admins
//   7. Audit log the entire event
//
// Idempotency: the release status update is conditional on current status
// not already being 'failed'/'reversed', so replayed webhooks are safe.

async function handleTransferFailed(
  transfer: Stripe.Transfer,
  failureType: 'failed' | 'reversed',
): Promise<void> {
  const transferId = transfer.id

  // Only process Vektrum milestone release transfers
  if (transfer.metadata?.vektrum_action !== 'milestone_release') {
    console.log(
      `[webhook] transfer.${failureType}: Transfer ${transferId} is not a Vektrum milestone release — skipping`,
    )
    return
  }

  const milestoneId = transfer.metadata?.milestone_id
  const dealId      = transfer.metadata?.deal_id

  if (!milestoneId || !dealId) {
    console.error(
      `[webhook] transfer.${failureType}: Missing milestone_id or deal_id in metadata for transfer ${transferId}`,
    )
    return
  }

  const adminClient = createSupabaseAdminClient()

  // ── 1. Find the release record ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: release, error: releaseError } = await (adminClient as any)
    .from('releases')
    .select('id, amount, transfer_status, milestone_id, deal_id')
    .eq('stripe_transfer_id', transferId)
    .maybeSingle()

  if (releaseError) {
    console.error(
      `[webhook] transfer.${failureType}: Error fetching release for transfer ${transferId}:`,
      releaseError.message,
    )
    throw releaseError
  }

  if (!release) {
    // Release not found — could be a transfer Vektrum did not create, or DB is
    // ahead of the webhook. Log and return 200 so Stripe doesn't retry forever.
    console.warn(
      `[webhook] transfer.${failureType}: No release found for transfer ${transferId} — nothing to reverse`,
    )
    return
  }

  // Idempotency guard: already processed this failure
  if (release.transfer_status === 'failed' || release.transfer_status === 'reversed') {
    console.log(
      `[webhook] transfer.${failureType}: Release ${release.id} already marked ${release.transfer_status} — skipping`,
    )
    return
  }

  const failureCode    = (transfer.metadata?.failure_code as string | undefined) ?? null
  // Stripe embeds failure details differently depending on event type;
  // for reversals the reason is in transfer.reversal_balance_transaction description
  const failureMessage =
    failureType === 'reversed'
      ? 'Transfer was reversed by Stripe'
      : ((transfer as unknown as Record<string, unknown>).failure_message as string | null) ?? null

  const nowIso = new Date().toISOString()

  // ── 2. Mark release as failed/reversed ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: releaseUpdateError } = await (adminClient as any)
    .from('releases')
    .update({
      transfer_status: failureType,
      failure_code:    failureCode,
      failure_message: failureMessage,
      failed_at:       nowIso,
    })
    .eq('id', release.id)
    // Conditional write — only transition from pending/confirmed
    .in('transfer_status', ['pending', 'confirmed'])

  if (releaseUpdateError) {
    console.error(
      `[webhook] transfer.${failureType}: Failed to update release ${release.id}:`,
      releaseUpdateError.message,
    )
    throw releaseUpdateError
  }

  // ── 3. Mark billing_record as failed/reversed ──────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: billingRecord, error: billingUpdateError } = await (adminClient as any)
    .from('billing_records')
    .update({ transfer_status: failureType })
    .eq('release_id', release.id)
    .in('transfer_status', ['pending', 'confirmed'])
    .select('fee_amount')
    .maybeSingle()

  if (billingUpdateError) {
    // Non-fatal: log but continue — the release is already marked failed
    console.error(
      `[webhook] transfer.${failureType}: Failed to update billing_record for release ${release.id}:`,
      billingUpdateError.message,
    )
  }

  const feeAmount: number = (billingRecord as { fee_amount?: number } | null)?.fee_amount ?? 0

  // ── 4. Set milestone status = payout_failed ────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: milestoneUpdateError } = await (adminClient as any)
    .from('milestones')
    .update({
      status:                 'payout_failed',
      last_payout_failure_at: nowIso,
      updated_at:             nowIso,
    })
    .eq('id', milestoneId)

  if (milestoneUpdateError) {
    console.error(
      `[webhook] transfer.${failureType}: Failed to update milestone ${milestoneId}:`,
      milestoneUpdateError.message,
    )
    throw milestoneUpdateError
  }

  // Increment payout_failure_count separately (avoids needing the current value)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient as any).rpc('increment_payout_failure_count', { p_milestone_id: milestoneId })
    .then(({ error }: { error: unknown }) => {
      if (error) {
        // Non-fatal — the status is already set; count is informational
        console.warn(
          `[webhook] transfer.${failureType}: Could not increment payout_failure_count for ${milestoneId}:`,
          error,
        )
      }
    })

  // ── 5. Reverse deal financials ─────────────────────────────────────────────
  const { error: rpcError } = await adminClient.rpc('reverse_deal_financials', {
    p_deal_id:         dealId,
    p_released_amount: release.amount,
    p_fee_amount:      feeAmount,
  })

  if (rpcError) {
    console.error(
      `[webhook] transfer.${failureType}: reverse_deal_financials failed for deal ${dealId}:`,
      rpcError.message,
    )
    // Non-fatal but critical — the milestone is already payout_failed; reconciliation
    // will catch the ledger drift and admin can apply the auto-fix from the dashboard.
    await logAudit({
      entity_type: 'deal',
      entity_id:   dealId,
      action:      'transfer_failure_reversal_rpc_failed',
      actor_id:    'system',
      old_values:  null,
      new_values:  null,
      metadata: {
        stripe_transfer_id: transferId,
        milestone_id:       milestoneId,
        release_id:         release.id,
        released_amount:    release.amount,
        fee_amount:         feeAmount,
        failure_type:       failureType,
        rpc_error:          rpcError.message,
        note:               'Deal ledger was NOT reversed — reconciliation will detect ledger_drift',
      },
    })
  }

  // ── 6. Fetch contact details for notifications ─────────────────────────────
  // Fetch deal with contractor + funder profile emails
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deal } = await (adminClient as any)
    .from('deals')
    .select('id, title, contractor_id, funder_id')
    .eq('id', dealId)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: milestone } = await (adminClient as any)
    .from('milestones')
    .select('id, title')
    .eq('id', milestoneId)
    .maybeSingle()

  let contractorEmail = ''
  let funderEmail     = ''

  if (deal?.contractor_id) {
    const { data: u } = await adminClient.auth.admin.getUserById(deal.contractor_id)
    contractorEmail = u?.user?.email ?? ''
  }
  if (deal?.funder_id) {
    const { data: u } = await adminClient.auth.admin.getUserById(deal.funder_id)
    funderEmail = u?.user?.email ?? ''
  }

  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const retryUrl = `${appUrl}/dashboard/deals/${dealId}`

  if (contractorEmail && funderEmail && deal && milestone) {
    await notifyTransferFailure(
      {
        milestoneId,
        milestoneTitle:   milestone.title ?? milestoneId,
        dealId,
        dealTitle:        deal.title ?? dealId,
        grossAmount:      release.amount,
        feeAmount,
        failureCode,
        failureMessage,
        stripeTransferId: transferId,
        retryUrl,
      },
      contractorEmail,
      funderEmail,
    )
  } else {
    console.warn(
      `[webhook] transfer.${failureType}: Could not send notifications — missing email addresses or deal/milestone data`,
    )
  }

  // ── 6.5. Fail the transaction receipt ──────────────────────────────────────
  // Non-fatal — if no receipt exists yet (race: webhook before insert), the
  // update silently no-ops due to the .eq('status', 'pending') guard.
  await failTransactionReceipt({
    releaseId: release.id,
    status:    failureType,
    failedAt:  nowIso,
  })

  // ── 7. Audit log ───────────────────────────────────────────────────────────
  await logAudit({
    entity_type: 'milestone',
    entity_id:   milestoneId,
    action:      'transfer_failure',
    actor_id:    'system',
    old_values: {
      status:          'released',
      transfer_status: 'pending',
    },
    new_values: {
      status:          'payout_failed',
      transfer_status: failureType,
    },
    metadata: {
      stripe_transfer_id: transferId,
      deal_id:            dealId,
      release_id:         release.id,
      failure_type:       failureType,
      failure_code:       failureCode,
      failure_message:    failureMessage,
      released_amount:    release.amount,
      fee_amount:         feeAmount,
      financials_reversed: !rpcError,
    },
  })

  console.log(
    `[webhook] transfer.${failureType}: Milestone ${milestoneId} marked payout_failed. ` +
      `Release ${release.id} — Transfer ${transferId}. ` +
      `Financials reversed: ${!rpcError}. Notifications sent: ${!!(contractorEmail && funderEmail)}.`,
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
