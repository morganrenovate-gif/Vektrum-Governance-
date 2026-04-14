import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { stripe } from '@/lib/stripe'
import { errorResponse, internalError } from '@/lib/errors'

// ─── POST /api/stripe/connect ─────────────────────────────────────────────────
// Initiates or resumes Stripe Connect Express onboarding for a contractor.
//
// Behaviour:
//   1. If the contractor already has a stripe_account_id, generates a new
//      account link for that existing account (resumable onboarding).
//   2. If no Stripe account exists yet, creates a new Express account and
//      stores the ID on the profile, then generates the onboarding link.
//
// Returns: { url } — the Stripe-hosted onboarding URL. Redirect the user to it.
//
// After the user completes onboarding, Stripe fires an `account.updated` webhook
// which updates stripe_payouts_enabled on the profile.

export async function POST(request: NextRequest) {
  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try {
    requireRole(profile, 'contractor', 'admin')
  } catch (err) {
    return err as NextResponse
  }

  const supabase = buildSupabaseFromRequest(request)

  // ── Resolve or Create Stripe Account ───────────────────────────────────────
  let stripeAccountId = profile.stripe_account_id

  if (!stripeAccountId) {
    // Create a new Stripe Express account for this contractor
    let account

    try {
      account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          vektrum_user_id: user.id,
          vektrum_role: 'contractor',
        },
      })
    } catch (stripeError) {
      const message =
        stripeError instanceof Error ? stripeError.message : String(stripeError)
      return internalError(
        'Could not create a Stripe Connect account. Please try again. If this problem persists, contact support.',
        message,
      )
    }

    stripeAccountId = account.id

    // Persist the Stripe account ID to the profile immediately
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_account_id: stripeAccountId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (updateError) {
      // The Stripe account was created but we couldn't save the ID — log and surface to support
      return internalError(
        `A Stripe account was created (ID: ${stripeAccountId}) but could not be linked to your profile. ` +
          'Contact support immediately with this Stripe account ID so your account can be manually linked.',
        updateError.message,
      )
    }

    await logAudit({
      entity_type: 'profile',
      entity_id: user.id,
      action: 'stripe_account_created',
      actor_id: user.id,
      old_values: { stripe_account_id: null },
      new_values: { stripe_account_id: stripeAccountId },
      metadata: { stripe_account_type: 'express' },
    })
  }

  // ── Generate Account Link ───────────────────────────────────────────────────
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  let accountLink

  try {
    accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${appBaseUrl}/dashboard/onboarding?refresh=true`,
      return_url: `${appBaseUrl}/dashboard/onboarding?success=true`,
      type: 'account_onboarding',
    })
  } catch (stripeError) {
    const message =
      stripeError instanceof Error ? stripeError.message : String(stripeError)
    return internalError(
      'Could not generate the Stripe onboarding link. Please try again. If this problem persists, contact support.',
      message,
    )
  }

  await logAudit({
    entity_type: 'profile',
    entity_id: user.id,
    action: 'stripe_account_link_generated',
    actor_id: user.id,
    old_values: null,
    new_values: null,
    metadata: {
      stripe_account_id: stripeAccountId,
      link_type: 'account_onboarding',
      expires_at: accountLink.expires_at,
    },
  })

  return NextResponse.json({
    url: accountLink.url,
    expires_at: accountLink.expires_at,
    stripe_account_id: stripeAccountId,
  })
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
