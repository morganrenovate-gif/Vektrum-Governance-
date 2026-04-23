import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { validateRelease, checkAiPrecondition } from '@/lib/engine/release-gate'
import { calculateFee, toStripeCents } from '@/lib/engine/billing'
import { createTransactionReceipt, markReceiptEmailSent } from '@/lib/engine/receipts'
import { notifyTransactionReceipt } from '@/lib/engine/notifications'
import { stripe } from '@/lib/stripe'
import { internalError, notFoundError, validationError } from '@/lib/errors'

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
  const supabase = await createClient()

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
    .select('id, title, contractor_id, funder_id, funded_amount, released_amount, fees_collected, billing_rate_bps, total_amount')
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

  // ── STEP 0: AI Draw Review Precondition ─────────────────────────────────────
  const aiCheck = await checkAiPrecondition(milestoneId, supabase)
  if (!aiCheck.passed) {
    return NextResponse.json(
      { error: aiCheck.reason },
      { status: 422 },
    )
  }

  // ── STEP 1: Run Release Gate (all 8 conditions + role check) ────────────────
  const releaseValidation = await validateRelease(supabase, milestoneId, profile)

  if (!releaseValidation.allowed) {
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

  // ── STEP 1.5: Calculate Platform Fee ────────────────────────────────────────
  // Fee is computed server-side, never passed from the client.
  // billing_rate_bps comes from the deal row — set at deal creation from the funder's plan.
  const fee = calculateFee(milestone.amount, deal.billing_rate_bps)

  // ── STEP 2: Generate Idempotency Key ────────────────────────────────────────
  // Stable idempotency key — milestone_id is a UUID so this is globally unique per milestone.
  // Using Date.now() would create a new key on each retry, defeating idempotency entirely.
  const idempotencyKey = `release_${milestoneId}`

  // ── Amount in Cents ─────────────────────────────────────────────────────────
  // Stripe transfer = gross (contractor receives full milestone amount).
  // Fee is retained naturally in the platform Stripe account.
  const amountInCents = toStripeCents(milestone.amount)

  // ── STEPS 3–7: Wrapped in a Single Try/Catch ────────────────────────────────
  // If Stripe fails → no DB writes occur.
  // If DB writes fail after Stripe succeeds → return 500 with Stripe transfer ID
  // so that support can reconcile the partial state.

  let stripeTransferId: string | null = null

  try {
    // ── STEP 3: Stripe Transfer ─────────────────────────────────────────────
    const transfer = await stripe.transfers.create(
      {
        amount: amountInCents,
        currency: 'usd',
        destination: contractorProfile.stripe_account_id,
        transfer_group: milestone.deal_id,
        metadata: {
          milestone_id: milestoneId,
          deal_id: milestone.deal_id,
          contractor_id: deal.contractor_id,
          vektrum_action: 'milestone_release',
          idempotency_key: idempotencyKey,
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
        net_amount:         fee.netAmount,
        stripe_transfer_id: stripeTransferId,
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
    const { data: milestoneUpdateData, error: milestoneUpdateError } = await supabase
      .from('milestones')
      .update({
        status: 'released',
        protection_status: 'released',
        updated_at: new Date().toISOString(),
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

    // ── STEP 6: Update deal.released_amount + fees_collected (atomic RPC) ─
    // increment_deal_financials atomically increments both columns and guards
    // against exceeding the funded balance in a single UPDATE … WHERE clause.
    const { error: dealUpdateError } = await supabase.rpc(
      'increment_deal_financials',
      {
        p_deal_id:         milestone.deal_id,
        p_released_amount: fee.grossAmount,
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
          released_amount_increment: fee.grossAmount,
          fee_amount_increment:      fee.feeAmount,
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
      },
      metadata: {
        deal_id:            milestone.deal_id,
        contractor_id:      deal.contractor_id,
        gross_amount:       fee.grossAmount,
        fee_amount:         fee.feeAmount,
        net_amount:         fee.netAmount,
        billing_rate_bps:   fee.billingRateBps,
        total_debit:        fee.totalDebit,
        amount_in_cents:    amountInCents,
        stripe_transfer_id: stripeTransferId,
        idempotency_key:    idempotencyKey,
        released_by_role:   profile.role,
      },
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
          gross_amount:     fee.grossAmount,
          fee_amount:       fee.feeAmount,
          net_amount:       fee.netAmount,
          billing_rate_bps: fee.billingRateBps,
          rate_label:       fee.rateLabel,
          total_debit:      fee.totalDebit,
        },
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // Log the failure with as much context as possible
    await logAudit({
      entity_type: 'milestone',
      entity_id: milestoneId,
      action: 'release_failed',
      actor_id: user.id,
      old_values: null,
      new_values: null,
      metadata: {
        error: message,
        stripe_transfer_id: stripeTransferId,
        idempotency_key: idempotencyKey,
      },
    })

    if (stripeTransferId) {
      // Stripe transfer succeeded but a subsequent DB step failed
      return internalError(
        `A Stripe transfer was completed (ID: ${stripeTransferId}) but a subsequent database operation failed. ` +
          `Contact support immediately with this transfer ID to prevent partial state. ` +
          `Milestone ID: ${milestoneId}.`,
        message,
      )
    }

    // Stripe itself failed — no money moved, no DB writes needed
    return internalError(
      'The Stripe transfer could not be completed. No funds have been moved. ' +
        'Please try again. If this problem persists, contact support.',
      message,
    )
  }
}

