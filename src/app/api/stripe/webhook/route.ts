import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/engine/audit'
import { stripe } from '@/lib/stripe'
import { notifyTransferFailure } from '@/lib/engine/notifications'
import { confirmTransactionReceipt, failTransactionReceipt } from '@/lib/engine/receipts'
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
//   - transfer.succeeded       → mark release 'confirmed', mark receipt 'confirmed'
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

  // ── Idempotency guard with processing lifecycle ──────────────────────────────
  //
  // INSERT with processing_status='processing' before running any handler.
  // A unique violation (SQLSTATE 23505) means Stripe has delivered this event
  // before. We inspect the existing row's processing_status to decide what to do:
  //
  //   'processed'  — already handled successfully; return 200 (idempotent).
  //   'processing' — concurrent delivery in-flight; return 200 and let it finish.
  //   'failed'     — previous attempt threw; Stripe is retrying. Atomically claim
  //                  the row (UPDATE WHERE processing_status='failed' RETURNING) and
  //                  re-run the handler. If another concurrent retry already claimed
  //                  it, return 200 without re-processing.
  //
  // On success: UPDATE processing_status='processed', processed_at=now().
  // On error:   UPDATE processing_status='failed', error_message=<msg>; return 500
  //             so Stripe will retry (and the retry can claim the 'failed' row).
  const adminClient = createSupabaseAdminClient()
  const processingStart = Date.now()

  const { error: dedupInsertError } = await adminClient
    .from('stripe_processed_events')
    .insert({ stripe_event_id: event.id, event_type: event.type })

  if (dedupInsertError) {
    if (dedupInsertError.code === '23505') {
      // ── Fetch the existing row to inspect lifecycle state ──────────────────
      const { data: existingRow } = await adminClient
        .from('stripe_processed_events')
        .select('processing_status')
        .eq('stripe_event_id', event.id)
        .single()

      const existingStatus = existingRow?.processing_status

      if (existingStatus === 'processed') {
        // Already handled successfully — idempotent acknowledgement.
        console.log(`[webhook] Duplicate event ${event.id} (${event.type}) — already processed, skipping.`)
        return NextResponse.json({ received: true, event_id: event.id, duplicate: true })
      }

      if (existingStatus === 'processing') {
        // Concurrent delivery — the first request is actively handling this event.
        console.log(`[webhook] Concurrent delivery of event ${event.id} (${event.type}) — in-flight, skipping.`)
        return NextResponse.json({ received: true, event_id: event.id, duplicate: true })
      }

      if (existingStatus === 'failed') {
        // Previous attempt failed. Atomically claim the row for retry.
        // If another concurrent Stripe retry already claimed it, back off.
        const { data: claimRows } = await adminClient
          .from('stripe_processed_events')
          .update({ processing_status: 'processing' })
          .eq('stripe_event_id', event.id)
          .eq('processing_status', 'failed')
          .select('id')

        if (!claimRows || claimRows.length === 0) {
          // Another concurrent retry claimed this event first — back off.
          console.log(`[webhook] Event ${event.id} retry already claimed by concurrent request — skipping.`)
          return NextResponse.json({ received: true, event_id: event.id, duplicate: true })
        }

        // Successfully claimed — fall through to re-run the handler below.
        console.log(`[webhook] Retrying previously-failed event ${event.id} (${event.type}).`)
      } else {
        // Unexpected state (e.g. NULL from a schema transition). Acknowledge safely.
        console.warn(`[webhook] Unexpected dedup state '${existingStatus}' for event ${event.id} — skipping.`)
        return NextResponse.json({ received: true, event_id: event.id, duplicate: true })
      }
    } else {
      // Non-uniqueness DB error — log but continue. Downstream conditional writes
      // guard against duplicate side-effects.
      console.error(`[webhook] stripe_processed_events insert failed for ${event.id}:`, dedupInsertError.message)
    }
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

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent)
        break

      case 'transfer.succeeded':
        await handleTransferSucceeded(event.data.object as Stripe.Transfer)
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
        // Acknowledge but do not process unhandled event types.
        // console.warn so these surface in error monitoring — unknown events
        // often mean a new Stripe event type was enabled on the dashboard.
        console.warn(`[webhook] Received unhandled event type: ${event.type}`)
        break
    }
  } catch (handlerError) {
    const message = handlerError instanceof Error ? handlerError.message : String(handlerError)
    console.error(`[webhook] Handler error for event ${event.type} (${event.id}):`, message)

    // Mark the event as 'failed' so the next Stripe retry can claim and re-run it.
    // (The dedup INSERT at the top uses WHERE processing_status='failed' to atomically
    // claim failed rows for re-processing rather than short-circuiting with 200.)
    adminClient
      .from('stripe_processed_events')
      .update({
        processing_status: 'failed',
        error_message:     message,
        processing_ms:     Date.now() - processingStart,
      })
      .eq('stripe_event_id', event.id)
      .then(({ error }) => {
        if (error) console.error(`[webhook] Failed to mark event ${event.id} as failed:`, error.message)
      })

    // Return 500 so Stripe will retry the event.
    return NextResponse.json(
      {
        error: `Webhook handler failed for event type '${event.type}'. Stripe will retry.`,
      },
      { status: 500 },
    )
  }

  // Mark event as successfully processed and record wall-clock duration.
  adminClient
    .from('stripe_processed_events')
    .update({
      processing_status: 'processed',
      processed_at:      new Date().toISOString(),
      processing_ms:     Date.now() - processingStart,
    })
    .eq('stripe_event_id', event.id)
    .then(({ error }) => {
      if (error) console.error(`[webhook] Failed to mark event ${event.id} as processed:`, error.message)
    })

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

// ─── Handler: transfer.succeeded ─────────────────────────────────────────────
// Fired by Stripe when a Connect transfer is confirmed — i.e. funds have been
// applied to the destination (contractor's) Connect account.
//
// Updates (via confirm_stripe_transfer RPC — single ACID transaction):
//   releases.transfer_status         pending → confirmed
//   billing_records.transfer_status  pending → confirmed
//
// Then (outside the transaction, non-fatal):
//   transaction_receipts.status      pending → confirmed
//
// Atomicity:
//   The release and billing_records updates are wrapped in confirm_stripe_transfer(),
//   a Postgres function that uses SELECT FOR UPDATE NOWAIT to serialize concurrent
//   deliveries. Both updates commit or neither does. If billing fails, the entire
//   transaction rolls back, leaving the release in 'pending' so Stripe can retry.
//
// Idempotency:
//   Pre-query checks release state before calling the RPC:
//     - 'confirmed': return 200 (already done — duplicate delivery).
//     - 'failed'/'reversed': return 200 with audit log (failure state wins;
//       late-arriving success must not overwrite — Stripe should not retry).
//   The RPC also checks inside the lock for race-condition safety.
//
// NOTE: increment_deal_financials() is NOT called here. The release route calls
// it synchronously before returning (reserved_amount → released_amount + fees).
// Calling it again in the webhook would double-increment the deal ledger.

async function handleTransferSucceeded(transfer: Stripe.Transfer): Promise<void> {
  const transferId = transfer.id

  // Only process Vektrum milestone release transfers — skip anything else
  // (platform-initiated payouts, Connect account top-ups, etc.)
  if (transfer.metadata?.vektrum_action !== 'milestone_release') {
    console.log(
      `[webhook] transfer.succeeded: ${transferId} is not a Vektrum milestone release — skipping`,
    )
    return
  }

  const milestoneId = transfer.metadata?.milestone_id
  const dealId      = transfer.metadata?.deal_id

  if (!milestoneId || !dealId) {
    console.error(
      `[webhook] transfer.succeeded: Missing milestone_id or deal_id in metadata for transfer ${transferId}`,
    )
    // Do not throw — missing metadata means this is likely not our transfer.
    // Returning 200 prevents Stripe from retrying indefinitely.
    return
  }

  const adminClient = createSupabaseAdminClient()

  // ── 1. Pre-check release state for idempotency and failure-wins logging ───
  // We query without a lock first to handle already-confirmed and failure-wins
  // cases with detailed audit logging, avoiding an unnecessary RPC call.
  // The RPC re-checks state inside the lock for race-condition correctness.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: release, error: releaseQueryError } = await (adminClient as any)
    .from('releases')
    .select('id, transfer_status')
    .eq('stripe_transfer_id', transferId)
    .maybeSingle()

  if (releaseQueryError) {
    console.error(
      `[webhook] transfer.succeeded: Error querying release for transfer ${transferId}:`,
      releaseQueryError.message,
    )
    throw releaseQueryError
  }

  if (!release) {
    // No matching release. Two legitimate causes:
    //   a) Webhook arrived before the release route finished its DB insert —
    //      Stripe retries will resolve this (handler throws → 500).
    //   b) Transfer was not created by this platform.
    // Throw so Stripe retries; if it's case (b) the event will eventually
    // age out of Stripe's retry window.
    console.warn(
      `[webhook] transfer.succeeded: No release found for transfer ${transferId} — throwing for Stripe retry`,
    )
    throw new Error(`No release found for transfer ${transferId}`)
  }

  // Already confirmed — duplicate webhook delivery. No-op.
  if (release.transfer_status === 'confirmed') {
    console.log(
      `[webhook] transfer.succeeded: Release ${release.id} already confirmed — skipping`,
    )
    return
  }

  // Already failed or reversed — a failure event arrived (and committed) first.
  // Do NOT overwrite: the failure state has higher authority.
  // Return 200 — Stripe should not retry a late success after a confirmed failure.
  if (release.transfer_status === 'failed' || release.transfer_status === 'reversed') {
    console.warn(
      `[webhook] transfer.succeeded: Release ${release.id} is already '${release.transfer_status}'. ` +
        `Late-arriving transfer.succeeded ignored — failure state takes precedence.`,
    )
    await logAudit({
      entity_type: 'release',
      entity_id:   release.id,
      action:      'transfer_succeeded_ignored_after_failure',
      actor_id:    'system',
      old_values:  { transfer_status: release.transfer_status },
      new_values:  null,
      metadata: {
        stripe_transfer_id: transferId,
        milestone_id:       milestoneId,
        deal_id:            dealId,
        note:               'transfer.succeeded arrived after failure event — not applied',
      },
    })
    return
  }

  // ── 2. Atomically confirm release + billing via RPC ───────────────────────
  // confirm_stripe_transfer() wraps both status updates in a single Postgres
  // transaction with a SELECT FOR UPDATE NOWAIT on the release row:
  //   - If the transfer is already confirmed (race): returns already_confirmed=true
  //   - If the release entered failure state between pre-query and RPC (race):
  //     raises SQLSTATE 55000 — failure wins, we return 200 without retry
  //   - If another delivery holds the lock (NOWAIT): raises SQLSTATE 55P03 —
  //     we throw so Stripe retries after the concurrent delivery commits
  //   - If any UPDATE fails: entire transaction rolls back → release stays
  //     'pending' → we throw so Stripe retries
  const { data: rpcData, error: rpcError } = await adminClient.rpc('confirm_stripe_transfer', {
    p_stripe_transfer_id: transferId,
  })

  if (rpcError) {
    if (rpcError.code === '55000') {
      // Release entered failure state between pre-query and RPC (concurrent failure
      // event). Failure state wins — return 200, do not retry.
      console.warn(
        `[webhook] transfer.succeeded: Release ${release.id} entered failure state during ` +
          `confirmation race. Late success ignored — failure state takes precedence.`,
      )
      return
    }
    // All other errors (P0002 not found, 55P03 lock conflict, transaction failure):
    // throw so Stripe retries.
    console.error(
      `[webhook] transfer.succeeded: confirm_stripe_transfer RPC failed for ${transferId}:`,
      rpcError.message, `(code: ${rpcError.code})`,
    )
    throw rpcError
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpcResult = (rpcData as any[])[0] as {
    already_confirmed: boolean
    release_id:        string
    billing_updated:   boolean
  }

  if (rpcResult.already_confirmed) {
    // Concurrent delivery confirmed this release between pre-query and RPC.
    console.log(
      `[webhook] transfer.succeeded: Transfer ${transferId} confirmed by concurrent request ` +
        `(release ${rpcResult.release_id}) — skipping`,
    )
    return
  }

  // ── 3. Confirm the transaction receipt ────────────────────────────────────
  // Outside the RPC transaction — non-fatal. confirmTransactionReceipt() is
  // internally guarded: only transitions from 'pending', never overwrites
  // 'failed'/'reversed'. If this fails, the release is already confirmed; the
  // receipt discrepancy is caught by reconciliation.
  await confirmTransactionReceipt(rpcResult.release_id)

  // ── 4. Audit log ───────────────────────────────────────────────────────────
  await logAudit({
    entity_type: 'release',
    entity_id:   rpcResult.release_id,
    action:      'transfer_confirmed',
    actor_id:    'system',
    old_values:  { transfer_status: 'pending' },
    new_values:  { transfer_status: 'confirmed' },
    metadata: {
      stripe_transfer_id:     transferId,
      milestone_id:           milestoneId,
      deal_id:                dealId,
      billing_record_updated: rpcResult.billing_updated,
    },
  })

  console.log(
    `[webhook] transfer.succeeded: Release ${rpcResult.release_id} confirmed — Transfer ${transferId}`,
  )
}

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
// Fired when the funder's bank confirms the payment.
//
// TWO-PHASE FUNDING MODEL — this is Phase 2:
//   Phase 1 (POST /api/deals/[dealId]/fund): creates the Stripe PaymentIntent,
//     increments funds_pending_amount, stores stripe_payment_intent_id. Does NOT
//     touch funded_amount.
//   Phase 2 (this handler): bank confirmation arrives. We increment funded_amount
//     by the confirmed amount, decrement funds_pending_amount, set funds_captured,
//     and transition the deal from 'draft' → 'active'.
//
// funded_amount is ONLY ever incremented here — never in the fund API route.
// This eliminates the phantom-balance bug where funded_amount could reflect
// a payment that was subsequently declined by the issuing bank.
//
// Stripe PaymentIntent shape:
//   https://stripe.com/docs/api/payment_intents/object
//   pi.amount   — integer, cents
//   pi.metadata — set at PI creation: { deal_id, funder_id, vektrum_action }

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  const dealId   = paymentIntent.metadata?.deal_id
  const funderId = paymentIntent.metadata?.funder_id

  if (!dealId) {
    // Not a Vektrum deal-funding PI (could be a Connect payout PI) — skip
    console.log(
      `[webhook] payment_intent.succeeded: No deal_id in metadata for PI ${paymentIntent.id} — skipping`,
    )
    return
  }

  const adminClient = createSupabaseAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deal, error: dealError } = await (adminClient as any)
    .from('deals')
    .select('id, funded_amount, funds_pending_amount, total_amount, status')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    console.error(
      `[webhook] payment_intent.succeeded: Deal ${dealId} not found for PI ${paymentIntent.id}`,
    )
    // Throw so Stripe retries — deal should always exist when a PI succeeds
    throw new Error(`Deal ${dealId} not found`)
  }

  const confirmedAmountUsd = paymentIntent.amount / 100

  const newFundedAmount  = deal.funded_amount + confirmedAmountUsd
  const newPendingAmount = Math.max(0, (deal.funds_pending_amount ?? 0) - confirmedAmountUsd)
  const newStatus        = deal.status === 'draft' ? 'active' : deal.status

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (adminClient as any)
    .from('deals')
    .update({
      funded_amount:        newFundedAmount,
      funds_pending_amount: newPendingAmount,
      funds_captured:       true,
      status:               newStatus,
      updated_at:           new Date().toISOString(),
    })
    .eq('id', dealId)

  if (updateError) {
    console.error(
      `[webhook] payment_intent.succeeded: Failed to update deal ${dealId}:`,
      updateError.message,
    )
    throw updateError
  }

  await logAudit({
    entity_type:   'deal',
    entity_id:     dealId,
    action:        'deal_funded_confirmed',
    actor_id:      funderId ?? null,
    actor_role:    'system',
    system_source: 'webhook/stripe',
    old_values: {
      funded_amount:        deal.funded_amount,
      funds_pending_amount: deal.funds_pending_amount ?? 0,
      status:               deal.status,
      funds_captured:       false,
    },
    new_values: {
      funded_amount:        newFundedAmount,
      funds_pending_amount: newPendingAmount,
      funds_captured:       true,
      status:               newStatus,
    },
    metadata: {
      stripe_payment_intent_id: paymentIntent.id,
      stripe_event_type:        'payment_intent.succeeded',
      confirmed_amount_usd:     confirmedAmountUsd,
      amount_in_cents:          paymentIntent.amount,
      currency:                 paymentIntent.currency,
    },
  })

  console.log(
    `[webhook] payment_intent.succeeded: Deal ${dealId} funded — ` +
      `confirmed $${confirmedAmountUsd.toFixed(2)} via PI ${paymentIntent.id}` +
      (newStatus !== deal.status ? ` — status: ${deal.status} → ${newStatus}` : ''),
  )
}

// ─── Handler: payment_intent.payment_failed ──────────────────────────────────
// Fired when the funder's bank declines the payment.
//
// We:
//   1. Decrement funds_pending_amount (reverting the increment from the fund route)
//   2. Do NOT touch funded_amount — it was never incremented for this PI
//   3. Log the failure reason from Stripe's last_payment_error for support/audit
//
// The deal remains in 'draft' status. The funder can retry by calling the fund
// route again, which will detect the existing PI is now 'canceled' and create a new one.
//
// last_payment_error shape:
//   https://stripe.com/docs/api/payment_intents/object#payment_intent_object-last_payment_error
//   .code         — machine-readable: 'card_declined', 'insufficient_funds', etc.
//   .decline_code — issuer reason: 'do_not_honor', 'insufficient_funds', etc.
//   .message      — human-readable description

async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  const dealId   = paymentIntent.metadata?.deal_id
  const funderId = paymentIntent.metadata?.funder_id

  if (!dealId) {
    console.warn('[webhook] payment_intent.payment_failed: no deal_id in metadata', {
      payment_intent_id: paymentIntent.id,
    })
    return
  }

  const adminClient = createSupabaseAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deal, error: dealError } = await (adminClient as any)
    .from('deals')
    .select('id, funds_pending_amount')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    console.error('[webhook] payment_intent.payment_failed: deal not found', {
      deal_id:           dealId,
      payment_intent_id: paymentIntent.id,
      error:             dealError?.message,
    })
    // Do not throw — a missing deal on payment failure is not recoverable via retry
    return
  }

  const failedAmountUsd  = paymentIntent.amount / 100
  const newPendingAmount = Math.max(0, (deal.funds_pending_amount ?? 0) - failedAmountUsd)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (adminClient as any)
    .from('deals')
    .update({
      funds_pending_amount: newPendingAmount,
      updated_at:           new Date().toISOString(),
    })
    .eq('id', dealId)

  if (updateError) {
    console.error('[webhook] payment_intent.payment_failed: deal update failed', {
      deal_id:           dealId,
      payment_intent_id: paymentIntent.id,
      error:             updateError.message,
    })
    throw updateError
  }

  // Extract Stripe failure details
  // https://stripe.com/docs/api/payment_intents/object#payment_intent_object-last_payment_error
  const lastError     = paymentIntent.last_payment_error
  const failureCode   = lastError?.code         ?? 'unknown'
  const failureReason = lastError?.message      ?? 'Payment declined by issuing bank'
  const declineCode   = lastError?.decline_code ?? null

  await logAudit({
    entity_type:   'deal',
    entity_id:     dealId,
    action:        'deal_funding_failed',
    actor_id:      funderId ?? null,
    actor_role:    'system',
    system_source: 'webhook/stripe',
    old_values: {
      funds_pending_amount: deal.funds_pending_amount ?? 0,
    },
    new_values: {
      funds_pending_amount: newPendingAmount,
    },
    metadata: {
      stripe_payment_intent_id: paymentIntent.id,
      stripe_event_type:        'payment_intent.payment_failed',
      failed_amount_usd:        failedAmountUsd,
      failure_code:             failureCode,
      failure_reason:           failureReason,
      decline_code:             declineCode,
      note: 'funded_amount was NOT decremented — it was never incremented for this payment intent',
    },
  })

  console.warn('[webhook] payment_intent.payment_failed: payment declined', {
    deal_id:        dealId,
    failed_amount:  failedAmountUsd,
    failure_code:   failureCode,
    failure_reason: failureReason,
  })
}
