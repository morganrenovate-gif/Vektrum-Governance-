import { createServerClient } from '@supabase/ssr'
import type { Profile } from '@/lib/types'

// ─── Result Shape ─────────────────────────────────────────────────────────────

export interface ReleaseValidationResult {
  allowed: boolean
  /** All blocking conditions, collected in a single pass. Never just the first one. */
  errors: string[]
}

// ─── Release Gate ─────────────────────────────────────────────────────────────

/**
 * THE MOST CRITICAL FUNCTION IN THE SYSTEM.
 *
 * Validates all preconditions required before funds may be transferred to a
 * contractor. All 7 conditions plus the caller role check are evaluated in a
 * single pass and ALL failures are returned simultaneously — so the caller
 * sees the complete picture without iterative round-trips.
 *
 * This function MUST be called at the start of every release operation,
 * before any Stripe API calls or database mutations are attempted.
 *
 * @param supabase      - Supabase client (user-scoped or admin; must be able
 *                        to read deals, milestones, profiles, and releases).
 * @param milestoneId   - The UUID of the milestone to release.
 * @param callerProfile - The Profile of the user triggering the release.
 *
 * @returns { allowed: true, errors: [] } if all conditions pass.
 * @returns { allowed: false, errors: [...] } if one or more conditions fail.
 *          Never throws — unexpected errors are collected as error strings.
 */
export async function validateRelease(
  supabase: ReturnType<typeof createServerClient>,
  milestoneId: string,
  callerProfile: Profile,
): Promise<ReleaseValidationResult> {
  const errors: string[] = []

  // ── Caller Role Check ───────────────────────────────────────────────────────
  if (callerProfile.role !== 'funder' && callerProfile.role !== 'admin') {
    errors.push(
      'Only funders and admins can release milestone payments. ' +
        `Your account is registered as a '${callerProfile.role}'. ` +
        'If you believe this is incorrect, contact your account administrator.',
    )
    // If the caller is not authorized, do not load any deal data — return immediately
    return { allowed: false, errors }
  }

  // ── Fetch Milestone ─────────────────────────────────────────────────────────
  const { data: milestone, error: milestoneError } = await supabase
    .from('milestones')
    .select('id, deal_id, amount, status, protection_status')
    .eq('id', milestoneId)
    .single()

  if (milestoneError || !milestone) {
    return {
      allowed: false,
      errors: [
        `Milestone ${milestoneId} could not be found. Verify the milestone ID and try again.`,
      ],
    }
  }

  // ── Fetch Deal ──────────────────────────────────────────────────────────────
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, contractor_id, funded_amount, released_amount, total_amount')
    .eq('id', milestone.deal_id)
    .single()

  if (dealError || !deal) {
    return {
      allowed: false,
      errors: [
        `The deal associated with milestone ${milestoneId} could not be found. Contact support if this persists.`,
      ],
    }
  }

  // ── Fetch Contractor Profile ────────────────────────────────────────────────
  const { data: contractorProfile, error: contractorError } = await supabase
    .from('profiles')
    .select('id, stripe_account_id, stripe_payouts_enabled, onboarding_complete')
    .eq('id', deal.contractor_id)
    .single()

  if (contractorError || !contractorProfile) {
    errors.push(
      'The contractor profile for this milestone could not be found. ' +
        'Ensure the contractor has completed account registration before releasing funds.',
    )
    // Cannot check Stripe conditions without the contractor — continue with other checks
  }

  // ── Fetch Existing Release Record ───────────────────────────────────────────
  const { data: existingRelease, error: releaseQueryError } = await supabase
    .from('releases')
    .select('id')
    .eq('milestone_id', milestoneId)
    .maybeSingle()

  // ── Fetch Open Change Orders ────────────────────────────────────────────────
  const { data: openChangeOrders, error: changeOrderError } = await supabase
    .from('change_orders')
    .select('id')
    .eq('milestone_id', milestoneId)
    .eq('status', 'submitted')

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 1: Milestone must be in 'approved' status
  // ─────────────────────────────────────────────────────────────────────────────
  if (milestone.status !== 'approved') {
    errors.push(
      `This milestone has not been approved yet. The funder must review and approve ` +
        `the submitted work before funds can be released. ` +
        `Current status: '${milestone.status}'.`,
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 2: Milestone protection_status must be 'ready_for_release'
  // ─────────────────────────────────────────────────────────────────────────────
  if (milestone.protection_status !== 'ready_for_release') {
    errors.push(
      `This milestone is not cleared for release. ` +
        `Current protection status: '${milestone.protection_status}'. ` +
        `The milestone must reach 'ready_for_release' protection status before funds can be disbursed.`,
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 3: Deal must have sufficient funded balance to cover this milestone
  // ─────────────────────────────────────────────────────────────────────────────
  const available = deal.funded_amount - deal.released_amount
  const shortfall = milestone.amount - available

  if (available < milestone.amount) {
    errors.push(
      `Insufficient funded balance. ` +
        `Available: $${available.toFixed(2)}. ` +
        `Required: $${milestone.amount.toFixed(2)}. ` +
        `The funder needs to add $${shortfall.toFixed(2)} before this milestone can be released.`,
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 4: Contractor must have Stripe payouts enabled
  // ─────────────────────────────────────────────────────────────────────────────
  if (contractorProfile && !contractorProfile.stripe_payouts_enabled) {
    errors.push(
      'The contractor has not completed Stripe onboarding. ' +
        'Payouts must be enabled before funds can be released. ' +
        'The contractor should log in and complete their Stripe Connect setup.',
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 5: Contractor must have completed platform onboarding
  // ─────────────────────────────────────────────────────────────────────────────
  if (contractorProfile && !contractorProfile.onboarding_complete) {
    errors.push(
      "The contractor's account setup is incomplete. " +
        'They must finish onboarding before receiving payments. ' +
        'Ask the contractor to log in and complete all required onboarding steps.',
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 6: No existing release record for this milestone
  // ─────────────────────────────────────────────────────────────────────────────
  if (releaseQueryError) {
    errors.push(
      'Could not verify whether this milestone has already been released. ' +
        'Release aborted as a precaution. Please try again or contact support.',
    )
  } else if (existingRelease) {
    errors.push(
      'Funds for this milestone have already been released. ' +
        'Duplicate releases are not permitted. ' +
        'If you believe this is an error, contact support with the milestone ID.',
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 7: No open change orders on this milestone
  // ─────────────────────────────────────────────────────────────────────────────
  if (changeOrderError) {
    errors.push(
      'Could not verify pending change orders for this milestone. ' +
        'Release aborted as a precaution. Please try again or contact support.',
    )
  } else if (openChangeOrders && openChangeOrders.length > 0) {
    errors.push(
      `There ${openChangeOrders.length === 1 ? 'is' : 'are'} ${openChangeOrders.length} ` +
        `pending change order${openChangeOrders.length === 1 ? '' : 's'} on this milestone ` +
        `that must be resolved before release. ` +
        `The funder must approve or reject all submitted change orders before funds can be disbursed.`,
    )
  }

  return {
    allowed: errors.length === 0,
    errors,
  }
}
