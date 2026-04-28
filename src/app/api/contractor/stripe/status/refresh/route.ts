import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { getStripe } from '@/lib/stripe'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── POST /api/contractor/stripe/status/refresh ───────────────────────────────
// Pulls the current Stripe account status directly from Stripe and syncs it
// to profiles.stripe_payouts_enabled.
//
// Use case: profiles.stripe_payouts_enabled can become stale if the
// account.updated webhook was not delivered (dev environment, misconfigured
// endpoint, temporary Stripe delivery failure). This endpoint lets a contractor
// re-sync without waiting for the next webhook delivery.
//
// Safety constraints:
//   - Requires authenticated user with role 'contractor'.
//   - Reads stripe_account_id from the authenticated user's profile only —
//     never from the request body (prevents account enumeration).
//   - Calls Stripe accounts.retrieve() server-side (STRIPE_SECRET_KEY never
//     exposed to the client).
//   - Updates only stripe_payouts_enabled (same field as the webhook handler).
//   - Uses the same computation as handleAccountUpdated:
//       detailsSubmitted && payoutsEnabled && chargesEnabled.
//   - Audit logged as 'stripe_status_refreshed'.

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try {
    requireRole(profile, 'contractor')
  } catch (err) {
    return err as NextResponse
  }

  // ── Validate Stripe is configured ──────────────────────────────────────────
  let stripe
  try {
    stripe = getStripe()
  } catch {
    return internalError(
      'Stripe is not configured on this server. Please contact support.',
    )
  }

  // ── Read stored stripe_account_id — never from client ──────────────────────
  const stripeAccountId = profile.stripe_account_id

  if (!stripeAccountId) {
    return errorResponse(
      422,
      'No Stripe account is linked to your profile. Complete Stripe Connect onboarding first.',
    )
  }

  // ── Fetch live account status from Stripe ───────────────────────────────────
  let account
  try {
    account = await stripe.accounts.retrieve(stripeAccountId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[contractor/stripe/status/refresh] Stripe accounts.retrieve failed:', message)
    return internalError(
      'Could not fetch your Stripe account status. Please try again in a moment.',
      message,
    )
  }

  // ── Compute new status — same logic as the account.updated webhook handler ──
  const detailsSubmitted = account.details_submitted ?? false
  const payoutsEnabled   = account.payouts_enabled   ?? false
  const chargesEnabled   = account.charges_enabled   ?? false
  const newPayoutsEnabled = detailsSubmitted && payoutsEnabled && chargesEnabled

  const oldPayoutsEnabled = profile.stripe_payouts_enabled

  // ── Persist to profile ──────────────────────────────────────────────────────
  const admin = createSupabaseAdminClient()

  const { error: updateError } = await admin
    .from('profiles')
    .update({
      stripe_payouts_enabled: newPayoutsEnabled,
      updated_at:             new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('[contractor/stripe/status/refresh] profile update failed:', updateError.message)
    return internalError(
      'Could not update your Stripe status. Please try again.',
      updateError.message,
    )
  }

  // ── Audit (fire-and-forget — never blocks the response) ────────────────────
  logAudit({
    entity_type: 'profile',
    entity_id:   user.id,
    action:      'stripe_status_refreshed',
    actor_id:    user.id,
    old_values:  { stripe_payouts_enabled: oldPayoutsEnabled },
    new_values:  { stripe_payouts_enabled: newPayoutsEnabled },
    metadata: {
      stripe_account_id:  stripeAccountId,
      details_submitted:  detailsSubmitted,
      charges_enabled:    chargesEnabled,
      payouts_enabled:    payoutsEnabled,
      triggered_by:       'manual_refresh',
    },
  }).catch(() => { /* audit failure must never block the 200 response */ })

  return NextResponse.json({
    stripe_payouts_enabled: newPayoutsEnabled,
    details_submitted:      detailsSubmitted,
    charges_enabled:        chargesEnabled,
    stripe_account_id:      stripeAccountId.slice(0, 8) + '…',
  })
}
