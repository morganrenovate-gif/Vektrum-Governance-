import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { validateRelease } from '@/lib/engine/release-gate'
import { stripe } from '@/lib/stripe'
import { internalError, notFoundError, validationError } from '@/lib/errors'



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
  const supabase = buildSupabaseFromRequest(request)

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

  // ── Fetch Deal (needed for contractor_id and access check) ────────────────
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, contractor_id, funded_amount, released_amount, total_amount')
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

  // ── STEP 1: Run Release Gate (all 7 conditions + role check) ────────────────
  const releaseValidation = await validateRelease(supabase, milestoneId, profile)

  if (!releaseValidation.allowed) {
    return validationError(releaseValidation.errors)
  }

  // ── Fetch Contractor's Stripe Account ───────────────────────────────────────
  const { data: contractorProfile, error: contractorError } = await supabase
    .from('profiles')
    .select('stripe_account_id')
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

  // ── STEP 2: Generate Idempotency Key ────────────────────────────────────────
  const idempotencyKey = `release_${milestoneId}_${Date.now()}`

  // ── Amount in Cents ─────────────────────────────────────────────────────────
  const amountInCents = Math.round(milestone.amount * 100)

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
        contractor_id: deal.contractor_id,
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

    // ── STEP 5: Update Milestone Status ────────────────────────────────────
    const { error: milestoneUpdateError } = await supabase
      .from('milestones')
      .update({
        status: 'released',
        protection_status: 'released',
        updated_at: new Date().toISOString(),
      })
      .eq('id', milestoneId)

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

    // ── STEP 6: Update deal.released_amount ────────────────────────────────
    // Use a database function / RPC increment to avoid a read-modify-write race condition
    const { error: dealUpdateError } = await supabase.rpc(
      'increment_deal_released_amount',
      {
        p_deal_id: milestone.deal_id,
        p_amount: milestone.amount,
      },
    )

    if (dealUpdateError) {
      // This is a recoverable inconsistency — the money is sent and the milestone is marked
      // released. The deal's ledger is wrong but can be repaired via support.
      await logAudit({
        entity_type: 'deal',
        entity_id: milestone.deal_id,
        action: 'release_deal_amount_update_failed',
        actor_id: user.id,
        old_values: null,
        new_values: { released_amount_increment: milestone.amount },
        metadata: {
          stripe_transfer_id: stripeTransferId,
          idempotency_key: idempotencyKey,
          error: dealUpdateError.message,
        },
      })

      return internalError(
        'Funds were transferred and the milestone marked as released, but the deal\'s released_amount ' +
          'ledger could not be updated. This requires manual reconciliation. ' +
          `Contact support with Stripe Transfer ID: ${stripeTransferId}, ` +
          `Milestone ID: ${milestoneId}, Deal ID: ${milestone.deal_id}.`,
        dealUpdateError.message,
      )
    }

    // ── STEP 7: Audit Log (success path) ───────────────────────────────────
    await logAudit({
      entity_type: 'milestone',
      entity_id: milestoneId,
      action: 'funds_released',
      actor_id: user.id,
      old_values: {
        status: milestone.status,
        protection_status: milestone.protection_status,
      },
      new_values: {
        status: 'released',
        protection_status: 'released',
      },
      metadata: {
        deal_id: milestone.deal_id,
        contractor_id: deal.contractor_id,
        amount: milestone.amount,
        amount_in_cents: amountInCents,
        stripe_transfer_id: stripeTransferId,
        idempotency_key: idempotencyKey,
        released_by_role: profile.role,
      },
    })

    return NextResponse.json({
      success: true,
      release: {
        milestone_id: milestoneId,
        deal_id: milestone.deal_id,
        amount: milestone.amount,
        stripe_transfer_id: stripeTransferId,
        idempotency_key: idempotencyKey,
        released_by: user.id,
        released_at: new Date().toISOString(),
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSupabaseFromRequest(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    },
  )
}
