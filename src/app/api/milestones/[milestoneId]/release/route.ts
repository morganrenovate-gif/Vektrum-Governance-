import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess, requireMFA, requireRole } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { validateRelease, checkAiPrecondition } from '@/lib/engine/release-gate'
import { calculateFee, calculateRetainage, toStripeCents } from '@/lib/engine/billing'
import { createTransactionReceipt, markReceiptEmailSent } from '@/lib/engine/receipts'
import { notifyTransactionReceipt } from '@/lib/engine/notifications'
import { notifyReleaseAuthorized, notifyReleaseBlocked } from '@/lib/engine/notify'
import { stripe } from '@/lib/stripe'
import { internalError, notFoundError, validationError } from '@/lib/errors'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'



// ─── POST /api/milestones/[milestoneId]/release ───────────────────────────────
// THE CRITICAL ROUTE.
//
// Releases funds from the deal's funded balance to the contractor's Stripe
// Connect account for an approved milestone.
//
// Safety guarantees:
//   1. validateRelease() is called first. ANY failure returns 400 with ALL errors.
//   2. An idempotency key prevents duplicate Stripe transfers.
//   3. If Stripe fails, NO database records are written (release record, status updates).
//   4. If database writes fail after a successful Stripe transfer, a 500 is returned
//      with the Stripe transfer ID so support can reconcile.
//   5. All actions are audit-logged.

export async function POST(request: NextRequest, { params }: { params: Promise<{ milestoneId: string }> }) {
  const { milestoneId } = await params

  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  // ── Role Guard — funder only ────────────────────────────────────────────────
  // Only the deal funder may release milestone payments. This mirrors the
  // security boundary enforced by validateRelease() Condition 0, but fails fast
  // here — before MFA verification, rate-limit consumption, or any DB query.
  //
  // Admin rationale: admins are intentionally excluded. The release gate documents
  // this as "a deliberate security boundary preventing admin compromise from
  // bypassing funder authorisation." An admin 403 here is the correct outcome;
  // there is no legitimate admin path to release funds on behalf of a funder.
  //
  // Consistency: authorize-external/route.ts uses the same funder-only gate.
  try {
    requireRole(profile, 'funder')
  } catch (err) {
    return err as NextResponse
  }

  const supabase = await createClient()

  // ── MFA Guard — funder must be at AAL2 to release funds ──────────────────────
  try {
    await requireMFA(supabase, profile)
  } catch (err) {
    return err as NextResponse
  }

  // ── Rate limit — financial writes ──────────────────────────────────────────
  // 5 release attempts per 60 s per user (configurable via RATE_LIMIT_FINANCIAL_WRITE_MAX).
  // Blocks burst-submission and amplified gate-query load. Enforced AFTER auth
  // so the key is the authenticated user ID, not a forgeable IP.
  {
    const rl = await checkRateLimit(`user:${user.id}:financial_write`, POLICIES.financial_write)
    if (!rl.allowed) {
      logRateLimitViolation(`user:${user.id}:financial_write`, rl, {
        actorId: user.id, policyName: 'financial_write',
        entityType: 'milestone', entityId: milestoneId,
      })
      return rateLimitResponse(rl, POLICIES.financial_write.description)
    }
  }

  // ── Fetch Milestone (needed for deal access check) ──────────────────────────
  const { data: milestone, error: milestoneError } = await supabase
    .from('milestones')
    .select(
      'id, deal_id, amount, status, protection_status, title',
    )
    .eq('id', milestoneId)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(
      `Milestone ${milestoneId} was not found. Verify the milestone ID and try again.`,
    )
  }

  // ── Fetch Deal (needed for contractor_id, billing rate, and access check) ──
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, title, contractor_id, funder_id, funded_amount, released_amount, fees_collected, reserved_amount, billing_rate_bps, total_amount, retainage_percentage')
    .eq('id', milestone.deal_id)
    .single()

  if (dealError || !deal) {
    return notFoundError(
      `The deal associated with milestone ${milestoneId} could not be found.`,
    )
  }

  // ── Deal Access Check ───────────────────────────────────────────────────────
  try {
    await requireDealAccess(supabase, milestone.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Rate-limit guard ────────────────────────────────────────────────────────
  // Prevents burst requests from the same actor on the same milestone from
  // amplifying DB load across the 5+ gate queries. Checks the audit_log for any
  // release attempt from this actor on this milestone in the last 10 seconds.
  // Uses RELEASE_RATE_LIMIT_WINDOW_SECS env var (default 10).
  {
    const windowSecs  = Math.max(1, parseInt(process.env.RELEASE_RATE_LIMIT_WINDOW_SECS ?? '10', 10))
    const windowStart = new Date(Date.now() - windowSecs * 1000).toISOString()

    const { data: recentAttempts } = await supabase
      .from('audit_log')
      .select('id')
      .eq('entity_type', 'milestone')
      .eq('entity_id', milestoneId)
      .eq('actor_id', user.id)
      .in('action', ['milestone_released', 'release_validation_failed', 'ai_precondition_override_applied', 'release_gate_blocked'])
      .gte('created_at', windowStart)
      .limit(1)

    if (recentAttempts && recentAttempts.length > 0) {
      return NextResponse.json(
        {
          error:
            `A release attempt for this milestone was recorded in the last ${windowSecs} seconds. ` +
            'Please wait before retrying.',
          code: 'RATE_LIMITED',
          retry_after_seconds: windowSecs,
        },
        { status: 429 },
      )
    }
  }

  // ── STEP 0: AI Draw Review Precondition ─────────────────────────────────────
  const aiCheck = await checkAiPrecondition(milestoneId, supabase)
  if (!aiCheck.passed) {
    // Fire-and-forget: the block is already decided. Audit failure must not
    // accidentally allow the release or obscure the 422 response to the caller.
    logAudit({
      entity_type: 'milestone',
      entity_id:   milestoneId,
      action:      'release_gate_blocked',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        deal_id:        milestone.deal_id,
        execution_rail: 'stripe_connect',
        blocked_by:     'ai_precondition',
        reason:         aiCheck.reason,
      },
    }).catch(err => console.error('[release] release_gate_blocked (ai_precondition) audit failed:', err))

    return NextResponse.json(
      { error: aiCheck.reason },
      { status: 422 },
    )
  }

  // If an admin override is active, write a dedicated audit record at the point
  // the override is consumed. This is separate from the release audit entry so
  // the override decision is independently traceable without parsing release metadata.
  if (aiCheck.warning) {
    logAudit({
      entity_type: 'milestone',
      entity_id:   milestoneId,
      action:      'ai_precondition_override_applied',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        deal_id:          milestone.deal_id,
        execution_rail:   'stripe_connect',
        override_warning: aiCheck.warning,
        actor_role:       profile.role,
      },
    }).catch(err => console.error('[release] ai_precondition_override_applied audit failed:', err))
  }

  // ── STEP 1: Run Release Gate (all 10 conditions + role check) ──────────────
  // AI precondition (STEP 0 above) has already been checked. This is the
  // 10-condition server-side release gate defined in src/lib/engine/release-gate.ts.
  const releaseValidation = await validateRelease(supabase, milestoneId, profile)

  if (!releaseValidation.allowed) {
    // Fire-and-forget: the block is already decided. Audit failure must not
    // accidentally allow the release or obscure the 400 response to the caller.
    // failed_conditions contains structured gate error messages (not raw AI output
    // or secrets) — safe to persist for forensic review.
    logAudit({
      entity_type: 'milestone',
      entity_id:   milestoneId,
      action:      'release_gate_blocked',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        deal_id:           milestone.deal_id,
        execution_rail:    'stripe_connect',
        blocked_by:        'release_gate',
        failed_conditions: releaseValidation.errors,
      },
    }).catch(err => console.error('[release] release_gate_blocked (release_gate) audit failed:', err))

    // Fire-and-forget — notify funder which conditions blocked the release
    void notifyReleaseBlocked({
      milestoneId:    milestoneId,
      dealId:         milestone.deal_id,
      funderId:       user.id,
      blockedReasons: releaseValidation.errors,
    })

    return validationError(releaseValidation.errors)
  }

  // ── Fetch Contractor's Stripe Account + Display Name ────────────────────────
  const { data: contractorProfile, error: contractorError } = await supabase
    .from('profiles')
    .select('stripe_account_id, full_name, company_name')
    .eq('id', deal.contractor_id)
    .single()

  if (contractorError || !contractorProfile?.stripe_account_id) {
    return internalError(
      'Could not retrieve the contractor\'s Stripe account ID. ' +
        'Ensure the contractor has completed Stripe Connect onboarding. ' +
        'Contact support if this problem persists.',
      contractorError?.message,
    )
  }

  // ── Fetch Funder Display Name (for receipt) ──────────────────────────────────
  // Non-fatal: if this fails the release still proceeds; receipt will use a fallback.
  let funderProfile: { full_name: string | null; company_name: string | null } | null = null
  if (deal.funder_id) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, company_name')
      .eq('id', deal.funder_id)
      .maybeSingle()
    funderProfile = data
  }

  // ── STEP 1.5: Calculate Platform Fee + Retainage ────────────────────────────
  // Both computed server-side — never accepted from the client.
  // billing_rate_bps and retainage_percentage come from the deal row.
  const fee       = calculateFee(milestone.amount, deal.billing_rate_bps)
  const retainage = calculateRetainage(milestone.amount, deal.retainage_percentage ?? 0)
  // Contractor receives net immediately; retainage is withheld until project completion.
  const netToContractor = retainage.netToContractor

  // ── STEP 2: Generate Idempotency Key ────────────────────────────────────────
  // Stable idempotency key — milestone_id is a UUID so this is globally unique per milestone.
  // Using Date.now() would create a new key on each retry, defeating idempotency entirely.
  const idempotencyKey = `release_${milestoneId}`

  // ── Amount in Cents ─────────────────────────────────────────────────────────
  // Stripe transfer = net_to_contractor (gross - retainage).
  // Platform fee is retained in the Vektrum Stripe account.
  // Retainage is held in the deal's retainage_held balance until project completion.
  const amountInCents = toStripeCents(netToContractor)

  // ── STEP 2.5: Atomically Reserve Funded Balance ──────────────────────────────
  // This is the ACTUAL concurrency gate. validateRelease() above is a fast
  // user-facing pre-check with helpful error messages; this RPC is the hard lock.
  //
  // reserve_release_funds() uses SELECT FOR UPDATE NOWAIT on the deal row so
  // that only one release per deal can pass the funded-balance check at a time:
  //
  //   - Concurrent request on the same deal: blocked until this transaction
  //     commits, then sees the updated reserved_amount and fails if insufficient.
  //   - NOWAIT: if the lock is already held, the RPC raises lock_not_available
  //     (Postgres error code 55P03) which we catch and return as a 409.
  //
  // The reservation is converted to released_amount by increment_deal_financials()
  // on success, or freed by cancel_release_reservation() on Stripe failure.
  const { data: reservationRows, error: reservationError } = await supabase.rpc(
    'reserve_release_funds',
    {
      p_deal_id: milestone.deal_id,
      p_gross:   fee.grossAmount,
      p_fee:     fee.feeAmount,
    },
  )

  if (reservationError) {
    // Postgres error code classification:
    //   55P03 — lock_not_available: another release holds the deal row lock (NOWAIT)
    //   55000 — object_not_in_prerequisite_state: deal is frozen/void/cancelled
    //           (race window between validateRelease() check and lock acquisition;
    //            caught inside reserve_release_funds() after it acquires the lock)
    const isLockConflict    = reservationError.code === '55P03'
    const isStatusRejection = reservationError.code === '55000'
    await logAudit({
      entity_type: 'milestone',
      entity_id:   milestoneId,
      action:      'release_reservation_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        deal_id:          milestone.deal_id,
        execution_rail:   'stripe_connect',
        gross_amount:     fee.grossAmount,
        fee_amount:       fee.feeAmount,
        is_lock_conflict: isLockConflict,
        // blocked_by surfaces the frozen-deal race window in forensic queries
        // without duplicating the full reserve_release_funds error message.
        blocked_by:       isStatusRejection ? 'frozen_deal_status'
                        : isLockConflict    ? 'lock_conflict'
                        : 'reservation_error',
        error:            reservationError.message,
        error_code:       reservationError.code,
      },
    })

    if (isLockConflict) {
      return NextResponse.json(
        {
          error:
            'Another release is currently being processed for this deal. ' +
            'Please wait a moment and try again.',
          code: 'RELEASE_LOCK_CONFLICT',
        },
        { status: 409 },
      )
    }

    return internalError(
      'The funded balance could not be reserved. Please try again.',
      reservationError.message,
    )
  }

  const reservation = Array.isArray(reservationRows) ? reservationRows[0] : reservationRows
  if (!reservation?.ok) {
    // Another in-flight release already reserved the remaining capacity,
    // or the deal is genuinely underfunded at this moment.
    const available = reservation?.available ?? 0
    const required  = reservation?.required  ?? fee.totalDebit
    return NextResponse.json(
      {
        error:
          `Insufficient funded balance after accounting for in-flight releases. ` +
          `Available: $${Number(available).toFixed(2)}. ` +
          `Required: $${Number(required).toFixed(2)}. ` +
          `If another release is in progress, try again once it completes.`,
        code: 'INSUFFICIENT_BALANCE',
      },
      { status: 422 },
    )
  }

  // Reservation acquired — reserved_amount on the deal is now incremented.
  // From this point forward, every error path that does NOT result in a
  // successful Stripe transfer MUST call cancel_release_reservation() to
  // free the reservation and restore the deal's available balance.
  const reservationMade = true  // reservation succeeded; used in catch block to decide whether to cancel

  // ── STEPS 3–7: Wrapped in a Single Try/Catch ────────────────────────────────
  // If Stripe fails → cancel reservation, no DB writes occur.
  // If DB writes fail after Stripe succeeds → return 500 with Stripe transfer ID
  // so that support can reconcile the partial state.

  let stripeTransferId: string | null = null

  try {
    // ── STEP 3: Stripe Transfer ─────────────────────────────────────────────
    // Transfer = net_to_contractor (gross - retainage). Retainage is withheld
    // in the deal's retainage_held balance — the contractor receives it later
    // when the funder releases it via POST .../retainage/release.
    const transfer = await stripe.transfers.create(
      {
        amount: amountInCents,
        currency: 'usd',
        destination: contractorProfile.stripe_account_id,
        transfer_group: milestone.deal_id,
        metadata: {
          milestone_id:        milestoneId,
          deal_id:             milestone.deal_id,
          contractor_id:       deal.contractor_id,
          vektrum_action:      'milestone_release',
          idempotency_key:     idempotencyKey,
          gross_amount:        milestone.amount.toFixed(2),
          retainage_amount:    retainage.retainageAmount.toFixed(2),
          net_to_contractor:   netToContractor.toFixed(2),
        },
        description: `Vektrum milestone release — ${milestone.title}`,
      },
      {
        idempotencyKey,
      },
    )

    stripeTransferId = transfer.id

    // ── STEP 4: Insert Immutable Release Record ─────────────────────────────
    const { error: releaseInsertError } = await supabase
      .from('releases')
      .insert({
        milestone_id: milestoneId,
        deal_id: milestone.deal_id,
        amount: milestone.amount,
        stripe_transfer_id: stripeTransferId,
        idempotency_key: idempotencyKey,
        released_by: user.id,
      })

    if (releaseInsertError) {
      // Stripe transfer succeeded but we couldn't record it — critical partial state
      await logAudit({
        entity_type: 'release',
        entity_id: milestoneId,
        action: 'release_record_insert_failed',
        actor_id: user.id,
        new_values: null,
        old_values: null,
        metadata: {
          stripe_transfer_id: stripeTransferId,
          idempotency_key: idempotencyKey,
          error: releaseInsertError.message,
        },
      })

      return internalError(
        'A Stripe transfer was completed but the release record could not be saved. ' +
          `CRITICAL: Contact support immediately with Stripe Transfer ID: ${stripeTransferId} ` +
          `and Milestone ID: ${milestoneId} to prevent duplicate payments.`,
        releaseInsertError.message,
      )
    }

    // ── STEP 4.5: Insert Billing Record ────────────────────────────────────
    // Uses admin client — the billing_records INSERT policy is WITH CHECK (false),
    // meaning only the service role can insert. This is intentional: billing records
    // are immutable and must only be written by trusted server code.

    // A deal must have a funder before funds can be released.
    // This should have been caught by requireDealAccess, but guard here explicitly.
    if (!deal.funder_id) {
      return internalError(
        'This deal has no funder assigned. Funds cannot be released until a funder has funded the deal.',
      )
    }

    const adminClient = createSupabaseAdminClient()

    // Fetch the release ID we just inserted so we can reference it in billing_records.
    // Filter to transfer_status='pending' — on a retry there may be prior failed rows
    // for the same milestone; we want the one created by this request (always 'pending').
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: releaseRecord, error: releaseSelectError } = await (adminClient as any)
      .from('releases')
      .select('id')
      .eq('milestone_id', milestoneId)
      .eq('transfer_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (releaseSelectError || !releaseRecord) {
      return internalError(
        'Stripe transfer succeeded and release record was inserted, but the release ID ' +
          'could not be retrieved for billing. ' +
          `Contact support with Stripe Transfer ID: ${stripeTransferId} and Milestone ID: ${milestoneId}.`,
        releaseSelectError?.message,
      )
    }

    const { error: billingInsertError } = await adminClient
      .from('billing_records')
      .insert({
        deal_id:            milestone.deal_id,
        milestone_id:       milestoneId,
        release_id:         releaseRecord.id,
        funder_id:          deal.funder_id,
        gross_amount:       fee.grossAmount,
        billing_rate_bps:   fee.billingRateBps,
        fee_amount:         fee.feeAmount,
        // net_amount = net_to_contractor (gross - retainage). This is what
        // the contractor actually received via Stripe in this release.
        net_amount:         netToContractor,
        retainage_amount:   retainage.retainageAmount,
        stripe_transfer_id: stripeTransferId,
        // Tag this record as governance-model so reporting can distinguish it
        // from legacy records created before migration 004.
        billing_source:     'governance_layer',
      })

    if (billingInsertError) {
      await logAudit({
        entity_type: 'billing_record',
        entity_id:   milestoneId,
        action:      'billing_record_insert_failed',
        actor_id:    user.id,
        old_values:  null,
        new_values:  null,
        metadata: {
          stripe_transfer_id: stripeTransferId,
          idempotency_key:    idempotencyKey,
          gross_amount:       fee.grossAmount,
          fee_amount:         fee.feeAmount,
          billing_rate_bps:   fee.billingRateBps,
          error:              billingInsertError.message,
        },
      })

      return internalError(
        'Stripe transfer succeeded but the billing record could not be saved. ' +
          `CRITICAL: Contact support immediately with Stripe Transfer ID: ${stripeTransferId}, ` +
          `Milestone ID: ${milestoneId}. Fee of $${fee.feeAmount.toFixed(2)} must be reconciled.`,
        billingInsertError.message,
      )
    }

    // ── STEP 5: Update Milestone Status (conditional write) ──────────────
    // Atomic: only transitions 'approved' → 'released'. If 0 rows returned,
    // a concurrent request already released this milestone.
    // Also stores retainage_amount for the per-milestone audit trail.
    const { data: milestoneUpdateData, error: milestoneUpdateError } = await supabase
      .from('milestones')
      .update({
        status:            'released',
        protection_status: 'released',
        retainage_amount:  retainage.retainageAmount,
        updated_at:        new Date().toISOString(),
      })
      .eq('id', milestoneId)
      .eq('status', 'approved')
      .select('id')

    if (milestoneUpdateError) {
      await logAudit({
        entity_type: 'milestone',
        entity_id: milestoneId,
        action: 'release_milestone_status_update_failed',
        actor_id: user.id,
        old_values: { status: milestone.status, protection_status: milestone.protection_status },
        new_values: { status: 'released', protection_status: 'released' },
        metadata: {
          stripe_transfer_id: stripeTransferId,
          idempotency_key: idempotencyKey,
          error: milestoneUpdateError.message,
        },
      })

      return internalError(
        'Funds were transferred but the milestone status could not be updated to \'released\'. ' +
          `Contact support with Stripe Transfer ID: ${stripeTransferId} and Milestone ID: ${milestoneId}.`,
        milestoneUpdateError.message,
      )
    }

    if (!milestoneUpdateData || milestoneUpdateData.length === 0) {
      // Concurrent release — milestone was already transitioned by another request.
      // Stripe idempotency key ensures no duplicate transfer, so this is safe to abort.
      await logAudit({
        entity_type: 'milestone',
        entity_id: milestoneId,
        action: 'release_concurrent_conflict',
        actor_id: user.id,
        old_values: null,
        new_values: null,
        metadata: {
          stripe_transfer_id: stripeTransferId,
          idempotency_key: idempotencyKey,
          note: 'Milestone was no longer in approved status at time of update — likely concurrent release.',
        },
      })

      return NextResponse.json(
        {
          error: 'This milestone has already been released by a concurrent request. No duplicate payment was made.',
        },
        { status: 409 },
      )
    }

    // ── STEP 6: Update deal financials (two atomic RPCs) ───────────────────
    //
    // 6a. increment_deal_financials(net_to_contractor, fee):
    //   - released_amount += net_to_contractor
    //   - fees_collected  += fee
    //   - reserved_amount -= (net + fee)   [net + fee portion of reservation settled]
    //   The retainage portion of the reservation stays in reserved_amount temporarily.
    //
    // 6b. increment_deal_retainage(retainage_amount):
    //   - retainage_held  += retainage
    //   - reserved_amount -= retainage     [completes full reservation conversion]
    //   No-op when retainage_amount = 0 (deal has no retainage).
    const { error: dealUpdateError } = await supabase.rpc(
      'increment_deal_financials',
      {
        p_deal_id:         milestone.deal_id,
        p_released_amount: netToContractor,   // net, not gross
        p_fee_amount:      fee.feeAmount,
      },
    )

    if (dealUpdateError) {
      // Recoverable inconsistency — money is sent and milestone is released.
      // The deal's ledger is wrong but can be repaired via support.
      await logAudit({
        entity_type: 'deal',
        entity_id:   milestone.deal_id,
        action:      'release_deal_financials_update_failed',
        actor_id:    user.id,
        old_values:  null,
        new_values: {
          released_amount_increment: netToContractor,
          fee_amount_increment:      fee.feeAmount,
          retainage_amount:          retainage.retainageAmount,
        },
        metadata: {
          stripe_transfer_id: stripeTransferId,
          idempotency_key:    idempotencyKey,
          error:              dealUpdateError.message,
        },
      })

      return internalError(
        'Funds were transferred and the milestone marked as released, but the deal\'s financial ' +
          'ledger (released_amount / fees_collected) could not be updated. This requires manual reconciliation. ' +
          `Contact support with Stripe Transfer ID: ${stripeTransferId}, ` +
          `Milestone ID: ${milestoneId}, Deal ID: ${milestone.deal_id}.`,
        dealUpdateError.message,
      )
    }

    // 6b. Move retainage from reserved_amount → retainage_held (no-op if 0)
    if (retainage.retainageAmount > 0) {
      const { error: retainageUpdateError } = await supabase.rpc(
        'increment_deal_retainage',
        {
          p_deal_id:   milestone.deal_id,
          p_retainage: retainage.retainageAmount,
        },
      )

      if (retainageUpdateError) {
        // Non-fatal to the release but requires reconciliation.
        // reserved_amount has an orphaned retainage portion; retainage_held is understated.
        await logAudit({
          entity_type: 'deal',
          entity_id:   milestone.deal_id,
          action:      'release_retainage_increment_failed',
          actor_id:    user.id,
          old_values:  null,
          new_values:  { retainage_amount: retainage.retainageAmount },
          metadata: {
            stripe_transfer_id: stripeTransferId,
            idempotency_key:    idempotencyKey,
            error:              retainageUpdateError.message,
            note:               'reserved_amount has orphaned retainage — requires reconciliation',
          },
        })

        return internalError(
          'Funds were transferred and the milestone released, but the retainage ledger ' +
            '(retainage_held) could not be updated. This requires manual reconciliation. ' +
            `Contact support with Stripe Transfer ID: ${stripeTransferId}, ` +
            `Milestone ID: ${milestoneId}, retainage amount: $${retainage.retainageAmount.toFixed(2)}.`,
          retainageUpdateError.message,
        )
      }
    }

    // ── STEP 7: Audit Log (success path) ───────────────────────────────────
    await logAudit({
      entity_type: 'milestone',
      entity_id:   milestoneId,
      action:      'funds_released',
      actor_id:    user.id,
      old_values: {
        status:            milestone.status,
        protection_status: milestone.protection_status,
      },
      new_values: {
        status:            'released',
        protection_status: 'released',
        retainage_amount:  retainage.retainageAmount,
      },
      metadata: {
        deal_id:              milestone.deal_id,
        contractor_id:        deal.contractor_id,
        gross_amount:         fee.grossAmount,
        fee_amount:           fee.feeAmount,
        retainage_amount:     retainage.retainageAmount,
        retainage_percentage: retainage.retainagePercentage,
        net_to_contractor:    netToContractor,
        billing_rate_bps:     fee.billingRateBps,
        total_debit:          fee.totalDebit,
        amount_in_cents:      amountInCents,
        stripe_transfer_id:   stripeTransferId,
        idempotency_key:      idempotencyKey,
        released_by_role:     profile.role,
      },
    })

    // ── STEP 7.5: Notify contractor that release was authorized ───────────
    // Fire-and-forget — must not block or fail the release response.
    void notifyReleaseAuthorized({
      releaseId:   releaseRecord.id,
      milestoneId: milestoneId,
      dealId:      milestone.deal_id,
      funderId:    user.id,
      amount:      fee.grossAmount,
    })

    // ── STEP 8: Generate Transaction Receipt ───────────────────────────────
    // Non-blocking: failure here MUST NOT abort the release response.
    // The Stripe transfer has already succeeded — we just add a receipt record.
    const releasedAt        = new Date().toISOString()
    const contractorName    = contractorProfile.company_name ?? contractorProfile.full_name ?? 'Contractor'
    const funderName        = funderProfile?.company_name ?? funderProfile?.full_name ?? 'Funder'

    const receipt = await createTransactionReceipt({
      releaseId:        releaseRecord.id,
      milestoneId,
      dealId:           milestone.deal_id,
      billingRecordId:  null,    // billing_record_id is nullable; receipt links via release_id
      grossAmount:      fee.grossAmount,
      feeAmount:        fee.feeAmount,
      feeBps:           fee.billingRateBps,
      totalCharged:     fee.totalDebit,
      stripeTransferId: stripeTransferId,
      contractorId:     deal.contractor_id,
      funderId:         deal.funder_id!,
      contractorName,
      funderName,
      dealTitle:        deal.title,
      milestoneTitle:   milestone.title,
      releasedAt,
      // Receipt email will note the retainage withheld, if any
    })

    // ── STEP 8.5: Send Receipt Emails (fire-and-forget) ──────────────────
    if (receipt) {
      // Fetch emails for notifications — best-effort, errors are non-fatal
      const adminForEmails = createSupabaseAdminClient()
      const emailPromises  = await Promise.allSettled([
        adminForEmails.auth.admin.getUserById(deal.contractor_id),
        deal.funder_id ? adminForEmails.auth.admin.getUserById(deal.funder_id) : Promise.resolve({ data: { user: null }, error: null }),
      ])

      const contractorEmail = emailPromises[0].status === 'fulfilled'
        ? (emailPromises[0].value.data?.user?.email ?? '')
        : ''
      const funderEmail     = emailPromises[1].status === 'fulfilled'
        ? (emailPromises[1].value.data?.user?.email ?? '')
        : ''

      if (contractorEmail && funderEmail) {
        notifyTransactionReceipt(
          {
            receiptId:        receipt.id,
            receiptNumber:    receipt.receipt_number,
            milestoneTitle:   milestone.title,
            dealTitle:        deal.title,
            dealId:           milestone.deal_id,
            grossAmount:      fee.grossAmount,
            feeAmount:        fee.feeAmount,
            feeBps:           fee.billingRateBps,
            totalCharged:     fee.totalDebit,
            stripeTransferId: stripeTransferId,
            releasedAt,
            contractorName,
            funderName,
          },
          contractorEmail,
          funderEmail,
        ).then(() => markReceiptEmailSent(receipt.id)).catch(console.error)
      }
    }

    return NextResponse.json({
      success: true,
      release: {
        milestone_id:       milestoneId,
        deal_id:            milestone.deal_id,
        stripe_transfer_id: stripeTransferId,
        idempotency_key:    idempotencyKey,
        released_by:        user.id,
        released_at:        releasedAt,
        receipt: receipt ? {
          id:             receipt.id,
          receipt_number: receipt.receipt_number,
        } : null,
        billing: {
          gross_amount:         fee.grossAmount,
          fee_amount:           fee.feeAmount,
          retainage_amount:     retainage.retainageAmount,
          retainage_percentage: retainage.retainagePercentage,
          net_to_contractor:    netToContractor,
          billing_rate_bps:     fee.billingRateBps,
          rate_label:           fee.rateLabel,
          total_debit:          fee.totalDebit,
        },
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // ── Cancel the reservation if Stripe never completed ──────────────────────
    // If stripeTransferId is null, the transfer either failed or was never
    // attempted. In either case no money moved, so we can safely free the
    // reservation and restore the deal's available balance.
    //
    // If stripeTransferId is set, Stripe succeeded but a DB step failed.
    // We do NOT cancel the reservation here — the funds have actually moved,
    // and support must reconcile the partial state. Cancelling would make
    // the deal's reserved_amount inaccurate relative to what Stripe holds.
    if (!stripeTransferId && reservationMade) {
      try {
        await supabase.rpc('cancel_release_reservation', {
          p_deal_id: milestone.deal_id,
          p_gross:   fee.grossAmount,
          p_fee:     fee.feeAmount,
        })
      } catch (cancelErr) {
        // Non-fatal: log but do not mask the original error.
        // A stale reserved_amount will be detected by the reconciliation engine.
        console.error('[release] cancel_release_reservation failed:', cancelErr)
      }
    }

    // Log the failure with as much context as possible
    await logAudit({
      entity_type: 'milestone',
      entity_id: milestoneId,
      action: 'release_failed',
      actor_id: user.id,
      old_values: null,
      new_values: null,
      metadata: {
        error:                message,
        stripe_transfer_id:   stripeTransferId,
        idempotency_key:      idempotencyKey,
        gross_amount:         fee.grossAmount,
        retainage_amount:     retainage.retainageAmount,
        net_to_contractor:    netToContractor,
        reservation_made:     reservationMade,
        reservation_cancelled: !stripeTransferId && reservationMade,
      },
    })

    if (stripeTransferId) {
      // Stripe transfer succeeded but a subsequent DB step failed.
      // The reservation was NOT cancelled — support must reconcile.
      return internalError(
        `A Stripe transfer was completed (ID: ${stripeTransferId}) but a subsequent database operation failed. ` +
          `Contact support immediately with this transfer ID to prevent partial state. ` +
          `Milestone ID: ${milestoneId}.`,
        message,
      )
    }

    // Stripe itself failed (or was never called) — no money moved.
    // Reservation has been cancelled; the deal's balance is restored.
    return internalError(
      'The Stripe transfer could not be completed. No funds have been moved. ' +
        'Please try again. If this problem persists, contact support.',
      message,
    )
  }
}

