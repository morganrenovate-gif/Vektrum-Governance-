/**
 * Release-unit reconciliation and authorization scoping — the deterministic
 * arithmetic behind **milestone isolation**.
 *
 * Vektrum has two paired core capabilities:
 *   1. Policy-based release governance decides WHETHER a release unit is eligible
 *      (the deterministic gate, src/lib/engine/release-gate.ts).
 *   2. Milestone isolation decides HOW NARROWLY a failed/disputed unit affects the
 *      rest of the draw (this module + the per-milestone protection_status/dispute
 *      model).
 *
 * A "release unit" is one milestone (or, at finer grain, one SOV line) that can be
 * independently evaluated, isolated, authorized, and executed. When a unit is
 * disputed or fails a required condition, the amount attached to that unit is
 * ISOLATED: it is removed from the authorizable total and can never be included in
 * an authorization scope, while unrelated eligible units keep flowing.
 *
 * This module is PURE and SYNCHRONOUS. It performs no I/O and imports nothing from
 * Stripe/Supabase/auth. It is the single source of truth for the reconciliation
 * equations, shared by the release surfaces AND the Procore guided demo AND the
 * tests — so the numbers a presenter sees are computed by the same audited code
 * that the invariants are proven against, not hard-coded UI state.
 *
 * FINANCIAL INVARIANTS (all enforced at runtime; violations throw):
 *
 *   drawGross = eligibleGross + isolatedGross + alreadyReleasedGross          (I1)
 *   authorizedGross ⊆ eligibleGross  →  authorizedGross ≤ eligibleGross       (I2)
 *   every amount ≥ 0                                                          (I3)
 *   retainageWithheld ≤ drawGross, applied per-unit, never released here      (I4)
 *   an isolated (or already-released) unit id ∉ authorization scope           (I5)
 *
 * These mirror the deal-level ledger (deals.funded_amount / released_amount /
 * reserved_amount / retainage_*) and the SOV line math (scheduled/previous_released/
 * current_requested/retainage_amount) already enforced in the database; this module
 * makes the DRAW-level, isolation-aware view explicit and testable.
 */

/** Lifecycle of one release unit within a single draw. */
export type ReleaseUnitStatus =
  | 'eligible' //   passed its gate; may be included in an authorization scope
  | 'isolated' //   disputed or failed a required condition; amount is contained
  | 'released'; //  already authorized+executed in this or a prior draw

export interface ReleaseUnit {
  /** Stable identifier (milestone id in production; DEMO-/SIM- id in the demo). */
  id: string;
  label: string;
  /** Gross requested amount for this unit, in dollars. */
  grossAmount: number;
  /** Retainage withheld on this unit (never released by this module). */
  retainageAmount: number;
  status: ReleaseUnitStatus;
  /** Machine reason a unit is isolated (dispute id, failed condition code, …). */
  isolationReason?: string;
}

export interface DrawReconciliation {
  /** Sum of every unit's gross — the full draw request. */
  drawGross: number;
  /** Sum of retainage across every unit. */
  retainageWithheld: number;
  /** Net (gross − retainage) across every unit; the represented net draw. */
  drawNet: number;

  /** Gross of units currently eligible to proceed. */
  eligibleGross: number;
  /** Net of eligible units — the maximum a single authorization may cover. */
  eligibleNet: number;

  /** Gross of isolated (contained) units. */
  isolatedGross: number;
  /** Net of isolated units — provably excluded from any authorization. */
  isolatedNet: number;

  /** Gross of units already released (this or prior draws in the set). */
  alreadyReleasedGross: number;
}

function assertFinite(name: string, v: number): void {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`release-units: ${name} must be a finite number (got ${String(v)}).`);
  }
}

/** Round to cents to avoid float drift breaking exact-equality invariants. */
function cents(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Validate a set of units and compute the isolation-aware draw reconciliation.
 * Throws on any invariant violation (I3, I4) so a malformed unit set can never
 * silently produce a wrong authorizable total.
 */
export function reconcileDraw(units: ReleaseUnit[]): DrawReconciliation {
  if (!Array.isArray(units) || units.length === 0) {
    throw new Error('release-units: reconcileDraw requires at least one unit.');
  }

  const seen = new Set<string>();
  let drawGross = 0;
  let retainageWithheld = 0;
  let eligibleGross = 0;
  let eligibleRetainage = 0;
  let isolatedGross = 0;
  let isolatedRetainage = 0;
  let alreadyReleasedGross = 0;

  for (const u of units) {
    if (!u.id) throw new Error('release-units: every unit needs a stable id.');
    if (seen.has(u.id)) throw new Error(`release-units: duplicate unit id "${u.id}".`);
    seen.add(u.id);

    assertFinite(`unit ${u.id} grossAmount`, u.grossAmount);
    assertFinite(`unit ${u.id} retainageAmount`, u.retainageAmount);

    // I3 — no negative amounts.
    if (u.grossAmount < 0) throw new Error(`release-units: unit "${u.id}" has negative gross.`);
    if (u.retainageAmount < 0) throw new Error(`release-units: unit "${u.id}" has negative retainage.`);
    // I4 — retainage cannot exceed the unit's gross.
    if (u.retainageAmount > u.grossAmount) {
      throw new Error(`release-units: unit "${u.id}" retainage exceeds its gross.`);
    }

    drawGross += u.grossAmount;
    retainageWithheld += u.retainageAmount;

    switch (u.status) {
      case 'eligible':
        eligibleGross += u.grossAmount;
        eligibleRetainage += u.retainageAmount;
        break;
      case 'isolated':
        isolatedGross += u.grossAmount;
        isolatedRetainage += u.retainageAmount;
        break;
      case 'released':
        alreadyReleasedGross += u.grossAmount;
        break;
      default:
        throw new Error(`release-units: unit "${u.id}" has unknown status "${String(u.status)}".`);
    }
  }

  const recon: DrawReconciliation = {
    drawGross: cents(drawGross),
    retainageWithheld: cents(retainageWithheld),
    drawNet: cents(drawGross - retainageWithheld),
    eligibleGross: cents(eligibleGross),
    eligibleNet: cents(eligibleGross - eligibleRetainage),
    isolatedGross: cents(isolatedGross),
    isolatedNet: cents(isolatedGross - isolatedRetainage),
    alreadyReleasedGross: cents(alreadyReleasedGross),
  };

  // I1 — the partition must be exact (no double counting, nothing lost).
  const partition = cents(recon.eligibleGross + recon.isolatedGross + recon.alreadyReleasedGross);
  if (partition !== recon.drawGross) {
    throw new Error(
      `release-units: reconciliation broken — eligible($${recon.eligibleGross}) + ` +
        `isolated($${recon.isolatedGross}) + released($${recon.alreadyReleasedGross}) = ` +
        `$${partition} ≠ drawGross $${recon.drawGross}.`,
    );
  }

  return recon;
}

export interface AuthorizationScope {
  /** Unit ids the funder may authorize now — eligible units only (I5). */
  unitIds: string[];
  /** Gross the scope covers. */
  grossAmount: number;
  /** Net the scope covers — the exact authorizable amount. */
  netAmount: number;
  /** Unit ids explicitly EXCLUDED because they are isolated. */
  excludedIsolatedUnitIds: string[];
}

/**
 * Derive the authorization scope from a unit set: eligible units only. An
 * isolated or already-released unit id can NEVER appear in `unitIds` (I5), and the
 * covered amount is exactly the eligible net (I2). Callers bind an authorization
 * token/record to `unitIds` + `netAmount`; because isolated units are absent, the
 * isolated amount is structurally unauthorizable.
 */
export function deriveAuthorizationScope(units: ReleaseUnit[]): AuthorizationScope {
  const recon = reconcileDraw(units); // re-validates invariants
  const eligible = units.filter((u) => u.status === 'eligible');
  const excludedIsolatedUnitIds = units.filter((u) => u.status === 'isolated').map((u) => u.id);

  const grossAmount = cents(eligible.reduce((s, u) => s + u.grossAmount, 0));
  const netAmount = cents(eligible.reduce((s, u) => s + (u.grossAmount - u.retainageAmount), 0));

  // I2 — authorization can never exceed the eligible net.
  if (netAmount > recon.eligibleNet + 0.001) {
    throw new Error('release-units: authorization scope exceeds eligible net.');
  }
  // I5 — no isolated unit may leak into the scope.
  for (const id of eligible.map((u) => u.id)) {
    if (excludedIsolatedUnitIds.includes(id)) {
      throw new Error(`release-units: unit "${id}" is both eligible and isolated.`);
    }
  }

  return {
    unitIds: eligible.map((u) => u.id),
    grossAmount,
    netAmount,
    excludedIsolatedUnitIds,
  };
}

/**
 * Assert that a proposed authorization (the unit ids + net a caller intends to
 * bind into a token/record) is safe against a unit set. Returns the caller's
 * amount unchanged on success; throws if the request includes an isolated unit or
 * exceeds the eligible net. Use at the authorization boundary as a belt-and-braces
 * check in addition to `deriveAuthorizationScope`.
 */
export function assertAuthorizationWithinScope(
  units: ReleaseUnit[],
  requestedUnitIds: string[],
  requestedNet: number,
): number {
  assertFinite('requestedNet', requestedNet);
  if (requestedNet < 0) throw new Error('release-units: requestedNet cannot be negative.');

  const scope = deriveAuthorizationScope(units);
  const allowed = new Set(scope.unitIds);

  for (const id of requestedUnitIds) {
    if (!allowed.has(id)) {
      throw new Error(
        `release-units: unit "${id}" is not authorizable (isolated, released, or unknown).`,
      );
    }
  }
  if (cents(requestedNet) > cents(scope.netAmount) + 0.001) {
    throw new Error(
      `release-units: requested net $${cents(requestedNet)} exceeds eligible net $${scope.netAmount}.`,
    );
  }
  return requestedNet;
}
