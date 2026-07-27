/**
 * Procore × Vektrum prototype — pure, deterministic state machine.
 *
 * No React, no network, no production imports. Guards reject invalid
 * transitions (the reducer returns the previous context unchanged). This module
 * is unit-tested directly by tests/demo-procore-prototype.test.ts.
 *
 * Canonical truths preserved mechanically:
 *   - AI-assisted pre-review informs; the deterministic gate decides.
 *   - Conditions 7 and 10 clear ONLY when their own simulated source record is
 *     corrected; each correction advances the evidence snapshot (V1→V2→V3).
 *   - Condition 4 is Not applicable on the external rail — never "passed".
 *   - Authorization requires ALL applicable conditions + AI requirement, and an
 *     explicit FUNDER action. Admin/contractor/partner/AI actors are rejected.
 *   - Authorization never confirms execution; external confirmation only after
 *     authorization. RESET restores the exact initial fixture.
 */
import type {
  DemoAction, DemoContext, GateCondition, PreReview, StatusKind,
  FinancialImpactFixture, AuditEvent,
} from './types';
import {
  gateConditions, impact, changeOrder, SNAPSHOT_ID_BASE, SNAPSHOT_TIMESTAMPS,
  PRE_REVIEW_TEXT, auditEvent,
} from './fixtures';

export const initialContext: DemoContext = {
  state: 'workspace',
  changeOrderStatus: 'pending',
  lienWaiverStatus: 'unapproved',
  riskLevel: 'critical',
  aiRequirementSatisfied: false,
  authorizationRecorded: false,
  externalConfirmationRecorded: false,
  snapshotVersion: 1,
};

// Deep clone so RESET always yields the *exact* initial fixture state.
export function makeInitialContext(): DemoContext {
  return JSON.parse(JSON.stringify(initialContext));
}

const bothResolved = (c: DemoContext) =>
  c.changeOrderStatus === 'approved' && c.lienWaiverStatus === 'approved';

// ─── Reducer (guarded) ───────────────────────────────────────────────────────
export function reducer(ctx: DemoContext, action: DemoAction): DemoContext {
  switch (action.type) {
    case 'EVALUATE':
      if (ctx.state !== 'workspace') return ctx;
      return { ...ctx, state: 'review_blocked' };

    case 'RESOLVE_SOURCE_RECORD': {
      // Corrections happen in the simulated project workspace AFTER evaluation
      // has revealed the exceptions, and before authorization is recorded.
      if (ctx.state !== 'review_blocked') return ctx;
      const next: DemoContext = { ...ctx };
      if (action.record === 'co_027') {
        if (ctx.changeOrderStatus === 'approved') return ctx; // no double-advance
        next.changeOrderStatus = 'approved';
      } else {
        if (ctx.lienWaiverStatus === 'approved') return ctx; // no double-advance
        next.lienWaiverStatus = 'approved';
      }
      // Each relevant source correction produces the next evidence snapshot.
      next.snapshotVersion = (ctx.snapshotVersion + 1) as DemoContext['snapshotVersion'];
      if (bothResolved(next)) {
        next.state = 'gate_ready';
        next.riskLevel = 'low';
        next.aiRequirementSatisfied = true;
      }
      return next;
    }

    case 'OPEN_AUTHORIZATION':
      // Guard: cannot authorize while any applicable condition is blocked or AI is unresolved.
      if (ctx.state !== 'gate_ready' || !canAuthorize(ctx)) return ctx;
      return { ...ctx, state: 'authorization_modal_open' };

    case 'CLOSE_AUTHORIZATION':
      if (ctx.state !== 'authorization_modal_open') return ctx;
      return { ...ctx, state: 'gate_ready' };

    case 'RECORD_AUTHORIZATION':
      // Guard: ONLY the represented funder may authorize. Admin, contractor,
      // partner, and AI actors are rejected — the context is returned unchanged.
      if (ctx.state !== 'authorization_modal_open') return ctx;
      if (action.actor !== 'funder') return ctx;
      return { ...ctx, state: 'authorization_recorded', authorizationRecorded: true };

    case 'RECORD_EXTERNAL_CONFIRMATION':
      // Guard: external confirmation is impossible before authorization is
      // recorded, and it never rewrites the authorization decision.
      if (ctx.state !== 'authorization_recorded') return ctx;
      return { ...ctx, state: 'external_confirmation_recorded', externalConfirmationRecorded: true };

    case 'RESET':
      return makeInitialContext();

    default:
      return ctx;
  }
}

// ─── Selectors (derived, pure) ───────────────────────────────────────────────
export function snapshotId(ctx: DemoContext): string {
  return `${SNAPSHOT_ID_BASE}-V${ctx.snapshotVersion}`;
}

export function snapshotTimestamp(ctx: DemoContext): string {
  return SNAPSHOT_TIMESTAMPS[ctx.snapshotVersion];
}

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

/** All *applicable* (non–not-applicable) conditions pass. */
export function allApplicablePass(ctx: DemoContext): boolean {
  return effectiveConditions(ctx).every(
    (c) => c.status === 'passed' || c.status === 'not_applicable',
  );
}

export function canAuthorize(ctx: DemoContext): boolean {
  return allApplicablePass(ctx) && ctx.aiRequirementSatisfied && !ctx.authorizationRecorded;
}

/**
 * Gross-scope evaluation view (display only — never partial-authorization).
 * `isolated` is the capital still held for review while CO-027 is pending.
 */
export interface FinancialImpactView {
  grossRequested: number;
  affected: number;
  unaffected: number;
  releaseUnit: string;
  isolated: number;
}

export function financialImpact(ctx: DemoContext): FinancialImpactView {
  return {
    grossRequested: impact.grossRequested,
    affected: impact.affectedByChangeOrder,
    unaffected: impact.unaffectedGross,
    releaseUnit: impact.releaseUnit,
    isolated: ctx.changeOrderStatus === 'approved' ? 0 : changeOrder.amount,
  };
}

/** Deterministic AI-assisted pre-review derived from the current evidence. */
export function currentPreReview(ctx: DemoContext): PreReview {
  const observations = [
    ctx.changeOrderStatus === 'approved'
      ? { kind: 'informational' as const, text: PRE_REVIEW_TEXT.coResolved }
      : { kind: 'blocking' as const, text: PRE_REVIEW_TEXT.coBlocking },
    ctx.lienWaiverStatus === 'approved'
      ? { kind: 'informational' as const, text: PRE_REVIEW_TEXT.waiverResolved }
      : { kind: 'blocking' as const, text: PRE_REVIEW_TEXT.waiverBlocking },
    ...PRE_REVIEW_TEXT.informational.map((text) => ({ kind: 'informational' as const, text })),
  ];
  const anyBlocking = observations.some((o) => o.kind === 'blocking');
  return {
    reviewStatus: anyBlocking ? 'Needs resolution' : 'Resolved',
    riskLevel: anyBlocking ? 'critical' : 'low',
    readiness: anyBlocking ? 'Not ready for gate completion' : 'Ready for gate completion',
    observations,
  };
}

// ─── Human-readable audit timeline (deterministic) ───────────────────────────
export function buildAuditEvents(ctx: DemoContext): AuditEvent[] {
  const out: AuditEvent[] = [];
  const evaluated = ctx.state !== 'workspace';
  if (evaluated) {
    out.push(auditEvent('Vektrum (system)', SNAPSHOT_TIMESTAMPS[1], 'Evidence snapshot evaluated', 'Simulated project records evaluated against the demonstrated lender policy (SIM-SNAPSHOT-HPMC-07-V1).', 'DEMO-EVT-EVAL-07'));
    out.push(auditEvent('Vektrum AI pre-review', SNAPSHOT_TIMESTAMPS[1], 'Pre-review completed', 'Lender-policy pre-review identified two policy exceptions (CO-027 pending — $160,000 affected; conditional lien waiver not approved).', 'DEMO-EVT-PREREVIEW-07'));
  }
  if (ctx.changeOrderStatus === 'approved') {
    out.push(auditEvent('Simulated project workspace', SNAPSHOT_TIMESTAMPS[2], 'Source record changed', 'CO-027 approved in the simulated project workspace; next evidence snapshot produced (SIM-SNAPSHOT-HPMC-07-V2).', 'DEMO-EVT-CO-027'));
  }
  if (ctx.lienWaiverStatus === 'approved') {
    out.push(auditEvent('Simulated project workspace', SNAPSHOT_TIMESTAMPS[3], 'Source record changed', 'Conditional lien waiver approved in the simulated project workspace; next evidence snapshot produced (SIM-SNAPSHOT-HPMC-07-V3).', 'DEMO-EVT-LW-07'));
  }
  if (ctx.state === 'gate_ready' || ctx.state === 'authorization_modal_open'
    || ctx.authorizationRecorded) {
    out.push(auditEvent('Vektrum AI pre-review', SNAPSHOT_TIMESTAMPS[3], 'Pre-review updated', 'Pre-review updated to Low risk; no unresolved critical risk.', 'DEMO-EVT-PREREVIEW-2'));
    out.push(auditEvent('Vektrum governance gate', 'July 21, 2026 at 11:00 AM MDT', 'Release gate passed', 'All applicable lender-policy conditions passed (condition 4 not applicable — external rail).', 'DEMO-EVT-GATE-07'));
  }
  if (ctx.authorizationRecorded) {
    out.push(auditEvent('Olivia Chen (Authorized funder)', 'July 21, 2026 at 11:08 AM MDT', 'Authorization recorded', 'Funder recorded lender release authorization. No payment executed by Vektrum.', 'DEMO-AUTH-HPMC-07'));
  }
  if (ctx.externalConfirmationRecorded) {
    out.push(auditEvent('Mountain West Title & Escrow (external, simulated)', 'July 21, 2026 at 11:26 AM MDT', 'External confirmation recorded', 'External partner returned a simulated execution confirmation reference.', 'DEMO-MWTE-88241'));
  }
  return out;
}
