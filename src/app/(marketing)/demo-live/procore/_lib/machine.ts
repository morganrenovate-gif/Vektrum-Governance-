/**
 * Procore × Vektrum prototype — pure, deterministic state machine for the
 * MILESTONE-ISOLATION walkthrough.
 *
 * The only production code this module imports is the PURE, side-effect-free
 * reconciliation engine src/lib/engine/release-units.ts — the same functions the
 * domain tests prove. It imports NO gate/token/audit/Supabase/Stripe/auth
 * runtime. Guards reject invalid transitions (the reducer returns the previous
 * context unchanged). Unit-tested by tests/demo-procore-prototype.test.ts.
 */
import {
  reconcileDraw, deriveAuthorizationScope,
  type ReleaseUnit, type DrawReconciliation, type AuthorizationScope,
} from '@/lib/engine/release-units';
import type {
  DemoAction, DemoContext, GateCondition, PreReview, RiskLevel, StatusKind,
  AuditEvent, AuthRound, ReleaseUnitFixture,
} from './types';
import {
  gateConditions, preReviewBefore, preReviewAfter, snapshot,
  UPDATED_SNAPSHOT_TIMESTAMP, auditEvent, releaseUnits, ISOLATED_UNIT_ID,
  authEligible, authResolved,
} from './fixtures';

export const initialContext: DemoContext = {
  state: 'snapshot_available',
  staged: { co_approved: false, waiver_approved: false },
  changeOrderStatus: 'open',
  lienWaiverStatus: 'draft',
  riskLevel: 'critical',
  isolatedResolved: false,
  eligibleAuthorized: false,
  resolvedAuthorized: false,
  externalConfirmationRecorded: false,
  authRound: null,
  snapshotTimestamp: snapshot.snapshotTimestamp,
};

// Deep clone so RESET always yields the *exact* initial fixture state.
export function makeInitialContext(): DemoContext {
  return JSON.parse(JSON.stringify(initialContext));
}

const bothStaged = (c: DemoContext) => c.staged.co_approved && c.staged.waiver_approved;

/** True once the lender-policy pre-review has run (isolation is known). */
function reviewed(c: DemoContext): boolean {
  return c.state !== 'snapshot_available' && c.state !== 'snapshot_imported';
}

// ─── Reducer (guarded) ───────────────────────────────────────────────────────
export function reducer(ctx: DemoContext, action: DemoAction): DemoContext {
  switch (action.type) {
    case 'IMPORT_SNAPSHOT':
      if (ctx.state !== 'snapshot_available') return ctx;
      return { ...ctx, state: 'snapshot_imported' };

    case 'RUN_PRE_REVIEW':
      if (ctx.state !== 'snapshot_imported') return ctx;
      return { ...ctx, state: 'review_isolated' };

    case 'OPEN_AUTHORIZATION':
      if (action.round === 'eligible') {
        if (!canAuthorizeEligible(ctx)) return ctx;
        return { ...ctx, state: 'authorize_eligible_open', authRound: 'eligible' };
      }
      if (!canAuthorizeResolved(ctx)) return ctx;
      return { ...ctx, state: 'authorize_resolved_open', authRound: 'resolved' };

    case 'CLOSE_AUTHORIZATION':
      if (ctx.state === 'authorize_eligible_open') return { ...ctx, state: 'review_isolated', authRound: null };
      if (ctx.state === 'authorize_resolved_open') return { ...ctx, state: 'isolated_resolved', authRound: null };
      return ctx;

    case 'RECORD_AUTHORIZATION':
      if (ctx.state === 'authorize_eligible_open')
        return { ...ctx, state: 'eligible_authorized', eligibleAuthorized: true, authRound: null };
      if (ctx.state === 'authorize_resolved_open')
        return { ...ctx, state: 'resolved_authorized', resolvedAuthorized: true, authRound: null };
      return ctx;

    case 'STAGE_SOURCE_UPDATE': {
      // Source corrections for the isolated unit are only stageable AFTER the
      // eligible units have been authorized (isolation proven first).
      if (ctx.state !== 'eligible_authorized' && ctx.state !== 'source_updates_staged') return ctx;
      const staged = { ...ctx.staged, [action.update]: true };
      const next: DemoContext = { ...ctx, staged };
      next.state = staged.co_approved && staged.waiver_approved ? 'source_updates_staged' : 'eligible_authorized';
      return next;
    }

    case 'RECEIVE_UPDATED_SNAPSHOT':
      if (ctx.state !== 'source_updates_staged' || !bothStaged(ctx)) return ctx;
      return {
        ...ctx,
        state: 'isolated_resolved',
        changeOrderStatus: 'approved',
        lienWaiverStatus: 'approved',
        riskLevel: 'low',
        isolatedResolved: true,
        snapshotTimestamp: UPDATED_SNAPSHOT_TIMESTAMP,
      };

    case 'RECORD_EXTERNAL_CONFIRMATION':
      if (ctx.state !== 'resolved_authorized') return ctx;
      return { ...ctx, state: 'external_confirmation_recorded', externalConfirmationRecorded: true };

    case 'RESET':
      return makeInitialContext();

    default:
      return ctx;
  }
}

// ─── Release-unit views (driven by the REAL reconciliation engine) ───────────
export type ReleaseUnitStatus = ReleaseUnit['status'];

/** Derive one unit's lifecycle status from context — never hard-coded per screen. */
export function unitStatus(ctx: DemoContext, unit: ReleaseUnitFixture): ReleaseUnitStatus {
  if (!reviewed(ctx)) return 'eligible'; // pre-review: not yet evaluated
  if (unit.id === ISOLATED_UNIT_ID) {
    if (!ctx.isolatedResolved) return 'isolated';
    return ctx.resolvedAuthorized ? 'released' : 'eligible';
  }
  // The three unrelated units: eligible until authorized in round 1.
  return ctx.eligibleAuthorized ? 'released' : 'eligible';
}

/** The current unit set as ReleaseUnit[] for the pure engine. */
export function currentUnits(ctx: DemoContext): ReleaseUnit[] {
  return releaseUnits.map((u) => ({
    id: u.id,
    label: u.label,
    grossAmount: u.grossAmount,
    retainageAmount: u.retainageAmount,
    status: unitStatus(ctx, u),
    isolationReason: unitStatus(ctx, u) === 'isolated' ? u.isolationReason : undefined,
  }));
}

/** Unit views for the UI (fixture + derived status). */
export interface ReleaseUnitView extends ReleaseUnitFixture {
  status: ReleaseUnitStatus;
  netAmount: number;
}
export function releaseUnitViews(ctx: DemoContext): ReleaseUnitView[] {
  return releaseUnits.map((u) => ({
    ...u,
    status: unitStatus(ctx, u),
    netAmount: Math.round((u.grossAmount - u.retainageAmount) * 100) / 100,
  }));
}

/** Full draw reconciliation via the production engine (invariant-checked). */
export function drawReconciliation(ctx: DemoContext): DrawReconciliation {
  return reconcileDraw(currentUnits(ctx));
}

/** Authorization scope via the production engine — never includes isolated units. */
export function authorizationScope(ctx: DemoContext): AuthorizationScope {
  return deriveAuthorizationScope(currentUnits(ctx));
}

// ─── Authorization guards ────────────────────────────────────────────────────
export function canAuthorizeEligible(ctx: DemoContext): boolean {
  return ctx.state === 'review_isolated' && !ctx.eligibleAuthorized;
}
export function canAuthorizeResolved(ctx: DemoContext): boolean {
  return ctx.state === 'isolated_resolved' && ctx.isolatedResolved && !ctx.resolvedAuthorized;
}
/** Whichever round is currently authorizable (used for generic button gating). */
export function canAuthorize(ctx: DemoContext): boolean {
  return canAuthorizeEligible(ctx) || canAuthorizeResolved(ctx);
}
export function currentAuthRound(ctx: DemoContext): AuthRound | null {
  if (ctx.authRound) return ctx.authRound;
  if (canAuthorizeEligible(ctx)) return 'eligible';
  if (canAuthorizeResolved(ctx)) return 'resolved';
  return null;
}

/** The authorization record for a given round (round 1 excludes the isolated unit). */
export function authRecordFor(round: AuthRound) {
  return round === 'eligible' ? authEligible : authResolved;
}

// ─── Gate selectors for the ISOLATED unit (informational display) ─────────────
export function effectiveStatus(cond: GateCondition, ctx: DemoContext): StatusKind {
  if (cond.baseStatus === 'not_applicable') return 'not_applicable';
  if (cond.index === 7) return ctx.changeOrderStatus === 'approved' ? 'passed' : 'blocked';
  if (cond.index === 10) return ctx.lienWaiverStatus === 'approved' ? 'passed' : 'blocked';
  return cond.baseStatus;
}
export function effectiveConditions(ctx: DemoContext): Array<GateCondition & { status: StatusKind }> {
  return gateConditions.map((c) => ({ ...c, status: effectiveStatus(c, ctx) }));
}

export interface GateSummary {
  passed: number;
  notApplicable: number;
  blocked: number;
  aiUnresolved: boolean;
}
export function gateSummary(ctx: DemoContext): GateSummary {
  const conds = effectiveConditions(ctx);
  return {
    passed: conds.filter((c) => c.status === 'passed').length,
    notApplicable: conds.filter((c) => c.status === 'not_applicable').length,
    blocked: conds.filter((c) => c.status === 'blocked').length,
    aiUnresolved: !ctx.isolatedResolved,
  };
}

export function currentPreReview(ctx: DemoContext): PreReview {
  return ctx.isolatedResolved ? preReviewAfter : preReviewBefore;
}
export function currentRisk(ctx: DemoContext): RiskLevel {
  return ctx.riskLevel;
}

// ─── Human-readable audit timeline (deterministic; containment + resolution) ──
export function buildAuditEvents(ctx: DemoContext): AuditEvent[] {
  const out: AuditEvent[] = [];
  if (ctx.state !== 'snapshot_available')
    out.push(auditEvent('Vektrum (system)', 'July 21, 2026 at 10:42 AM MDT', 'Snapshot imported', 'Simulated project snapshot imported from the originating project workflow.', 'DEMO-EVT-IMPORT-07'));
  if (reviewed(ctx))
    out.push(auditEvent('Vektrum AI pre-review', 'July 21, 2026 at 10:44 AM MDT', 'Unit isolated', 'Pre-review contained two policy exceptions (CO-027 open; conditional lien waiver not approved) to the structural-steel unit (SOV 03-100, $310,000). Three other units unaffected.', 'DEMO-EVT-ISOLATE-STEEL'));
  if (ctx.eligibleAuthorized)
    out.push(auditEvent('Olivia Chen (Authorized funder)', authEligible.authorizedAt, 'Authorization recorded — eligible units', 'Funder authorized the three eligible units ($1,776,500 net). Authorization scope EXCLUDES the isolated steel unit. No payment executed by Vektrum.', authEligible.authorizationId));
  if (ctx.isolatedResolved) {
    out.push(auditEvent('Originating project workflow (simulated)', 'July 21, 2026 at 11:10 AM MDT', 'Source record updated', 'CO-027 approved at source by an authorized project user (simulated).', 'DEMO-EVT-CO-027'));
    out.push(auditEvent('Originating project workflow (simulated)', 'July 21, 2026 at 11:11 AM MDT', 'Source record updated', 'Conditional lien waiver approved at source by an authorized project user (simulated).', 'DEMO-EVT-LW-07'));
    out.push(auditEvent('Vektrum (system)', UPDATED_SNAPSHOT_TIMESTAMP, 'Updated snapshot received', 'Updated source snapshot received; the isolated unit’s governed records refreshed.', 'DEMO-EVT-SNAPSHOT-2'));
    out.push(auditEvent('Vektrum AI pre-review', 'July 21, 2026 at 11:16 AM MDT', 'Unit re-evaluated', 'Structural-steel unit re-evaluated to Low risk; conditions 7 and 10 now pass. Unit returns to eligible.', 'DEMO-EVT-REEVAL-STEEL'));
  }
  if (ctx.resolvedAuthorized)
    out.push(auditEvent('Olivia Chen (Authorized funder)', authResolved.authorizedAt, 'Authorization recorded — resolved unit', 'Funder recorded a SEPARATE authorization for the resolved steel unit ($294,500 net). The earlier eligible-unit authorization is unchanged.', authResolved.authorizationId));
  if (ctx.externalConfirmationRecorded)
    out.push(auditEvent('Mountain West Title & Escrow (external, simulated)', 'July 21, 2026 at 11:31 AM MDT', 'External confirmation recorded', 'External partner returned a simulated execution confirmation reference for the authorized releases.', 'DEMO-MWTE-88241'));
  return out;
}
