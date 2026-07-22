import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'
import { calculateFee } from '@/lib/engine/billing'
import {
  makeResult,
  type ConditionResult,
} from '@/lib/engine/gate-conditions'

// ─── Result Shape ─────────────────────────────────────────────────────────────

export interface ReleaseValidationResult {
  allowed: boolean
  /** All blocking conditions, collected in a single pass. Never just the first one. */
  errors: string[]
  /**
   * Phase 1 (additive, non-behavioural): one structured result per evaluated
   * condition — passed, failed, not_applicable, or error. `errors` remains the
   * authoritative, byte-for-byte-unchanged decision surface; `results` is a
   * richer, reproducible record of the same decision. Existing callers that
   * only read { allowed, errors } are unaffected.
   */
  results: ConditionResult[]
}

export type ExecutionRail = 'stripe_connect' | 'external_manual'

export interface ValidateReleaseOptions {
  /**
   * The payment rail on which this release will be executed. Default is
   * 'stripe_connect' so existing callers get unchanged behaviour.
   *
   * When 'external_manual', Condition 4 (contractor Stripe payouts enabled)
   * is skipped because payment is executed outside Vektrum by the funder or
   * a partner treasury system — the contractor does not need a Stripe Connect
   * account for this rail. All other 9 conditions still apply.
   */
  executionRail?: ExecutionRail
}

// ─── Release Gate ─────────────────────────────────────────────────────────────

/**
 * THE MOST CRITICAL FUNCTION IN THE SYSTEM.
 *
 * Validates all preconditions required before funds may be transferred to a
 * contractor. All 10 numbered conditions plus the caller role check are
 * evaluated in a single pass and ALL failures are returned simultaneously —
 * so the caller sees the complete picture without iterative round-trips.
 *
 * This is the "10-condition server-side release gate." An AI precondition
 * (checkAiPrecondition) is a SEPARATE check run BEFORE validateRelease by
 * the release route; it is not part of the 10 conditions.
 *
 * This function MUST be called at the start of every release operation,
 * before any Stripe API calls or database mutations are attempted.
 *
 * Rail-awareness: when options.executionRail = 'external_manual', Condition 4
 * (contractor Stripe payouts enabled) is skipped because the rail does not
 * use Stripe Connect. All other 9 conditions still apply identically. This
 * is the ONLY difference between the two rails at the gate layer.
 *
 * Phase 1: the function additionally returns `results` — a structured record
 * of every condition evaluated (passed / failed / not_applicable / error) —
 * WITHOUT changing any pass/fail decision or any `errors` string. `errors` is
 * still derived exactly as before.
 *
 * @param supabase      - Supabase client (user-scoped or admin; must be able
 *                        to read deals, milestones, profiles, and releases).
 * @param milestoneId   - The UUID of the milestone to release.
 * @param callerProfile - The Profile of the user triggering the release.
 * @param options       - Rail selection and other future options.
 *
 * @returns { allowed: true, errors: [], results } if all conditions pass.
 * @returns { allowed: false, errors: [...], results } if one or more fail.
 *          Never throws — unexpected errors are collected as error strings.
 */
export async function validateRelease(
  supabase: ReturnType<typeof createServerClient>,
  milestoneId: string,
  callerProfile: Profile,
  options: ValidateReleaseOptions = {},
): Promise<ReleaseValidationResult> {
  const executionRail: ExecutionRail = options.executionRail ?? 'stripe_connect'
  const errors: string[] = []
  const results: ConditionResult[] = []

  // ── Caller Role Check ───────────────────────────────────────────────────────
  // SECURITY: Only the deal funder may release milestone payments.
  // Admin accounts are explicitly excluded — this is a deliberate security
  // boundary preventing admin compromise from bypassing funder authorisation.
  // Admins may only modify protection_status after documented funder sign-off
  // via the protection endpoint; they cannot trigger Stripe transfers directly.
  if (callerProfile.role !== 'funder') {
    const msg =
      'Only the deal funder can release milestone payments. ' +
      `Your account is registered as a '${callerProfile.role}'. ` +
      'Admin accounts cannot directly trigger releases — contact the deal ' +
      'funder to authorise this payment.'
    errors.push(msg)
    results.push(makeResult('ACTOR_AUTHORIZED', 'failed', {
      resultCode: 'FAIL_ACTOR_NOT_FUNDER',
      explanation: msg,
      inputs: { actor_role: callerProfile.role },
    }))
    // If the caller is not authorised, do not load any deal data — return immediately
    return { allowed: false, errors, results }
  }
  results.push(makeResult('ACTOR_AUTHORIZED', 'passed', {
    inputs: { actor_role: callerProfile.role },
  }))

  // ── Fetch Milestone ─────────────────────────────────────────────────────────
  const { data: milestone, error: milestoneError } = await supabase
    .from('milestones')
    .select('id, deal_id, amount, status, protection_status, order_index')
    .eq('id', milestoneId)
    .single()

  if (milestoneError || !milestone) {
    return {
      allowed: false,
      errors: [
        `Milestone ${milestoneId} could not be found. Verify the milestone ID and try again.`,
      ],
      results,
    }
  }

  // ── Fetch Deal ──────────────────────────────────────────────────────────────
  // Include reserved_amount so the balance check reflects in-flight releases
  // that have been reserved but whose Stripe transfers haven't completed yet.
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, status, contractor_id, funded_amount, released_amount, fees_collected, reserved_amount, billing_rate_bps, total_amount, sequential_release_required, lien_waiver_required, deal_freeze_on_void')
    .eq('id', milestone.deal_id)
    .single()

  if (dealError || !deal) {
    return {
      allowed: false,
      errors: [
        `The deal associated with milestone ${milestoneId} could not be found. Contact support if this persists.`,
      ],
      results,
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

  // ── Frozen deal fast-path ────────────────────────────────────────────────────
  // A deal is frozen when a DocuSign contract was voided after milestone
  // releases had already occurred. No release may proceed until an admin
  // unfreezes the deal with documented justification.
  // This check is a gate BEFORE the 10 numbered conditions, not a numbered
  // condition itself — a frozen deal can never satisfy all 10 conditions
  // anyway (Condition 8 will also block on the voided contract), but the
  // frozen check provides a clearer, purpose-specific error message.
  if (deal.status === 'frozen') {
    const msg =
      'This deal has been frozen because the contract was voided after milestone ' +
      'payments had already been released. No further releases are permitted until ' +
      'an admin reviews the situation and unfreezes the deal. ' +
      'Contact operations@vektrum.io with the deal ID to request an unfreeze.'
    results.push(makeResult('DEAL_NOT_FROZEN', 'failed', {
      resultCode: 'FAIL_DEAL_FROZEN',
      explanation: msg,
      inputs: { deal_status: deal.status },
      evidenceRefs: [deal.id],
    }))
    return { allowed: false, errors: [msg], results }
  }
  results.push(makeResult('DEAL_NOT_FROZEN', 'passed', {
    inputs: { deal_status: deal.status },
    evidenceRefs: [deal.id],
  }))

  // ── Fetch Contract (condition 8) ─────────────────────────────────────────────
  // Belt-and-suspenders: funding already requires a signed contract, but we
  // re-check at release time in case the contract was voided after funding.
  // After migration 20260424000010, the contracts_deal_active_unique partial
  // index guarantees at most one non-voided contract per deal_id, so
  // .maybeSingle() is safe (returns 0 or 1 rows, never 2+).
  const { data: contract, error: contractQueryError } = await supabase
    .from('contracts')
    .select('status')
    .eq('deal_id', deal.id)
    .not('status', 'eq', 'voided')
    .maybeSingle()

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 1: Milestone must be in 'approved' status
  // ─────────────────────────────────────────────────────────────────────────────
  if (milestone.status !== 'approved') {
    const msg =
      `This milestone has not been approved yet. The funder must review and approve ` +
      `the submitted work before funds can be released. ` +
      `Current status: '${milestone.status}'.`
    errors.push(msg)
    results.push(makeResult('MILESTONE_APPROVED', 'failed', {
      resultCode: 'FAIL_MILESTONE_NOT_APPROVED', explanation: msg,
      inputs: { status: milestone.status }, evidenceRefs: [milestone.id],
    }))
  } else {
    results.push(makeResult('MILESTONE_APPROVED', 'passed', {
      inputs: { status: milestone.status }, evidenceRefs: [milestone.id],
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 2: Milestone protection_status must be 'ready_for_release'
  // ─────────────────────────────────────────────────────────────────────────────
  if (milestone.protection_status !== 'ready_for_release') {
    const msg =
      `This milestone is not cleared for release. ` +
      `Current protection status: '${milestone.protection_status}'. ` +
      `The milestone must reach 'ready_for_release' protection status before funds can be disbursed.`
    errors.push(msg)
    results.push(makeResult('PROTECTION_READY', 'failed', {
      resultCode: 'FAIL_PROTECTION_NOT_READY', explanation: msg,
      inputs: { protection_status: milestone.protection_status }, evidenceRefs: [milestone.id],
    }))
  } else {
    results.push(makeResult('PROTECTION_READY', 'passed', {
      inputs: { protection_status: milestone.protection_status }, evidenceRefs: [milestone.id],
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 3: Deal must have sufficient funded balance to cover this milestone
  //              INCLUDING the platform fee AND any in-flight reservations.
  //
  // Available = funded_amount − released_amount − fees_collected − reserved_amount
  // Required  = milestone.amount + platform fee
  //
  // NOTE: This check is a fast user-facing pre-check with helpful error messages.
  //       The authoritative atomic gate is reserve_release_funds() in the route,
  //       which uses SELECT FOR UPDATE to prevent race conditions.
  // ─────────────────────────────────────────────────────────────────────────────
  const available  = deal.funded_amount - deal.released_amount - deal.fees_collected - (deal.reserved_amount ?? 0)
  const fee        = calculateFee(milestone.amount, deal.billing_rate_bps)
  const totalDebit = fee.totalDebit   // milestone.amount + fee.feeAmount
  const shortfall  = totalDebit - available

  if (available < totalDebit) {
    const msg =
      `Insufficient funded balance. ` +
      `Available: $${available.toFixed(2)}. ` +
      `Required: $${milestone.amount.toFixed(2)} (milestone) + $${fee.feeAmount.toFixed(2)} (${fee.rateLabel} platform fee) = $${totalDebit.toFixed(2)}. ` +
      `The funder needs to deposit $${shortfall.toFixed(2)} more before this milestone can be released.`
    errors.push(msg)
    results.push(makeResult('FUNDED_BALANCE_SUFFICIENT', 'failed', {
      resultCode: 'FAIL_INSUFFICIENT_BALANCE', explanation: msg,
      inputs: { available, total_debit: totalDebit, milestone_amount: milestone.amount, fee_amount: fee.feeAmount },
      evidenceRefs: [deal.id],
    }))
  } else {
    results.push(makeResult('FUNDED_BALANCE_SUFFICIENT', 'passed', {
      inputs: { available, total_debit: totalDebit, milestone_amount: milestone.amount, fee_amount: fee.feeAmount },
      evidenceRefs: [deal.id],
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 4: Contractor must have Stripe payouts enabled
  //
  // Rail-aware: skipped for external_manual. This is the ONLY condition that
  // differs between the two rails. All other 9 conditions apply identically.
  // ─────────────────────────────────────────────────────────────────────────────
  if (executionRail !== 'stripe_connect') {
    results.push(makeResult('PAYOUT_ACCOUNT_READY', 'not_applicable', {
      resultCode: 'NOT_APPLICABLE_EXTERNAL_RAIL',
      explanation: 'External/manual rail — Vektrum-controlled payout readiness is not evaluated.',
      inputs: { execution_rail: executionRail },
    }))
  } else if (!contractorProfile) {
    results.push(makeResult('PAYOUT_ACCOUNT_READY', 'error', {
      resultCode: 'ERROR_CONTRACTOR_MISSING',
      explanation: 'Contractor profile unavailable; Stripe payout readiness could not be evaluated.',
      inputs: { execution_rail: executionRail },
    }))
  } else if (!contractorProfile.stripe_payouts_enabled) {
    errors.push(
      'The contractor has not completed Stripe onboarding. ' +
        'Payouts must be enabled before funds can be released. ' +
        'The contractor should log in and complete their Stripe Connect setup.',
    )
    results.push(makeResult('PAYOUT_ACCOUNT_READY', 'failed', {
      resultCode: 'FAIL_STRIPE_PAYOUTS_DISABLED',
      explanation: 'The contractor has not completed Stripe onboarding. ' +
        'Payouts must be enabled before funds can be released. ' +
        'The contractor should log in and complete their Stripe Connect setup.',
      inputs: { execution_rail: executionRail, stripe_payouts_enabled: false },
      evidenceRefs: [contractorProfile.id],
    }))
  } else {
    results.push(makeResult('PAYOUT_ACCOUNT_READY', 'passed', {
      inputs: { execution_rail: executionRail, stripe_payouts_enabled: true },
      evidenceRefs: [contractorProfile.id],
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 5: Contractor must have completed platform onboarding
  // ─────────────────────────────────────────────────────────────────────────────
  if (!contractorProfile) {
    results.push(makeResult('CONTRACTOR_ONBOARDING_COMPLETE', 'error', {
      resultCode: 'ERROR_CONTRACTOR_MISSING',
      explanation: 'Contractor profile unavailable; onboarding completeness could not be evaluated.',
    }))
  } else if (!contractorProfile.onboarding_complete) {
    errors.push(
      "The contractor's account setup is incomplete. " +
        'They must finish onboarding before receiving payments. ' +
        'Ask the contractor to log in and complete all required onboarding steps.',
    )
    results.push(makeResult('CONTRACTOR_ONBOARDING_COMPLETE', 'failed', {
      resultCode: 'FAIL_ONBOARDING_INCOMPLETE',
      explanation: "The contractor's account setup is incomplete. " +
        'They must finish onboarding before receiving payments. ' +
        'Ask the contractor to log in and complete all required onboarding steps.',
      inputs: { onboarding_complete: false }, evidenceRefs: [contractorProfile.id],
    }))
  } else {
    results.push(makeResult('CONTRACTOR_ONBOARDING_COMPLETE', 'passed', {
      inputs: { onboarding_complete: true }, evidenceRefs: [contractorProfile.id],
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 6: No existing release record for this milestone
  // ─────────────────────────────────────────────────────────────────────────────
  if (releaseQueryError) {
    errors.push(
      'Could not verify whether this milestone has already been released. ' +
        'Release aborted as a precaution. Please try again or contact support.',
    )
    results.push(makeResult('NO_ACTIVE_RELEASE', 'error', {
      resultCode: 'ERROR_RELEASE_QUERY',
      explanation: 'Could not verify whether this milestone has already been released. ' +
        'Release aborted as a precaution. Please try again or contact support.',
    }))
  } else if (existingRelease) {
    errors.push(
      'Funds for this milestone have already been released. ' +
        'Duplicate releases are not permitted. ' +
        'If you believe this is an error, contact support with the milestone ID.',
    )
    results.push(makeResult('NO_ACTIVE_RELEASE', 'failed', {
      resultCode: 'FAIL_ACTIVE_RELEASE_EXISTS',
      explanation: 'Funds for this milestone have already been released. ' +
        'Duplicate releases are not permitted. ' +
        'If you believe this is an error, contact support with the milestone ID.',
      evidenceRefs: existingRelease?.id ? [existingRelease.id] : undefined,
    }))
  } else {
    results.push(makeResult('NO_ACTIVE_RELEASE', 'passed'))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 7: No open change orders on this milestone
  // ─────────────────────────────────────────────────────────────────────────────
  if (changeOrderError) {
    errors.push(
      'Could not verify pending change orders for this milestone. ' +
        'Release aborted as a precaution. Please try again or contact support.',
    )
    results.push(makeResult('CHANGE_ORDERS_RESOLVED', 'error', {
      resultCode: 'ERROR_CHANGE_ORDER_QUERY',
      explanation: 'Could not verify pending change orders for this milestone. ' +
        'Release aborted as a precaution. Please try again or contact support.',
    }))
  } else if (openChangeOrders && openChangeOrders.length > 0) {
    errors.push(
      `There ${openChangeOrders.length === 1 ? 'is' : 'are'} ${openChangeOrders.length} ` +
        `pending change order${openChangeOrders.length === 1 ? '' : 's'} on this milestone ` +
        `that must be resolved before release. ` +
        `The funder must approve or reject all submitted change orders before funds can be disbursed.`,
    )
    results.push(makeResult('CHANGE_ORDERS_RESOLVED', 'failed', {
      resultCode: 'FAIL_OPEN_CHANGE_ORDERS',
      explanation: `There ${openChangeOrders.length === 1 ? 'is' : 'are'} ${openChangeOrders.length} ` +
        `pending change order${openChangeOrders.length === 1 ? '' : 's'} on this milestone ` +
        `that must be resolved before release. ` +
        `The funder must approve or reject all submitted change orders before funds can be disbursed.`,
      inputs: { open_change_order_count: openChangeOrders.length },
      evidenceRefs: openChangeOrders.map((c: { id: string }) => c.id),
    }))
  } else {
    results.push(makeResult('CHANGE_ORDERS_RESOLVED', 'passed', {
      inputs: { open_change_order_count: 0 },
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 8: Deal must have a fully-executed (signed) contract on file
  // ─────────────────────────────────────────────────────────────────────────────
  if (contractQueryError) {
    errors.push(
      'Could not verify contract status for this deal. ' +
        'Release aborted as a precaution. Please try again or contact support.',
    )
    results.push(makeResult('SIGNED_CONTRACT_PRESENT', 'error', {
      resultCode: 'ERROR_CONTRACT_QUERY',
      explanation: 'Could not verify contract status for this deal. ' +
        'Release aborted as a precaution. Please try again or contact support.',
    }))
  } else if (!contract) {
    errors.push(
      'This deal does not have a contract on file. ' +
        'A fully-executed contract is required before any milestone can be released. ' +
        'The contractor must upload the contract PDF and both parties must sign.',
    )
    results.push(makeResult('SIGNED_CONTRACT_PRESENT', 'failed', {
      resultCode: 'FAIL_NO_CONTRACT',
      explanation: 'This deal does not have a contract on file. ' +
        'A fully-executed contract is required before any milestone can be released. ' +
        'The contractor must upload the contract PDF and both parties must sign.',
      evidenceRefs: [deal.id],
    }))
  } else if (contract.status !== 'signed') {
    const detail =
      contract.status === 'voided'
        ? 'The contract has been voided after funding. A new contract must be uploaded and signed ' +
          'before milestone releases can resume.'
        : `Contract is not fully executed (status: '${contract.status}'). ` +
          'Both parties must sign the contract before funds can be released.'
    errors.push(detail)
    results.push(makeResult('SIGNED_CONTRACT_PRESENT', 'failed', {
      resultCode: contract.status === 'voided' ? 'FAIL_CONTRACT_VOIDED' : 'FAIL_CONTRACT_UNSIGNED',
      explanation: detail, inputs: { contract_status: contract.status }, evidenceRefs: [deal.id],
    }))
  } else {
    results.push(makeResult('SIGNED_CONTRACT_PRESENT', 'passed', {
      inputs: { contract_status: contract.status }, evidenceRefs: [deal.id],
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 9: Sequential release order + explicit prerequisites
  // ─────────────────────────────────────────────────────────────────────────────
  const errorsBeforePrereq = errors.length

  // Run both prerequisite queries in parallel
  const [sequentialResult, explicitPrereqResult] = await Promise.all([
    // 9a — sequential ordering: only relevant when the flag is set
    deal.sequential_release_required
      ? supabase
          .from('milestones')
          .select('id, title, order_index')
          .eq('deal_id', deal.id)
          .lt('order_index', milestone.order_index)
          .neq('status', 'released')
          .order('order_index', { ascending: true })
      : Promise.resolve({ data: [] as { id: string; title: string; order_index: number }[] | null, error: null }),

    // 9b — explicit prerequisites: always checked
    supabase
      .from('milestone_prerequisites')
      .select('prerequisite_milestone_id')
      .eq('milestone_id', milestoneId),
  ])

  // 9a errors — unreleased predecessors under sequential mode
  if (sequentialResult.error) {
    errors.push(
      'Could not verify sequential release order for this milestone. ' +
        'Release aborted as a precaution. Please try again or contact support.',
    )
  } else if (sequentialResult.data && sequentialResult.data.length > 0) {
    for (const pred of sequentialResult.data) {
      errors.push(
        `Sequential order required: milestone "${pred.title}" ` +
          `(position ${pred.order_index + 1}) must be released before this milestone ` +
          `(position ${milestone.order_index + 1}) can be released.`,
      )
    }
  }

  // 9b errors — unmet explicit prerequisites
  if (explicitPrereqResult.error) {
    errors.push(
      'Could not verify milestone prerequisites. ' +
        'Release aborted as a precaution. Please try again or contact support.',
    )
  } else if (explicitPrereqResult.data && explicitPrereqResult.data.length > 0) {
    // Fetch the actual milestone details for the unreleased prerequisite IDs
    const prereqIds = explicitPrereqResult.data.map(r => r.prerequisite_milestone_id)
    const { data: unreleasedPrereqs, error: prereqDetailError } = await supabase
      .from('milestones')
      .select('id, title, order_index')
      .in('id', prereqIds)
      .neq('status', 'released')

    if (prereqDetailError) {
      errors.push(
        'Could not verify all prerequisite milestone statuses. ' +
          'Release aborted as a precaution. Please try again or contact support.',
      )
    } else if (unreleasedPrereqs && unreleasedPrereqs.length > 0) {
      for (const prereq of unreleasedPrereqs) {
        errors.push(
          `Prerequisite not met: milestone "${prereq.title}" ` +
            `(position ${prereq.order_index + 1}) must be released before this milestone can proceed.`,
        )
      }
    }
  }

  // Structured record for the combined prerequisite condition. `errors` above is
  // unchanged; this derives the condition outcome from whether any prereq error
  // was appended in this block.
  {
    const prereqErrs = errors.slice(errorsBeforePrereq)
    const hadQueryError = sequentialResult.error != null || explicitPrereqResult.error != null
    if (prereqErrs.length === 0) {
      results.push(makeResult('PREREQUISITES_SATISFIED', 'passed', {
        inputs: { sequential_release_required: !!deal.sequential_release_required },
      }))
    } else if (hadQueryError) {
      results.push(makeResult('PREREQUISITES_SATISFIED', 'error', {
        resultCode: 'ERROR_PREREQUISITE_QUERY', explanation: prereqErrs.join(' '),
      }))
    } else {
      results.push(makeResult('PREREQUISITES_SATISFIED', 'failed', {
        resultCode: 'FAIL_PREREQUISITES_UNMET', explanation: prereqErrs.join(' '),
        inputs: { blocking_count: prereqErrs.length, sequential_release_required: !!deal.sequential_release_required },
      }))
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION 10: Approved conditional lien waiver on file
  // ─────────────────────────────────────────────────────────────────────────────
  if (deal.lien_waiver_required) {
    const { data: approvedWaiver, error: waiverQueryError } = await supabase
      .from('lien_waivers')
      .select('id, approved_at')
      .eq('milestone_id', milestoneId)
      .eq('waiver_type', 'conditional_progress')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (waiverQueryError) {
      errors.push(
        'Could not verify lien waiver status for this milestone. ' +
          'Release aborted as a precaution. Please try again or contact support.',
      )
      results.push(makeResult('LIEN_WAIVER_APPROVED', 'error', {
        resultCode: 'ERROR_LIEN_WAIVER_QUERY',
        explanation: 'Could not verify lien waiver status for this milestone. ' +
          'Release aborted as a precaution. Please try again or contact support.',
      }))
    } else if (!approvedWaiver) {
      errors.push(
        'An approved conditional lien waiver is required before this milestone can be released. ' +
          'The funder must request a waiver and the contractor must upload a signed ' +
          'conditional progress payment lien waiver (AIA G702/G703 equivalent). ' +
          'Contact the deal funder to initiate the waiver process.',
      )
      results.push(makeResult('LIEN_WAIVER_APPROVED', 'failed', {
        resultCode: 'FAIL_NO_APPROVED_WAIVER',
        explanation: 'An approved conditional lien waiver is required before this milestone can be released. ' +
          'The funder must request a waiver and the contractor must upload a signed ' +
          'conditional progress payment lien waiver (AIA G702/G703 equivalent). ' +
          'Contact the deal funder to initiate the waiver process.',
        inputs: { lien_waiver_required: true },
      }))
    } else {
      results.push(makeResult('LIEN_WAIVER_APPROVED', 'passed', {
        inputs: { lien_waiver_required: true }, evidenceRefs: [approvedWaiver.id],
      }))
    }
  } else {
    results.push(makeResult('LIEN_WAIVER_APPROVED', 'not_applicable', {
      resultCode: 'NOT_APPLICABLE_WAIVER_NOT_REQUIRED',
      explanation: 'Lien waiver is not required for this deal.',
      inputs: { lien_waiver_required: false },
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONDITION SOV-BALANCE: SOV line-item balance check (Tier C)
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: sovLinks } = await supabase
    .from('milestone_sov_links')
    .select('sov_line_item_id, amount_override')
    .eq('milestone_id', milestoneId)

  if (sovLinks && sovLinks.length > 0) {
    const lineItemIds = sovLinks.map((l: { sov_line_item_id: string }) => l.sov_line_item_id)
    const { data: sovItems } = await supabase
      .from('sov_line_items')
      .select('id, balance_to_finish, description')
      .in('id', lineItemIds)

    let sovFailed = false
    if (sovItems) {
      for (const item of sovItems) {
        // balance_to_finish is already maintained by the app on each SOV update
        if (typeof item.balance_to_finish === 'number' && item.balance_to_finish < 0) {
          sovFailed = true
          errors.push(
            `SOV line item "${item.description}" has a negative balance_to_finish ` +
            `($${Math.abs(item.balance_to_finish).toFixed(2)} over-drawn). ` +
            'Update the SOV before releasing this milestone.',
          )
        }
      }
    }
    results.push(makeResult('SOV_BALANCE_VALID', sovFailed ? 'failed' : 'passed', {
      resultCode: sovFailed ? 'FAIL_SOV_OVERDRAWN' : 'PASS',
      explanation: sovFailed ? 'One or more linked SOV line items are over-drawn.' : null,
      inputs: { linked_line_items: lineItemIds.length },
      evidenceRefs: lineItemIds,
    }))
  } else {
    results.push(makeResult('SOV_BALANCE_VALID', 'not_applicable', {
      resultCode: 'NOT_APPLICABLE_NO_SOV_LINKS',
      explanation: 'No SOV line items are linked to this milestone.',
    }))
  }

  return {
    allowed: errors.length === 0,
    errors,
    results,
  }
}

// ─── AI Draw Review Precondition ─────────────────────────────────────────────

/**
 * Durable, structured reference to the exact AI review or admin override that
 * checkAiPrecondition() used to reach its decision. Persisted alongside a gate
 * evaluation so a historical release decision can be reproduced and so a later
 * AI review cannot rewrite history. Contains NO raw provider payloads/secrets.
 */
export interface AiReviewSnapshot {
  /** 'review' = standard ai_draw_review; 'override' = admin bypass; 'none' = neither present. */
  source: 'review' | 'override' | 'none'
  /** audit_log row id of the exact review/override used (null when source = 'none'). */
  sourceAuditId: string | null
  resultType: 'ai_draw_review' | 'ai_review_admin_override' | null
  riskLevel: string | null
  provider: string | null
  model: string | null
  createdAt: string | null
  /** Freshness boundary that applied (48h for reviews; override TTL for overrides). */
  freshnessBoundaryMs: number | null
  /** Override-only fields. */
  overrideExpiresAt: string | null
  overrideApprover: string | null
}

/**
 * Checks whether a passing AI draw review (or active admin override) exists
 * for the milestone. This is a SEPARATE precondition checked BEFORE the
 * 10-condition release gate.
 *
 * Phase 1: additionally returns a durable `snapshot` of the exact review or
 * override used, WITHOUT re-running AI and WITHOUT changing the pass/block
 * decision. AI still only blocks or clears — it never authorizes a release.
 */
export async function checkAiPrecondition(
  milestoneId: string,
  supabase: SupabaseClient,
): Promise<{ passed: boolean; reason?: string; warning?: string; snapshot: AiReviewSnapshot }> {

  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000

  const emptySnapshot: AiReviewSnapshot = {
    source: 'none', sourceAuditId: null, resultType: null, riskLevel: null,
    provider: null, model: null, createdAt: null, freshnessBoundaryMs: null,
    overrideExpiresAt: null, overrideApprover: null,
  }

  // ── 1. Standard AI draw review ────────────────────────────────────────────
  const { data: reviews } = await supabase
    .from('audit_log')
    .select('id, created_at, metadata')
    .eq('entity_type', 'milestone')
    .eq('entity_id', milestoneId)
    .eq('action', 'ai_draw_review')
    .order('created_at', { ascending: false })
    .limit(1)

  if (reviews && reviews.length > 0) {
    const review    = reviews[0]
    const reviewAge = Date.now() - new Date(review.created_at).getTime()
    const meta      = (review.metadata as Record<string, unknown> | null) ?? {}
    const reviewSnapshot: AiReviewSnapshot = {
      source: 'review',
      sourceAuditId: (review as { id?: string }).id ?? null,
      resultType: 'ai_draw_review',
      riskLevel: (meta.risk_level as string | undefined) ?? null,
      provider: (meta.provider_used as string | undefined) ?? null,
      model: (meta.model as string | undefined) ?? null,
      createdAt: review.created_at,
      freshnessBoundaryMs: FORTY_EIGHT_HOURS_MS,
      overrideExpiresAt: null,
      overrideApprover: null,
    }

    if (reviewAge <= FORTY_EIGHT_HOURS_MS) {
      const riskLevel = meta.risk_level
      if (riskLevel === 'critical') {
        return {
          passed: false,
          reason: 'AI flagged critical risk — admin review required before release',
          snapshot: reviewSnapshot,
        }
      }
      // Valid, non-critical, non-expired review → pass
      return { passed: true, snapshot: reviewSnapshot }
    }
    // Expired review — fall through to check admin override before failing
  }

  // ── 2. Admin override (for AI service unavailability) ─────────────────────
  const ttlHours = Math.max(
    1,
    parseInt(process.env.AI_ADMIN_OVERRIDE_TTL_HOURS ?? '4', 10),
  )
  const ttlMs = ttlHours * 60 * 60 * 1000

  const { data: overrides } = await supabase
    .from('audit_log')
    .select('id, created_at, metadata, actor_id')
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

      const overrideSnapshot: AiReviewSnapshot = {
        source: 'override',
        sourceAuditId: (override as { id?: string }).id ?? null,
        resultType: 'ai_review_admin_override',
        riskLevel: typeof overrideRiskLevel === 'string' ? overrideRiskLevel : String(overrideRiskLevel),
        provider: null,
        model: null,
        createdAt: override.created_at,
        freshnessBoundaryMs: ttlMs,
        overrideExpiresAt: typeof expiresAt === 'string' ? expiresAt : String(expiresAt),
        overrideApprover: (override as { actor_id?: string }).actor_id ?? null,
      }

      return {
        passed:  true,
        warning:
          `Admin override in effect — AI draw review bypassed by admin ` +
          `(asserted risk: ${overrideRiskLevel}, expires: ${expiresAt}).`,
        snapshot: overrideSnapshot,
      }
    }
    // Override exists but has expired — fall through to failure
  }

  // ── 3. No valid review or active override ─────────────────────────────────
  if (!reviews || reviews.length === 0) {
    return { passed: false, reason: 'AI draw review is required before release', snapshot: emptySnapshot }
  }

  // Reviews exist but all are expired — snapshot references the expired review.
  const expiredReview = reviews[0]
  const expiredMeta   = (expiredReview.metadata as Record<string, unknown> | null) ?? {}
  return {
    passed: false,
    reason:
      'AI assessment expired — please request a fresh review. ' +
      'If the AI service is unavailable, an admin can apply a temporary override.',
    snapshot: {
      source: 'review',
      sourceAuditId: (expiredReview as { id?: string }).id ?? null,
      resultType: 'ai_draw_review',
      riskLevel: (expiredMeta.risk_level as string | undefined) ?? null,
      provider: (expiredMeta.provider_used as string | undefined) ?? null,
      model: (expiredMeta.model as string | undefined) ?? null,
      createdAt: expiredReview.created_at,
      freshnessBoundaryMs: FORTY_EIGHT_HOURS_MS,
      overrideExpiresAt: null,
      overrideApprover: null,
    },
  }
}
