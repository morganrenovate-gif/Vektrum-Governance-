/**
 * Procore × Vektrum partnership prototype — shared types.
 *
 * SIMULATED INTEGRATION CONCEPT. Fictional demo data only. No external system
 * is connected and no funds are moved. The demo consumes ONE piece of real shared
 * domain logic — src/lib/engine/release-units.ts (pure, no I/O) — to compute the
 * draw reconciliation and authorization scope, so the numbers shown are produced by
 * the same audited code the tests prove. It imports NO gate/token/audit/Supabase/
 * Stripe/auth runtime. Every identifier is inert and prefixed DEMO-/MOCK-/SIM-.
 */

// ─── Status vocabulary (icon + label + a11y description live in the UI) ──────
export type StatusKind =
  | 'passed'
  | 'blocked'
  | 'warning'
  | 'not_applicable'
  | 'pending'
  | 'issued'
  | 'confirmed'
  | 'simulated';

export type RiskLevel = 'critical' | 'low';

// ─── Project + draw fixtures ─────────────────────────────────────────────────
export interface ProjectSource {
  name: string;
  projectNumber: string;
  location: string;
  status: string;
  type: string;
  generalContractor: string;
  owner: string;
  lender: string;
  disbursementPartner: string;
  totalProjectValue: number;
  constructionFacility: number;
}

export interface DrawPackage {
  drawNumber: string;
  billingPeriod: string;
  grossRequested: number;
  retainage: number;
  netRepresented: number;
  milestone: string;
  reportedCompletionPct: number;
  executionRail: string;
}

export interface ProjectSnapshot {
  snapshotTimestamp: string;
  sourceMode: string;
  destination: string;
  includedRecordCategories: string[];
  sourceLabel: string;
}

export interface FunderUser {
  name: string;
  title: string;
  organization: string;
  role: string;
}

export interface EvidenceRecord {
  id: string;
  category: string;
  label: string;
  source: string;
  note?: string;
}

export interface ChangeOrderRecord {
  id: string;
  status: 'open' | 'approved';
  affectsCurrentMilestone: boolean;
  amount: number;
  description: string;
  source: string;
}

export interface LienWaiverRecord {
  id: string;
  waiverType: string;
  status: 'draft' | 'approved';
  amount: number;
  source: string;
}

export interface LenderPolicy {
  policyId: string;
  name: string;
  owner: string;
  appliesTo: string;
  evaluationMode: string;
  executionRail: string;
  status: string;
  lastRevision: string;
}

// ─── Release units (the SOV broken into independently-governable units) ──────
/**
 * One Schedule-of-Values release unit as SHOWN in the demo. The financial
 * amounts (grossAmount/retainageAmount) feed the real reconcileDraw()/
 * deriveAuthorizationScope() in src/lib/engine/release-units.ts. `unitStatus` is
 * derived by the machine from context, never hard-coded per screen.
 */
export interface ReleaseUnitFixture {
  id: string;              // inert DEMO- id (maps to a milestone id in production)
  sovLine: string;         // G703-style line number
  label: string;
  grossAmount: number;
  retainageAmount: number;
  /** Machine reason this unit is isolated when it is (failed condition/dispute). */
  isolationReason?: string;
  /** Genuine downstream dependency (unit id) blocked while this one is isolated. */
  dependentUnitId?: string;
  /** Human list of the conditions that fail while isolated. */
  failedConditions?: string[];
  evidenceRefs?: string[];
}

// ─── AI-assisted pre-review (deterministic; informs, never authorizes) ───────
export interface PreReviewObservation {
  kind: 'blocking' | 'informational';
  text: string;
}
export interface PreReview {
  reviewStatus: string;
  riskLevel: RiskLevel;
  readiness: string;
  observations: PreReviewObservation[];
}

// ─── 10-condition gate (inert display fixture — not the production gate) ──────
export interface GateCondition {
  index: number; // 1..10
  label: string;
  baseStatus: Extract<StatusKind, 'passed' | 'blocked' | 'not_applicable'>;
  /** True for the conditions the isolated unit fails (7 change order, 10 waiver). */
  resolvedByUpdate?: boolean;
  notApplicableReason?: string;
}

export interface AuthorizationRecord {
  authorizationId: string;
  referenceId: string;
  status: string; // 'Issued — simulated'
  railScope: string;
  authorizedBy: string;
  role: string;
  authorizedAt: string;
  /** Net amount this authorization covers. */
  authorizedNetAmount: number;
  authorizedGrossAmount: number;
  /** Unit ids this authorization is bound to (scope). */
  includedUnitIds: string[];
  /** Unit ids explicitly excluded (isolated) at authorization time. */
  excludedUnitIds: string[];
  expiration: string;
  signatureStatus: string;
  executionStatus: string;
}

export interface ExternalConfirmation {
  executionStatus: string;
  method: string;
  confirmationReference: string;
  confirmedBy: string;
  confirmedAt: string;
}

export interface ConceptualMapping {
  sourceConcept: string;
  destinationConcept: string;
  prototypeStatus: 'conceptual';
  apiValidated: false;
  permissionValidated: false;
  notes: string;
}

export interface AuditEvent {
  actor: string;
  timestamp: string;
  eventType: string;
  explanation: string;
  source: string;
  reference: string;
}

// ─── State machine ───────────────────────────────────────────────────────────
// Isolation-first flow with TWO authorization rounds:
//   import → pre-review isolates one unit → authorize the ELIGIBLE units now
//   → resolve the isolated unit at source → authorize the RESOLVED unit
//   → external confirmation. The isolated amount is never inside the first scope.
export type DemoState =
  | 'snapshot_available'
  | 'snapshot_imported'
  | 'review_isolated'          // pre-review done: one unit isolated, others eligible
  | 'authorize_eligible_open'  // funder authorization dialog (round 1)
  | 'eligible_authorized'      // eligible units authorized; isolated unit still contained
  | 'source_updates_staged'    // both source corrections staged for the isolated unit
  | 'isolated_resolved'        // updated snapshot received; isolated unit now eligible
  | 'authorize_resolved_open'  // funder authorization dialog (round 2)
  | 'resolved_authorized'      // resolved unit authorized (separate record)
  | 'external_confirmation_recorded';

export type AuthRound = 'eligible' | 'resolved';

export type DemoAction =
  | { type: 'IMPORT_SNAPSHOT' }
  | { type: 'RUN_PRE_REVIEW' }
  | { type: 'OPEN_AUTHORIZATION'; round: AuthRound }
  | { type: 'CLOSE_AUTHORIZATION' }
  | { type: 'RECORD_AUTHORIZATION' }
  | { type: 'STAGE_SOURCE_UPDATE'; update: 'co_approved' | 'waiver_approved' }
  | { type: 'RECEIVE_UPDATED_SNAPSHOT' }
  | { type: 'RECORD_EXTERNAL_CONFIRMATION' }
  | { type: 'RESET' };

export interface DemoContext {
  state: DemoState;
  /** simulated source corrections staged for the isolated unit */
  staged: { co_approved: boolean; waiver_approved: boolean };
  /** derived live records that flip once the updated snapshot is received */
  changeOrderStatus: ChangeOrderRecord['status'];
  lienWaiverStatus: LienWaiverRecord['status'];
  riskLevel: RiskLevel;
  /** the isolated unit's exceptions are resolved at source */
  isolatedResolved: boolean;
  /** round 1 (eligible units) authorization recorded */
  eligibleAuthorized: boolean;
  /** round 2 (resolved unit) authorization recorded */
  resolvedAuthorized: boolean;
  externalConfirmationRecorded: boolean;
  /** which round the open authorization dialog is for (null when closed) */
  authRound: AuthRound | null;
  snapshotTimestamp: string;
}
