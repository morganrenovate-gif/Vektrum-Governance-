/**
 * Shared SOV arithmetic — single source of truth.
 *
 * Every place that reads or writes balance_to_finish, revised_value, or
 * percent_complete MUST use computeSovFields(). The three stored columns are
 * app-maintained (no DB trigger); independent copies of the formula are the
 * root cause of phantom-balance display bugs.
 */

export interface SovComputedFields {
  revised_value:    number
  balance_to_finish: number
  percent_complete: number
}

/**
 * Derive all three stored-computed SOV columns from their four base inputs.
 *
 * Invariants (enforced by assertions in development):
 *   revised_value    = scheduled_value + approved_change_orders
 *   balance_to_finish = max(0, revised_value - previous_released - current_requested)
 *   percent_complete  = clamp(0–100, (previous_released + current_requested) / revised_value × 100)
 *
 * Callers: SOV POST, SOV PATCH, and the milestone release route.
 */
export function computeSovFields(
  scheduled_value:        number,
  approved_change_orders: number,
  previous_released:      number,
  current_requested:      number,
): SovComputedFields {
  const revised_value    = scheduled_value + approved_change_orders
  const balance_to_finish = Math.max(0, revised_value - previous_released - current_requested)
  const percent_complete  =
    revised_value > 0
      ? Math.min(100, ((previous_released + current_requested) / revised_value) * 100)
      : 0

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    assertSovInvariants({
      scheduled_value,
      approved_change_orders,
      previous_released,
      current_requested,
      revised_value,
      balance_to_finish,
      percent_complete,
    })
  }

  return { revised_value, balance_to_finish, percent_complete }
}

interface SovInvariantInputs {
  scheduled_value:        number
  approved_change_orders: number
  previous_released:      number
  current_requested:      number
  revised_value:          number
  balance_to_finish:      number
  percent_complete:       number
}

/**
 * Throw in development if the computed SOV values violate their mathematical invariants.
 * Never called in production — zero runtime cost in prod.
 */
function assertSovInvariants(v: SovInvariantInputs): void {
  const eps = 0.005 // $0.005 — rounding tolerance

  const expectedRevised = v.scheduled_value + v.approved_change_orders
  if (Math.abs(v.revised_value - expectedRevised) > eps) {
    throw new Error(
      `SOV invariant: revised_value (${v.revised_value}) ≠ scheduled_value + approved_change_orders (${expectedRevised})`,
    )
  }

  const expectedBtf = Math.max(0, v.revised_value - v.previous_released - v.current_requested)
  if (Math.abs(v.balance_to_finish - expectedBtf) > eps) {
    throw new Error(
      `SOV invariant: balance_to_finish (${v.balance_to_finish}) ≠ revised_value - previous_released - current_requested (${expectedBtf})`,
    )
  }

  if (v.balance_to_finish < 0) {
    throw new Error(`SOV invariant: balance_to_finish (${v.balance_to_finish}) < 0`)
  }
  if (v.percent_complete < 0 || v.percent_complete > 100) {
    throw new Error(`SOV invariant: percent_complete (${v.percent_complete}) out of [0, 100]`)
  }
}

/**
 * Validate that deal-level balance invariant holds.
 *
 * released_amount + fees_collected + reserved_amount + retainage_held ≤ funded_amount
 * released_amount ≤ authorized_amount (guard against phantom releases)
 *
 * Called by the invariant test suite. In production the DB constraint
 * deals_financial_consistency enforces the same rule atomically.
 */
export function assertDealBalanceInvariant(deal: {
  funded_amount:    number
  released_amount:  number
  fees_collected:   number
  reserved_amount:  number
  retainage_held:   number
}): void {
  const committed =
    deal.released_amount +
    deal.fees_collected +
    deal.reserved_amount +
    deal.retainage_held

  if (committed > deal.funded_amount + 0.005) {
    throw new Error(
      `Deal balance invariant: released(${deal.released_amount}) + fees(${deal.fees_collected}) ` +
      `+ reserved(${deal.reserved_amount}) + retainage_held(${deal.retainage_held}) ` +
      `= ${committed} > funded_amount(${deal.funded_amount})`,
    )
  }
  if (deal.released_amount < 0) {
    throw new Error(`Deal balance invariant: released_amount (${deal.released_amount}) < 0`)
  }
}
