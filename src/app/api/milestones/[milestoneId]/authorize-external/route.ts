import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess, requireMFA } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { validateRelease, checkAiPrecondition } from '@/lib/engine/release-gate'
import { calculateFee, calculateRetainage } from '@/lib/engine/billing'
import { deliverPartnerWebhook } from '@/lib/engine/partner-webhook'
import { internalError, notFoundError, validationError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── POST /api/milestones/[milestoneId]/authorize-external ───────────────────
//
// PHASE-1 RAIL-ABSTRACTION ENDPOINT — External/manual payment authorization.
//
// What this does (and what it does NOT do):
//
//   ✅ Runs the identical 10-condition release gate (minus Condition 4, which
//      is Stripe-Connect-specific — contractor_stripe_payouts_enabled).
//   ✅ Authorises the release (milestone approved → released) so the contractor
//      is legally cleared to be paid for this milestone.
//   ✅ Writes an immutable release record with execution_rail='external_manual'
//      and execution_status='pending' — representing "governance authorised,
//      funds not yet confirmed on the external rail".
//   ✅ Reserves the funded balance via reserve_release_funds so a second
//      concurrent authorisation cannot double-authorise the same capacity.
//
//   ❌ Does NOT call Stripe.
//   ❌ Does NOT touch contractor Stripe Connect accounts.
//   ❌ Does NOT write a billing_records row (deferred to confirm-external).
//   ❌ Does NOT increment released_amount / fees_collected / retainage_held
//      on the deal (deferred to confirm-external to keep the ledger truthful
//      while funds are only authorised, not yet executed).
//
// Legal framing: Vektrum is governance infrastructure. Vektrum authorises the
// release. The funder (or their escrow/title/treasury partner) executes the
// payment OUTSIDE Vektrum. Vektrum records confirmation via confirm-external.
// Vektrum never holds, collects, forwards, or transmits funds on this rail.
//
// Caller: funder of the deal only (enforced by validateRelease).
// AAL: MFA required (requireMFA) — same bar as Stripe releases.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> },
) {
  const { milestoneId } = await params

  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const supabase = await createClient()

  // ── MFA Guard ───────────────────────────────────────────────────────────────
  try {
    await requireMFA(supabase, profile)
  } catch (err) {
    return err as NextResponse
  }

  // ── Fetch milestone ────────────────────────────────────────────────────────
  const { data: milestone, error: milestoneError } = await supabase
    .from('milestones')
    .select('id, deal_id, amount, status, protection_status, title')
    .eq('id', milestoneId)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(
      `Milestone ${milestoneId} was not found. Verify the milestone ID and try again.`,
    )
  }

  // ── Fetch deal ──────────────────────────────────────────────────────────────
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select(
      'id, title, contractor_id, funder_id, funded_amount, released_amount, fees_collected, reserved_amount, billing_rate_bps, total_amount, retainage_percentage, partner_id',
    )
    .eq('id', milestone.deal_id)
    .single()

  if (dealError || !deal) {
    return notFoundError(
      `The deal associated with milestone ${milestoneId} could not be found.`,
    )
  }

  // ── Deal access ─────────────────────────────────────────────────────────────
  try {
    await requireDealAccess(supabase, milestone.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── STEP 0: AI draw-review precondition ────────────────────────────────────
  // Identical bar to the Stripe rail — rail choice does not relax AI review.
  const aiCheck = await checkAiPrecondition(milestoneId, supabase)
  if (!aiCheck.passed) {
    return NextResponse.json({ error: aiCheck.reason }, { status: 422 })
  }

  // ── STEP 1: Release gate (10 conditions, rail-aware) ───────────────────────
  // executionRail='external_manual' tells the gate to skip Condition 4
  // (contractor Stripe Connect payouts enabled). All other 9 conditions apply.
  const releaseValidation = await validateRelease(supabase, milestoneId, profile, {
    executionRail: 'external_manual',
  })

  if (!releaseValidation.allowed) {
    return validationError(releaseValidation.errors)
  }

  // A deal must have a funder — should be caught by requireDealAccess but
  // guard here explicitly because billing record references funder_id at
  // confirmation time.
  if (!deal.funder_id) {
    return internalError(
      'This deal has no funder assigned. External authorization cannot proceed without a funder-of-record.',
    )
  }

  // ── STEP 1.5: Derive fee + retainage (recorded on the release row only) ────
  // Computed server-side, identical math to the Stripe path. Stored on the
  // release record so confirmation cannot later disagree about the split.
  const fee       = calculateFee(milestone.amount, deal.billing_rate_bps)
  const retainage = calculateRetainage(milestone.amount, deal.retainage_percentage ?? 0)
  const netToContractor = retainage.netToContractor

  // Stable key per milestone — used to detect duplicate authorisations.
  const idempotencyKey = `release_${milestoneId}`

  // ── STEP 2: Reserve funded balance (concurrency gate) ──────────────────────
  // Even though no money moves at this step, we MUST reserve the capacity so
  // two concurrent external-rail authorisations on the same deal cannot both
  // pass the funded-balance check. The reservation is later settled (moved
  // from reserved_amount to released_amount + retainage_held) by the
  // confirm-external endpoint, or freed by mark-external-failed.
  const { data: reservationRows, error: reservationError } = await supabase.rpc(
    'reserve_release_funds',
    {
      p_deal_id: milestone.deal_id,
      p_gross:   fee.grossAmount,
      p_fee:     fee.feeAmount,
    },
  )

  if (reservationError) {
    const isLockConflict = reservationError.code === '55P03'
    await logAudit({
      entity_type: 'milestone',
      entity_id:   milestoneId,
      action:      'external_release_reservation_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        deal_id:          milestone.deal_id,
        gross_amount:     fee.grossAmount,
        fee_amount:       fee.feeAmount,
        is_lock_conflict: isLockConflict,
        error:            reservationError.message,
        error_code:       reservationError.code,
        execution_rail:   'external_manual',
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

  // Reservation acquired. From here, any non-success path must cancel it.
  let reservationMade = true
  let releaseInsertedId: string | null = null

  try {
    // ── STEP 3: Insert release row (pending external execution) ─────────────
    // Uses admin client so we can reliably re-read the inserted row by
    // execution_status='pending' (RLS on the user client would filter it).
    const adminClient = createSupabaseAdminClient()

    const { error: releaseInsertError } = await adminClient
      .from('releases')
      .insert({
        milestone_id:        milestoneId,
        deal_id:             milestone.deal_id,
        amount:              milestone.amount,
        stripe_transfer_id:  null,                    // CHECK constraint: external rail forbids stripe_transfer_id
        idempotency_key:     idempotencyKey,
        released_by:         user.id,
        execution_rail:      'external_manual',
        execution_status:    'pending',
      })

    if (releaseInsertError) {
      await logAudit({
        entity_type: 'release',
        entity_id:   milestoneId,
        action:      'external_release_insert_failed',
        actor_id:    user.id,
        old_values:  null,
        new_values:  null,
        metadata: {
          idempotency_key: idempotencyKey,
          execution_rail:  'external_manual',
          error:           releaseInsertError.message,
        },
      })

      throw new Error(`external release insert failed: ${releaseInsertError.message}`)
    }

    // Re-read the inserted release so we can return its id. Filter by
    // execution_status='pending' — a retry on the same milestone could leave
    // prior failed rows; we want the row this request just inserted.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: releaseRecord, error: releaseSelectError } = await (adminClient as any)
      .from('releases')
      .select('id')
      .eq('milestone_id', milestoneId)
      .eq('execution_rail', 'external_manual')
      .eq('execution_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (releaseSelectError || !releaseRecord) {
      throw new Error(
        `external release re-read failed: ${releaseSelectError?.message ?? 'row not found'}`,
      )
    }
    releaseInsertedId = releaseRecord.id

    // ── STEP 4: Transition milestone approved → released ────────────────────
    // The milestone status means "governance has authorised release", which
    // is true as soon as the gate passes and a release row exists. The DB
    // trigger enforce_milestone_status_transition allows approved → released.
    //
    // Deferred work (all handled by confirm-external):
    //   - billing_records insert
    //   - increment_deal_financials (released_amount / fees_collected)
    //   - increment_deal_retainage  (retainage_held)
    //   - transaction receipts + notifications
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
      throw new Error(`milestone status update failed: ${milestoneUpdateError.message}`)
    }

    if (!milestoneUpdateData || milestoneUpdateData.length === 0) {
      // Concurrent authorization — a prior request already flipped the row.
      // No money moved (external rail), so we can safely abort.
      await logAudit({
        entity_type: 'milestone',
        entity_id:   milestoneId,
        action:      'external_release_concurrent_conflict',
        actor_id:    user.id,
        old_values:  null,
        new_values:  null,
        metadata: {
          idempotency_key: idempotencyKey,
          execution_rail:  'external_manual',
          note:            'Milestone was no longer in approved status — likely concurrent authorisation.',
        },
      })

      return NextResponse.json(
        {
          error:
            'This milestone has already been authorised by a concurrent request. ' +
            'Refresh to see the current state.',
        },
        { status: 409 },
      )
    }

    // ── STEP 5: Audit log (success) ────────────────────────────────────────
    // Critical: this is the permanent authorization evidence. It pairs later
    // with the confirmation audit log entry to form the full external-rail
    // disbursement trail.
    await logAudit({
      entity_type: 'milestone',
      entity_id:   milestoneId,
      action:      'external_release_authorized',
      actor_id:    user.id,
      old_values: {
        status:            milestone.status,
        protection_status: milestone.protection_status,
      },
      new_values: {
        status:            'released',
        protection_status: 'released',
        retainage_amount:  retainage.retainageAmount,
        execution_rail:    'external_manual',
        execution_status:  'pending',
      },
      metadata: {
        deal_id:              milestone.deal_id,
        contractor_id:        deal.contractor_id,
        funder_id:            deal.funder_id,
        release_id:           releaseInsertedId,
        gross_amount:         fee.grossAmount,
        fee_amount:           fee.feeAmount,
        retainage_amount:     retainage.retainageAmount,
        retainage_percentage: retainage.retainagePercentage,
        net_to_contractor:    netToContractor,
        billing_rate_bps:     fee.billingRateBps,
        total_debit:          fee.totalDebit,
        idempotency_key:      idempotencyKey,
        authorised_by_role:   profile.role,
        execution_rail:       'external_manual',
        execution_status:     'pending',
        // Explicit statement of invariant for audit reviewers
        ledger_deferred:      true,
        billing_deferred:     true,
        stripe_transfer:      null,
      },
    })

    // Success — reservation will be settled (or freed) by a downstream
    // confirm-external / mark-external-failed call. Do not cancel here.
    reservationMade = false

    // ── STEP 6: Fire partner webhook (non-fatal, fire-and-forget) ───────────
    // If this deal has an institutional partner assigned, deliver the signed
    // authorization signal so they can execute payment on their own rail.
    // deliverPartnerWebhook never throws and never blocks the response.
    deliverPartnerWebhook(
      milestone.deal_id,
      {
        event:             'release.authorized',
        api_version:       '2026-04-25',
        release_id:        releaseInsertedId!,
        deal_id:           milestone.deal_id,
        deal_title:        deal.title,
        milestone_id:      milestoneId,
        milestone_title:   milestone.title,
        amount:            fee.grossAmount,
        fee_amount:        fee.feeAmount,
        retainage_amount:  retainage.retainageAmount,
        net_to_contractor: netToContractor,
        contractor_id:     deal.contractor_id,
        funder_id:         deal.funder_id!,
        authorized_at:     new Date().toISOString(),
        authorized_by:     user.id,
        idempotency_key:   idempotencyKey,
      },
      user.id,
    ).catch((err) => {
      console.error('[authorize-external] deliverPartnerWebhook rejected unexpectedly:', err)
    })

    return NextResponse.json({
      success: true,
      releaseId: releaseInsertedId,
      nextAction: 'awaiting_external_confirmation',
      release: {
        milestone_id:     milestoneId,
        deal_id:          milestone.deal_id,
        execution_rail:   'external_manual',
        execution_status: 'pending',
        amount:           milestone.amount,
        authorised_by:    user.id,
        authorised_at:    new Date().toISOString(),
      },
      billing: {
        // Reported for UX — NOT yet committed to billing_records.
        gross_amount:         fee.grossAmount,
        fee_amount:           fee.feeAmount,
        retainage_amount:     retainage.retainageAmount,
        retainage_percentage: retainage.retainagePercentage,
        net_to_contractor:    netToContractor,
        billing_rate_bps:     fee.billingRateBps,
        rate_label:           fee.rateLabel,
        total_debit:          fee.totalDebit,
        committed:            false,
        note:
          'Fee and retainage are committed to billing_records only when the funder records external execution via /confirm-external.',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // No Stripe transfer happened on this rail, so it is always safe to free
    // the reservation and restore the deal's available balance.
    if (reservationMade) {
      try {
        await supabase.rpc('cancel_release_reservation', {
          p_deal_id: milestone.deal_id,
          p_gross:   fee.grossAmount,
          p_fee:     fee.feeAmount,
        })
      } catch (cancelErr) {
        console.error('[authorize-external] cancel_release_reservation failed:', cancelErr)
      }
    }

    await logAudit({
      entity_type: 'milestone',
      entity_id:   milestoneId,
      action:      'external_release_authorization_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        error:               message,
        idempotency_key:     idempotencyKey,
        release_id:          releaseInsertedId,
        gross_amount:        fee.grossAmount,
        retainage_amount:    retainage.retainageAmount,
        net_to_contractor:   netToContractor,
        reservation_made:    reservationMade,
        reservation_cancelled: reservationMade,
        execution_rail:      'external_manual',
      },
    })

    return internalError(
      'External release authorisation failed. No money was moved. Please try again.',
      message,
    )
  }
}
