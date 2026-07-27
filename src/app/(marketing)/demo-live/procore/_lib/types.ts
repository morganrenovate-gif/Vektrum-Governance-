/**
 * Procore × Vektrum partnership prototype — shared types.
 *
 * SIMULATED INTEGRATION CONCEPT. Fictional demo data only. No external system
 * is connected and no funds are moved. Nothing in this module imports or touches
 * production logic (release gate, authorization tokens, audit hashing, Partner
 * API, Supabase, Stripe, auth). Every identifier is inert and prefixed
 * DEMO-/MOCK-/SIM-.
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
  status: 'pending' | 'approved';
  affectsCurrentMilestone: boolean;
  amount: number;
  description: string;
  source: string;
}

export interface LienWaiverRecord {
  id: string;
  waiverType: string;
  status: 'unapproved' | 'approved';
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

/**
 * Gross-scope evaluation view for the draw (display only — NOT
 * partial-authorization). `affectedByChangeOrder + unaffectedGross === grossRequested`.
 */
export interface FinancialImpactFixture {
  grossRequested: number;
  affectedByChangeOrder: number;
  unaffectedGross: number;
  releaseUnit: string;
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
  /** Base state before any source corrections. */
  baseStatus: Extract<StatusKind, 'passed' | 'blocked' | 'not_applicable'>;
  /** True for the two conditions the source corrections resolve (7 and 10). */
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
  authorizedGrossAmount: number;
  expiration: string;
  signatureStatus: string; // 'Simulated / inert'
  executionStatus: string; // 'Awaiting external confirmation'
}

export interface ExternalConfirmation {
  executionStatus: string; // 'Confirmed — simulated'
  method: string; // 'External wire — simulated'
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
export type DemoState =
  | 'workspace'
  | 'review_blocked'
  | 'gate_ready'
  | 'authorization_modal_open'
  | 'authorization_recorded'
  | 'external_confirmation_recorded';

/** Actors represented in the walkthrough. Only 'funder' may authorize. */
export type DemoActor = 'funder' | 'admin' | 'contractor' | 'partner' | 'ai';

export type SourceRecordKey = 'co_027' | 'lien_waiver';

export type DemoAction =
  | { type: 'EVALUATE' }
  | { type: 'RESOLVE_SOURCE_RECORD'; record: SourceRecordKey }
  | { type: 'OPEN_AUTHORIZATION' }
  | { type: 'CLOSE_AUTHORIZATION' }
  | { type: 'RECORD_AUTHORIZATION'; actor: DemoActor }
  | { type: 'RECORD_EXTERNAL_CONFIRMATION' }
  | { type: 'RESET' };

export interface DemoContext {
  state: DemoState;
  changeOrderStatus: ChangeOrderRecord['status'];
  lienWaiverStatus: LienWaiverRecord['status'];
  riskLevel: RiskLevel;
  aiRequirementSatisfied: boolean;
  authorizationRecorded: boolean;
  externalConfirmationRecorded: boolean;
  /** Deterministic evidence-snapshot version: V1 initial, V2/V3 per correction. */
  snapshotVersion: 1 | 2 | 3;
}
