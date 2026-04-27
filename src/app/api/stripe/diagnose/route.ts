import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { getStripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // ── Admin auth gate ────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  try {
    requireRole(authContext.profile, 'admin')
  } catch (err) {
    return err as NextResponse
  }

  // ── Diagnostics ────────────────────────────────────────────────────────────
  // Never expose any fragment of the secret key in the response. Booleans
  // are sufficient to diagnose configuration without leaking key material.
  const keySet           = !!process.env.STRIPE_SECRET_KEY
  const keyLooksLikeLive = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ?? false

  let listSuccess = false
  let listError: string | null = null
  let createSuccess = false
  let createError: { code?: string; message?: string; type?: string } | null = null
  let createdAccountId: string | null = null

  // 1. Verify the key works at all
  let stripe
  try {
    stripe = getStripe()
  } catch (err) {
    return NextResponse.json({
      key_set: keySet,
      key_looks_like_live: keyLooksLikeLive,
      list_success: false,
      list_error: err instanceof Error ? err.message : String(err),
      create_success: false,
      create_error: null,
      created_account_id: null,
    })
  }

  try {
    await stripe.accounts.list({ limit: 1 })
    listSuccess = true
  } catch (err: unknown) {
    const stripeErr = err as { message?: string; code?: string; type?: string }
    listError = stripeErr.message ?? String(err)
  }

  // 2. Test account creation
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      capabilities: {
        transfers: { requested: true },
      },
    })
    createSuccess = true
    createdAccountId = account.id

    // Clean up immediately
    try {
      await stripe.accounts.del(account.id)
    } catch (delErr) {
      console.error('[stripe/diagnose] Failed to delete test account:', delErr)
    }
  } catch (err: unknown) {
    const stripeErr = err as { code?: string; message?: string; type?: string }
    createError = {
      code: stripeErr.code,
      message: stripeErr.message,
      type: stripeErr.type,
    }
  }

  return NextResponse.json({
    key_set: keySet,
    key_looks_like_live: keyLooksLikeLive,
    list_success: listSuccess,
    list_error: listError,
    create_success: createSuccess,
    create_error: createError,
    created_account_id: createdAccountId,
  })
}
