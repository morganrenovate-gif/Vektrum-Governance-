// ─── Billing Engine ──────────────────────────────────────────────────────────
//
// All fee calculations live here and ONLY here.
// Nothing in the UI, nothing in route handlers — pure computation.
//
// Fee model:
//   - Funder pays milestone_amount + fee.
//   - Contractor always receives the full gross (milestone_amount).
//   - Fee is retained in the Vektrum platform Stripe account.
//   - fee = ROUND(gross * bps / 10000, 2)

// ─── Rate Constants ───────────────────────────────────────────────────────────

/**
 * Minimum platform fee per milestone release, in USD.
 *
 * Applied as a floor so that small milestones still cover operational overhead.
 * The DB constraint billing_records_fee_accurate uses GREATEST(..., 2.50) to
 * accept records where the calculated rate-based fee would fall below this floor.
 *
 * $2.50 was chosen as a break-even threshold for Stripe transfer fees + overhead.
 */
export const MINIMUM_FEE = 2.50

export const BILLING_RATES = {
  /** 1.00% — Standalone tier (self-service, no retainer) */
  STANDALONE:    100,
  /** 0.70% — Institutional tier (retainer applies) */
  INSTITUTIONAL:  70,
  /** 0.65% — Enterprise tier (negotiated annually) */
  ENTERPRISE:     65,
} as const

export type BillingRateBps = typeof BILLING_RATES[keyof typeof BILLING_RATES]

/** Values that match the profiles.subscription_tier DB CHECK constraint. */
export type SubscriptionTier = 'standalone' | 'institutional' | 'enterprise'

/**
 * Maps a funder's subscription tier to the correct billing rate in basis points.
 *
 * Called at deal-funding time so the deal's billing_rate_bps is always derived
 * from the funder's actual tier — never from user-supplied input.
 *
 * @param tier - The funder's subscription_tier from their profile row.
 * @returns The corresponding BillingRateBps value.
 */
export function billingRateFromTier(tier: SubscriptionTier): BillingRateBps {
  switch (tier) {
    case 'institutional': return BILLING_RATES.INSTITUTIONAL
    case 'enterprise':    return BILLING_RATES.ENTERPRISE
    case 'standalone':
    default:              return BILLING_RATES.STANDALONE
  }
}

/**
 * Returns a human-readable description of the governance fee for a subscription tier.
 *
 * Used in billing portal, admin subscription management, and deal creation UI
 * to give funders a clear summary of what fee applies to their account.
 *
 * @param tier - The funder's subscription tier.
 * @returns A display string, e.g. "1.00% governance fee (Standalone)".
 */
export function getFeeDescription(tier: SubscriptionTier): string {
  switch (tier) {
    case 'institutional': return '0.70% governance fee (Institutional)'
    case 'enterprise':    return '0.65% governance fee (Enterprise)'
    case 'standalone':
    default:              return '1.00% governance fee (Standalone)'
  }
}

/** Human-readable label for a given rate in basis points. */
export function rateLabel(bps: number): string {
  switch (bps) {
    case BILLING_RATES.STANDALONE:    return '1.00%'
    case BILLING_RATES.INSTITUTIONAL: return '0.70%'
    case BILLING_RATES.ENTERPRISE:    return '0.65%'
    default:                          return `${(bps / 100).toFixed(2)}%`
  }
}

// ─── Fee Breakdown ────────────────────────────────────────────────────────────

export interface FeeBreakdown {
  /** The full milestone amount — what the contractor receives. */
  grossAmount:    number
  /** The plan rate that was applied, in basis points. */
  billingRateBps: number
  /** Platform fee charged to the funder on top of the gross amount. */
  feeAmount:      number
  /** Contractor payout. Always equals grossAmount — contractors are never charged. */
  netAmount:      number
  /** Total deducted from the funder's funded balance: grossAmount + feeAmount. */
  totalDebit:     number
  /** Human-readable rate string, e.g. "1.00%". */
  rateLabel:      string
}

// ─── Core Calculation ────────────────────────────────────────────────────────

/**
 * Calculates the platform fee for a milestone release.
 *
 * Fee is rounded to two decimal places (banker's rounding is not used —
 * standard Math.round is fine for USD amounts at this precision).
 *
 * The MINIMUM_FEE floor ($2.50) is applied after rounding, so the returned
 * feeAmount is always ≥ $2.50 regardless of milestone size.
 *
 * The DB constraint billing_records_fee_accurate enforces that the stored
 * fee_amount is within ±$0.01 of GREATEST(calculated, 2.50), providing a
 * second layer of validation.
 *
 * @param grossAmount    - The milestone amount (must be > 0).
 * @param billingRateBps - The deal's plan rate in basis points (100 | 70 | 65).
 */
export function calculateFee(grossAmount: number, billingRateBps: number): FeeBreakdown {
  if (grossAmount <= 0) {
    throw new Error(`calculateFee: grossAmount must be > 0 (received ${grossAmount})`)
  }
  if (billingRateBps <= 0) {
    throw new Error(`calculateFee: billingRateBps must be > 0 (received ${billingRateBps})`)
  }

  // Round to 2 decimal places — matches ROUND(..., 2) in the DB constraint.
  // Apply the MINIMUM_FEE floor so small milestones still cover operational overhead.
  // The DB constraint billing_records_fee_accurate uses GREATEST(..., 2.50) to match.
  const calculated = Math.round(grossAmount * billingRateBps / 10000 * 100) / 100
  const feeAmount  = Math.max(calculated, MINIMUM_FEE)
  const netAmount  = grossAmount          // contractor always receives full gross
  const totalDebit = grossAmount + feeAmount

  return {
    grossAmount,
    billingRateBps,
    feeAmount,
    netAmount,
    totalDebit,
    rateLabel: rateLabel(billingRateBps),
  }
}

// ─── Governance Facility ──────────────────────────────────────────────────────
//
// The governance fee model presents the platform fee as a funder-paid oversight
// layer on top of the construction budget, rather than something deducted from
// project disbursements. Contractors always receive the full gross milestone amount.
//
// facility_total = construction_budget + governance_fee_total
//
// This is a DISPLAY model — it does not change how Stripe transfers or billing
// records work. It gives funders a clear picture of their total commitment.

export interface GovernanceFacility {
  /** The total contract value committed to contractor disbursements. */
  constructionBudget:  number
  /** Governance fee rate applied, in basis points. */
  governanceFeeBps:    number
  /** Total governance fee for the full deal: ROUND(budget × bps / 10000, 2). */
  governanceFeeTotal:  number
  /** Total funder commitment: constructionBudget + governanceFeeTotal. */
  facilityTotal:       number
  /** Human-readable governance fee rate, e.g. "1.00%". */
  rateLabel:           string
}

/**
 * Calculates the governance facility breakdown for a deal.
 *
 * Called at deal creation (using the default STANDALONE rate) and again at
 * funding time (using the funder's actual subscription tier rate). The result
 * is stored on the deal row so the funder always sees the correct facility size.
 *
 * @param constructionBudget - Total contract value (mirrors deal.total_amount).
 * @param feeBps             - Governance fee rate in basis points (65 | 70 | 100).
 */
export function calculateGovernanceFacility(
  constructionBudget: number,
  feeBps: BillingRateBps,
): GovernanceFacility {
  if (constructionBudget <= 0) {
    throw new Error(`calculateGovernanceFacility: constructionBudget must be > 0 (received ${constructionBudget})`)
  }
  const governanceFeeTotal = Math.round(constructionBudget * feeBps / 10000 * 100) / 100
  return {
    constructionBudget,
    governanceFeeBps:  feeBps,
    governanceFeeTotal,
    facilityTotal:     constructionBudget + governanceFeeTotal,
    rateLabel:         rateLabel(feeBps),
  }
}

// ─── Retainage ────────────────────────────────────────────────────────────────
//
// Retainage is a percentage of each milestone gross amount withheld until the
// project reaches substantial completion. Industry standard: 5-10%.
//
// Key accounting rule: platform fee is computed on the full gross amount, NOT
// on the net-to-contractor. The contractor bears no fee; the retainage is simply
// a deferred portion of the contractor's own proceeds.
//
// net_to_contractor = gross - retainage
// Stripe transfer   = net_to_contractor (contractor receives net immediately)
// retainage_held   += retainage per milestone (held until funder releases)

export interface RetainageBreakdown {
  /** The full milestone amount (gross). */
  grossAmount:        number
  /** Retainage percentage applied (0–<100). */
  retainagePercentage: number
  /** Dollar amount withheld: ROUND(gross × retainagePercentage / 100, 2). */
  retainageAmount:    number
  /** Amount actually transferred to the contractor: gross - retainageAmount. */
  netToContractor:    number
}

/**
 * Calculates the retainage withheld from a milestone release.
 *
 * When retainagePercentage is 0 (default), retainageAmount = 0 and
 * netToContractor = grossAmount — identical to a no-retainage release.
 *
 * @param grossAmount          - The full milestone amount (must be > 0).
 * @param retainagePercentage  - Deal-level retainage rate, 0 to <100.
 */
export function calculateRetainage(
  grossAmount: number,
  retainagePercentage: number,
): RetainageBreakdown {
  if (grossAmount <= 0) {
    throw new Error(`calculateRetainage: grossAmount must be > 0 (received ${grossAmount})`)
  }
  if (retainagePercentage < 0 || retainagePercentage >= 100) {
    throw new Error(
      `calculateRetainage: retainagePercentage must be in [0, 100) (received ${retainagePercentage})`
    )
  }

  // Round to 2 decimal places — matches DB ROUND(..., 2)
  const retainageAmount = Math.round(grossAmount * retainagePercentage / 100 * 100) / 100
  return {
    grossAmount,
    retainagePercentage,
    retainageAmount,
    netToContractor: grossAmount - retainageAmount,
  }
}


// ─── Stripe Helpers ───────────────────────────────────────────────────────────

/**
 * Converts a dollar amount to integer cents for Stripe API calls.
 * Stripe requires integer amounts — never pass floats.
 *
 * @param amount - Dollar amount with up to 2 decimal places (e.g. 1250.50).
 * @returns Integer cents (e.g. 125050).
 */
export function toStripeCents(amount: number): number {
  return Math.round(amount * 100)
}
