import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { getStripe } from '@/lib/stripe'
import { internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── POST /api/stripe/connect ─────────────────────────────────────────────────
// Initiates or resumes Stripe Connect Express onboarding for a contractor/funder.
//
// Behaviour:
//   1. If the user already has a stripe_account_id, generates a new
//      account link for that existing account (resumable onboarding).
//   2. If no Stripe account exists yet, creates a new Express account and
//      stores the ID on the profile, then generates the onboarding link.
//
// Returns: { url } — the Stripe-hosted onboarding URL. Redirect the user to it.
//
// After the user completes onboarding, Stripe fires an `account.updated` webhook
// which updates stripe_payouts_enabled on the profile.

export async function POST(request: NextRequest) {
  console.log('[stripe/connect] STRIPE_SECRET_KEY prefix:', process.env.STRIPE_SECRET_KEY?.slice(0, 12))

  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try {
    requireRole(profile, 'contractor', 'funder', 'admin')
  } catch (err) {
    return err as NextResponse
  }

  // ── Validate Stripe secret key early ──────────────────────────────────────
  let stripe
  try {
    stripe = getStripe()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/stripe/connect] Stripe initialization failed:', message)
    return internalError(
      'Stripe is not configured on this server. Please contact support.',
      message,
    )
  }

  // ── Fetch email from auth.users (profiles has no email column) ────────────
  const supabase = createSupabaseAdminClient()

  let userEmail: string | undefined
  try {
    const { data: authUser, error: authError } =
      await supabase.auth.admin.getUserById(user.id)
    if (authError) {
      console.error('[api/stripe/connect] Failed to fetch auth user:', authError.message)
    } else {
      userEmail = authUser?.user?.email ?? undefined
    }
  } catch (err) {
    console.error('[api/stripe/connect] Unexpected error fetching auth user:', err)
  }

  // ── Resolve or Create Stripe Account ───────────────────────────────────────
  let stripeAccountId = profile.stripe_account_id

  if (!stripeAccountId) {
    let account

    try {
      account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        ...(userEmail ? { email: userEmail } : {}),
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          vektrum_user_id: user.id,
          vektrum_role: profile.role,
        },
      })
    } catch (stripeError: unknown) {
      console.error('[stripe/connect] error:', JSON.stringify(stripeError, null, 2))
      const err = stripeError as { message?: string; code?: string; type?: string }
      return NextResponse.json(
        {
          error: 'Could not create a Stripe Connect account',
          stripe_error_code: err.code,
          stripe_error_type: err.type,
        },
        { status: 500 },
      )
    }

    stripeAccountId = account.id
    console.log(`[api/stripe/connect] Created Stripe account ${stripeAccountId} for user ${user.id}`)

    // Persist the Stripe account ID to the profile immediately (service role — bypasses RLS)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_account_id: stripeAccountId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[api/stripe/connect] Failed to persist stripe_account_id:', updateError.message)
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
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vektrum.io'

  // Route back to the role-appropriate settings page after Stripe onboarding
  const returnPath = '/dashboard/settings'
  const returnUrl = `${appBaseUrl}${returnPath}?stripe=success`
  const refreshUrl = `${appBaseUrl}${returnPath}?stripe=refresh`

  let accountLink

  try {
    accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    })
  } catch (stripeError: unknown) {
    console.error('[stripe/connect] error:', JSON.stringify(stripeError, null, 2))
    const err = stripeError as { message?: string; code?: string; type?: string }
    return NextResponse.json(
      {
        error: 'Could not create a Stripe Connect account',
        stripe_error_code: err.code,
        stripe_error_type: err.type,
      },
      { status: 500 },
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
