/**
 * Procore × Vektrum prototype — pure, deterministic state machine.
 *
 * No React, no network, no production imports. Guards reject invalid
 * transitions (the reducer returns the previous context unchanged). This module
 * is unit-tested directly by tests/demo-procore-prototype.test.ts.
 */
import type {
  DemoAction, DemoContext, GateCondition, PreReview, RiskLevel, StatusKind,
} from './types';
import {
  gateConditions, preReviewBefore, preReviewAfter, snapshot,
  UPDATED_SNAPSHOT_TIMESTAMP, auditEvent,
} from './fixtures';
import type { AuditEvent } from './types';

export const initialContext: DemoContext = {
  state: 'snapshot_available',
  staged: { co_approved: false, waiver_approved: false },
  changeOrderStatus: 'open',
  lienWaiverStatus: 'draft',
  riskLevel: 'critical',
  aiRequirementSatisfied: false,
  authorizationRecorded: false,
  externalConfirmationRecorded: false,
  snapshotTimestamp: snapshot.snapshotTimestamp,
};

// Deep clone so RESET always yields the *exact* initial fixture state.
export function makeInitialContext(): DemoContext {
  return JSON.parse(JSON.stringify(initialContext));
}

const bothStaged = (c: DemoContext) => c.staged.co_approved && c.staged.waiver_approved;
const updatesApplied = (c: DemoContext) =>
  c.changeOrderStatus === 'approved' && c.lienWaiverStatus === 'approved';

// ─── Reducer (guarded) ───────────────────────────────────────────────────────
export function reducer(ctx: DemoContext, action: DemoAction): DemoContext {
  switch (action.type) {
    case 'IMPORT_SNAPSHOT':
      if (ctx.state !== 'snapshot_available') return ctx;
      return { ...ctx, state: 'snapshot_imported' };

    case 'RUN_PRE_REVIEW':
      if (ctx.state !== 'snapshot_imported') return ctx;
      return { ...ctx, state: 'review_blocked' };

    case 'STAGE_SOURCE_UPDATE': {
      if (ctx.state !== 'review_blocked' && ctx.state !== 'source_updates_staged') return ctx;
      const staged = { ...ctx.staged, [action.update]: true };
      const next: DemoContext = { ...ctx, staged };
      next.state = staged.co_approved && staged.waiver_approved
        ? 'source_updates_staged' : 'review_blocked';
      return next;
    }

    case 'RECEIVE_UPDATED_SNAPSHOT':
      // Guard: cannot receive an updated snapshot until BOTH updates are staged.
      if (ctx.state !== 'source_updates_staged' || !bothStaged(ctx)) return ctx;
      return {
        ...ctx,
        state: 'gate_ready',
        changeOrderStatus: 'approved',
        lienWaiverStatus: 'approved',
        riskLevel: 'low',
        aiRequirementSatisfied: true,
        snapshotTimestamp: UPDATED_SNAPSHOT_TIMESTAMP,
      };

    case 'OPEN_AUTHORIZATION':
      // Guard: cannot authorize while any applicable condition is blocked or AI is unresolved.
      if (ctx.state !== 'gate_ready' || !canAuthorize(ctx)) return ctx;
      return { ...ctx, state: 'authorization_modal_open' };

    case 'CLOSE_AUTHORIZATION':
      if (ctx.state !== 'authorization_modal_open') return ctx;
      return { ...ctx, state: 'gate_ready' };

    case 'RECORD_AUTHORIZATION':
      if (ctx.state !== 'authorization_modal_open') return ctx;
      return { ...ctx, state: 'authorization_recorded', authorizationRecorded: true };

    case 'RECORD_EXTERNAL_CONFIRMATION':
      // Guard: external confirmation is impossible before authorization is recorded.
      if (ctx.state !== 'authorization_recorded') return ctx;
      return { ...ctx, state: 'external_confirmation_recorded', externalConfirmationRecorded: true };

    case 'RESET':
      return makeInitialContext();

    default:
      return ctx;
  }
}

// ─── Selectors (derived, pure) ───────────────────────────────────────────────
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
  authorizationAvailable: boolean;
}

export function gateSummary(ctx: DemoContext): GateSummary {
  const conds = effectiveConditions(ctx);
  const passed = conds.filter((c) => c.status === 'passed').length;
  const notApplicable = conds.filter((c) => c.status === 'not_applicable').length;
  const blocked = conds.filter((c) => c.status === 'blocked').length;
  return {
    passed,
    notApplicable,
    blocked,
    aiUnresolved: !ctx.aiRequirementSatisfied,
    authorizationAvailable: canAuthorize(ctx),
  };
}

/** All *applicable* (non–not-applicable) conditions pass AND AI requirement satisfied. */
export function allApplicablePass(ctx: DemoContext): boolean {
  return effectiveConditions(ctx).every(
    (c) => c.status === 'passed' || c.status === 'not_applicable',
  );
}

export function canAuthorize(ctx: DemoContext): boolean {
  return allApplicablePass(ctx) && ctx.aiRequirementSatisfied && !ctx.authorizationRecorded;
}

export function isGateReady(ctx: DemoContext): boolean {
  return updatesApplied(ctx) && allApplicablePass(ctx);
}

export function currentPreReview(ctx: DemoContext): PreReview {
  return updatesApplied(ctx) ? preReviewAfter : preReviewBefore;
}

export function currentRisk(ctx: DemoContext): RiskLevel {
  return ctx.riskLevel;
}

// ─── Human-readable audit timeline (deterministic) ───────────────────────────
const rank: Record<DemoContext['state'], number> = {
  snapshot_available: 0,
  snapshot_imported: 1,
  review_blocked: 2,
  source_updates_staged: 3,
  updated_snapshot_received: 4,
  gate_ready: 4,
  authorization_modal_open: 4,
  authorization_recorded: 5,
  external_confirmation_recorded: 6,
};

export function buildAuditEvents(ctx: DemoContext): AuditEvent[] {
  const out: AuditEvent[] = [];
  const r = rank[ctx.state];
  if (r >= 1) out.push(auditEvent('Vektrum (system)', 'July 21, 2026 at 10:42 AM MDT', 'Snapshot imported', 'Simulated project snapshot imported from the originating project workflow.', 'DEMO-EVT-IMPORT-07'));
  if (r >= 2) out.push(auditEvent('Vektrum AI pre-review', 'July 21, 2026 at 10:43 AM MDT', 'Pre-review completed', 'Lender-policy pre-review identified two policy exceptions (CO-027 open; conditional lien waiver not approved).', 'DEMO-EVT-PREREVIEW-07'));
  if (updatesApplied(ctx)) {
    out.push(auditEvent('Originating project workflow (simulated)', 'July 21, 2026 at 10:56 AM MDT', 'Source record updated', 'CO-027 approved at source by an authorized project user (simulated).', 'DEMO-EVT-CO-027'));
    out.push(auditEvent('Originating project workflow (simulated)', 'July 21, 2026 at 10:57 AM MDT', 'Source record updated', 'Conditional lien waiver approved at source by an authorized project user (simulated).', 'DEMO-EVT-LW-07'));
    out.push(auditEvent('Vektrum (system)', UPDATED_SNAPSHOT_TIMESTAMP, 'Updated snapshot received', 'Updated source snapshot received; governed records refreshed.', 'DEMO-EVT-SNAPSHOT-2'));
    out.push(auditEvent('Vektrum AI pre-review', 'July 21, 2026 at 10:59 AM MDT', 'Pre-review updated', 'Pre-review updated to Low risk; no unresolved critical risk.', 'DEMO-EVT-PREREVIEW-2'));
    out.push(auditEvent('Vektrum governance gate', 'July 21, 2026 at 11:00 AM MDT', 'Release gate passed', 'All applicable lender-policy conditions passed (condition 4 not applicable — external rail).', 'DEMO-EVT-GATE-07'));
  }
  if (ctx.authorizationRecorded) out.push(auditEvent('Olivia Chen (Authorized funder)', 'July 21, 2026 at 11:08 AM MDT', 'Authorization recorded', 'Funder recorded lender release authorization. No payment executed by Vektrum.', 'DEMO-AUTH-HPMC-07'));
  if (ctx.externalConfirmationRecorded) out.push(auditEvent('Mountain West Title & Escrow (external, simulated)', 'July 21, 2026 at 11:26 AM MDT', 'External confirmation recorded', 'External partner returned a simulated execution confirmation reference.', 'DEMO-MWTE-88241'));
  return out;
}
