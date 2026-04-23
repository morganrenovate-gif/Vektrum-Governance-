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

export const BILLING_RATES = {
  /** 1.00% — Standalone tier (self-service, no retainer) */
  STANDALONE:    100,
  /** 0.70% — Institutional tier (retainer applies) */
  INSTITUTIONAL:  70,
  /** 0.65% — Enterprise tier (negotiated annually) */
  ENTERPRISE:     65,
} as const

export type BillingRateBps = typeof BILLING_RATES[keyof typeof BILLING_RATES]

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
 * The DB constraint billing_records_fee_accurate enforces that the stored
 * fee_amount is within ±$0.01 of this calculation, providing a second layer
 * of validation.
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

  // Round to 2 decimal places — matches ROUND(..., 2) in the DB constraint
  const feeAmount  = Math.round(grossAmount * billingRateBps / 10000 * 100) / 100
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
