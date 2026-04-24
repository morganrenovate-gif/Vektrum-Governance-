import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'
import { calculateFee } from '@/lib/engine/billing'

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
 * contractor. All 8 conditions plus the caller role check are evaluated in a
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
  // SECURITY: Only the deal funder may release milestone payments.
  // Admin accounts are explicitly excluded — this is a deliberate security
  // boundary preventing admin compromise from bypassing funder authorisation.
  // Admins may only modify protection_status after documented funder sign-off
  // via the protection endpoint; they cannot trigger Stripe transfers directly.
  if (callerProfile.role !== 'funder') {
    errors.push(
      'Only the deal funder can release milestone payments. ' +
        `Your account is registered as a '${callerProfile.role}'. ` +
        'Admin accounts cannot directly trigger releases — contact the deal ' +
        'funder to authorise this payment.',
    )
    // If the caller is not authorised, do not load any deal data — return immediately
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
  // Include reserved_amount so the balance check reflects in-flight releases
  // that have been reserved but whose Stripe transfers haven't completed yet.
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, contractor_id, funded_amount, released_amount, fees_collected, reserved_amount, billing_rate_bps, total_amount')
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

  // ── Fetch Existing Active Release Record ────────────────────────────────────
  // Only block if there is a 'pending' or 'confirmed' release — failed/reversed
  // releases leave audit trail rows but must not block a retry attempt.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRelease, error: releaseQueryError } = await (supabase as any)
    .from('releases')
    .select('id, transfer_status')
    .eq('milestone_id', milestoneId)
    .in('transfer_status', ['pending', 'confirmed'])
    .maybeSingle()

  // ── Fetch Open Change Orders ────────────────────────────────────────────────
  const { data: openChangeOrders, error: changeOrderError } = await supabase
    .from('change_orders')
    .select('id')
    .eq('milestone_id', milestoneId)
    .eq('status', 'submitted')

  // ── Fetch Contract (condition 8) ─────────────────────────────────────────────
  // Belt-and-suspenders: funding already requires a signed contract, but we
  // re-check at release time in case the contract was voided after funding.
  const { data: contract, error: contractQueryError } = await supabase
    .from('contracts')
    .select('status')
    .eq('deal_id', deal.id)
    .maybeSingle()

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
  //              INCLUDING the platform fee AND any in-flight reservations.
  //
  // Available = funded_amount − released_amount − fees_collected − reserved_amount
  // Required  = milestone.amount + platform fee
  //
  // reserved_amount represents funds committed to concurrent in-flight releases
  // (reserved before their Stripe transfers complete). Subtracting it here gives
  // the user an accurate picture of what's actually available, even if another
  // release is being processed simultaneously.
  //
  // NOTE: This check is a fast user-facing pre-check with helpful error messages.
  //       The authoritative atomic gate is reserve_release_funds() in the route,
  //       which uses SELECT FOR UPDATE to prevent race conditions. These two checks
  //       are complementary — this one catches the obvious case early; the RPC
  //       catches the concurrent edge case.
  // ─────────────────────────────────────────────────────────────────────────────
  const available  = deal.funded_amount - deal.released_amount - deal.fees_collected - (deal.reserved_amount ?? 0)
  const fee        = calculateFee(milestone.amount, deal.billing_rate_bps)
  const totalDebit = fee.totalDebit   // milestone.amount + fee.feeAmount
  const shortfall  = totalDebit - available

  if (available < totalDebit) {
    errors.push(
      `Insufficient funded balance. ` +
        `Available: $${available.toFixed(2)}. ` +
        `Required: $${milestone.amount.toFixed(2)} (milestone) + $${fee.feeAmount.toFixed(2)} (${fee.rateLabel} platform fee) = $${totalDebit.toFixed(2)}. ` +
        `The funder needs to deposit $${shortfall.toFixed(2)} more before this milestone can be released.`,
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

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 8: Deal must have a fully-executed (signed) contract on file
  //
  // Funding already enforces this, but contracts can be voided after a deal
  // is funded. We re-check at release time to ensure the legal record is intact.
  // If no contract exists or the contract was voided post-funding, all releases
  // on the deal are blocked until a new signed contract is on file.
  // ─────────────────────────────────────────────────────────────────────────────
  if (contractQueryError) {
    errors.push(
      'Could not verify contract status for this deal. ' +
        'Release aborted as a precaution. Please try again or contact support.',
    )
  } else if (!contract) {
    errors.push(
      'This deal does not have a contract on file. ' +
        'A fully-executed contract is required before any milestone can be released. ' +
        'The contractor must upload the contract PDF and both parties must sign.',
    )
  } else if (contract.status !== 'signed') {
    const detail =
      contract.status === 'voided'
        ? 'The contract has been voided after funding. A new contract must be uploaded and signed ' +
          'before milestone releases can resume.'
        : `Contract is not fully executed (status: '${contract.status}'). ` +
          'Both parties must sign the contract before funds can be released.'
    errors.push(detail)
  }

  return {
    allowed: errors.length === 0,
    errors,
  }
}

// ─── AI Draw Review Precondition ─────────────────────────────────────────────

/**
 * Checks whether a passing AI draw review (or active admin override) exists
 * for the milestone. This is a SEPARATE precondition checked BEFORE the
 * 8-condition release gate.
 *
 * Pass logic (checked in order):
 *   1. Standard ai_draw_review — must be < 48 h old and NOT critical risk.
 *   2. Admin override (ai_review_admin_override) — TTL controlled by
 *      AI_ADMIN_OVERRIDE_TTL_HOURS env var (default 4 h). Gate passes but a
 *      console.warn and a 'warning' field in the result signal the override.
 *
 * Override guards (enforced by the override endpoint, not re-validated here):
 *   - Only admins with AAL2 MFA may create overrides.
 *   - Overrides cannot be created while a critical-risk review is in effect.
 */
export async function checkAiPrecondition(
  milestoneId: string,
  supabase: SupabaseClient,
): Promise<{ passed: boolean; reason?: string; warning?: string }> {

  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000

  // ── 1. Standard AI draw review ────────────────────────────────────────────
  const { data: reviews } = await supabase
    .from('audit_log')
    .select('created_at, metadata')
    .eq('entity_type', 'milestone')
    .eq('entity_id', milestoneId)
    .eq('action', 'ai_draw_review')
    .order('created_at', { ascending: false })
    .limit(1)

  if (reviews && reviews.length > 0) {
    const review    = reviews[0]
    const reviewAge = Date.now() - new Date(review.created_at).getTime()

    if (reviewAge <= FORTY_EIGHT_HOURS_MS) {
      const riskLevel = (review.metadata as Record<string, unknown> | null)?.risk_level
      if (riskLevel === 'critical') {
        return {
          passed: false,
          reason: 'AI flagged critical risk — admin review required before release',
        }
      }
      // Valid, non-critical, non-expired review → pass
      return { passed: true }
    }
    // Expired review — fall through to check admin override before failing
  }

  // ── 2. Admin override (for AI service unavailability) ─────────────────────
  // Check for an active ai_review_admin_override entry. These expire after
  // AI_ADMIN_OVERRIDE_TTL_HOURS (default 4 h) — much shorter than the normal
  // 48 h TTL to limit the blast radius of an emergency bypass.
  const ttlHours = Math.max(
    1,
    parseInt(process.env.AI_ADMIN_OVERRIDE_TTL_HOURS ?? '4', 10),
  )
  const ttlMs = ttlHours * 60 * 60 * 1000

  const { data: overrides } = await supabase
    .from('audit_log')
    .select('created_at, metadata')
    .eq('entity_type', 'milestone')
    .eq('entity_id', milestoneId)
    .eq('action', 'ai_review_admin_override')
    .order('created_at', { ascending: false })
    .limit(1)

  if (overrides && overrides.length > 0) {
    const override    = overrides[0]
    const overrideAge = Date.now() - new Date(override.created_at).getTime()

    if (overrideAge <= ttlMs) {
      const meta            = override.metadata as Record<string, unknown> | null
      const overrideRiskLevel = meta?.override_risk_level ?? 'unknown'
      const expiresAt         = meta?.expires_at ?? 'unknown'

      console.warn(
        `[release-gate] Admin AI-review override ACTIVE for milestone ${milestoneId}. ` +
        `Asserted risk: ${overrideRiskLevel}. Expires: ${expiresAt}. ` +
        'Standard AI precondition bypassed by admin override.',
      )

      return {
        passed:  true,
        warning:
          `Admin override in effect — AI draw review bypassed by admin ` +
          `(asserted risk: ${overrideRiskLevel}, expires: ${expiresAt}).`,
      }
    }
    // Override exists but has expired — fall through to failure
  }

  // ── 3. No valid review or active override ─────────────────────────────────
  if (!reviews || reviews.length === 0) {
    return { passed: false, reason: 'AI draw review is required before release' }
  }

  // Reviews exist but all are expired
  return {
    passed: false,
    reason:
      'AI assessment expired — please request a fresh review. ' +
      'If the AI service is unavailable, an admin can apply a temporary override.',
  }
}
