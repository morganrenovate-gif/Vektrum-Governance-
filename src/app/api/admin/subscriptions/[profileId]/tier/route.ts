import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireMFA } from '@/lib/auth/middleware'
import { billingRateFromTier, getFeeDescription } from '@/lib/engine/billing'
import { logAdminAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'
import type { SubscriptionTier } from '@/lib/engine/billing'

export const dynamic = 'force-dynamic'


// ─── POST /api/admin/subscriptions/[profileId]/tier ───────────────────────────
//
// Admin-only endpoint to change a funder's subscription tier.
//
// On success:
//   1. profiles: subscription_tier updated, billing_rate_bps derived from new tier
//   2. audit_log + admin_audit_log: subscription_tier_changed with old/new tier
//      + justification (dual-written via logAdminAudit so the change appears in
//      both the platform-wide chronology and the admin compliance register).
//
// Note: This does NOT retroactively change existing deal billing_rate_bps values.
// Deals lock in the funder's rate at the time of funding — the new rate applies
// only to deals created after this change.
//
// Body: { tier: SubscriptionTier, admin_justification: string }
// Access: Admin only.

const VALID_TIERS: SubscriptionTier[] = ['standalone', 'institutional', 'enterprise']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await params

  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile: adminProfile } = authContext

  if (adminProfile.role !== 'admin') {
    return errorResponse(403, 'Only admins can change subscription tiers.')
  }

  // ── AAL2 MFA required — billing_rate_bps change has direct financial impact ─
  const supabase = await createClient()
  try {
    await requireMFA(supabase, adminProfile)
  } catch (err) {
    return err as NextResponse
  }

  // ── Rate limit — admin write ───────────────────────────────────────────────
  {
    const rl = await checkRateLimit(`user:${user.id}:admin_write`, POLICIES.admin_write)
    if (!rl.allowed) {
      logRateLimitViolation(`user:${user.id}:admin_write`, rl, {
        actorId: user.id, policyName: 'admin_write',
        entityType: 'profile', entityId: profileId,
      })
      return rateLimitResponse(rl, POLICIES.admin_write.description)
    }
  }

  // ── Parse Body ─────────────────────────────────────────────────────────────
  let body: { tier?: unknown; admin_justification?: unknown }
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'The request body could not be parsed as JSON.')
  }

  if (!body.tier || !VALID_TIERS.includes(body.tier as SubscriptionTier)) {
    return errorResponse(
      400,
      `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}.`,
    )
  }

  if (
    typeof body.admin_justification !== 'string' ||
    body.admin_justification.trim().length < 20
  ) {
    return errorResponse(
      400,
      'admin_justification is required and must be at least 20 characters. ' +
        'Document the business reason for this tier change.',
    )
  }

  const newTier          = body.tier as SubscriptionTier
  const adminJustification = body.admin_justification.trim()
  const newBillingRateBps  = billingRateFromTier(newTier)

  const adminClient = createSupabaseAdminClient()

  // ── Fetch Target Profile ──────────────────────────────────────────────────
  const { data: targetProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, subscription_tier, billing_rate_bps, full_name, company_name')
    .eq('id', profileId)
    .single()

  if (profileError || !targetProfile) {
    return notFoundError(`Profile ${profileId} was not found.`)
  }

  if (targetProfile.role !== 'funder') {
    return errorResponse(
      422,
      `Subscription tiers only apply to funders. This profile has role '${targetProfile.role}'.`,
    )
  }

  const oldTier           = targetProfile.subscription_tier as SubscriptionTier | null
  const oldBillingRateBps = targetProfile.billing_rate_bps  as number | null

  if (oldTier === newTier) {
    return errorResponse(
      422,
      `This funder is already on the '${newTier}' tier. No change made.`,
    )
  }

  // ── Update Profile ────────────────────────────────────────────────────────
  const { data: updatedProfile, error: updateError } = await adminClient
    .from('profiles')
    .update({
      subscription_tier:  newTier,
      billing_rate_bps:   newBillingRateBps,
    })
    .eq('id', profileId)
    .select('id, subscription_tier, billing_rate_bps')
    .single()

  if (updateError || !updatedProfile) {
    return internalError(
      'Failed to update the subscription tier. Please try again.',
      updateError?.message,
    )
  }

  // ── Admin Audit Log (dual-write) ──────────────────────────────────────────
  // logAdminAudit writes to BOTH audit_log and admin_audit_log so the change
  // appears in the platform-wide chronological history AND in the admin
  // compliance register (with justification). The helper never throws —
  // failures are caught and logged inside the audit module.
  await logAdminAudit({
    entity_type:             'profile',
    entity_id:               profileId,
    action:                  'subscription_tier_changed',
    actor_id:                user.id,
    actor_role:              'admin',
    actor_email:             user.email,
    system_source:           'api/admin/subscriptions/tier',
    ip_address:              request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
    admin_justification:     adminJustification,
    old_values: {
      subscription_tier:  oldTier,
      billing_rate_bps:   oldBillingRateBps,
      fee_description:    oldTier ? getFeeDescription(oldTier) : null,
    },
    new_values: {
      subscription_tier:  newTier,
      billing_rate_bps:   newBillingRateBps,
      fee_description:    getFeeDescription(newTier),
    },
  })

  return NextResponse.json(
    {
      profile: updatedProfile,
      message: `Subscription tier updated to '${newTier}'. ${getFeeDescription(newTier)} will apply to new deals.`,
      note:    'Existing deal billing_rate_bps values are unchanged — deals lock in the rate at funding time.',
    },
    { status: 200 },
  )
}
