/**
 * Procore × Vektrum prototype — deterministic fictional fixtures.
 *
 * SIMULATED INTEGRATION CONCEPT — fictional demo data only. No external system
 * is connected and no funds are moved. All organizations, people, projects,
 * records, and amounts are fictional. Every identifier is inert (DEMO-/MOCK-/SIM-).
 */
import type {
  ProjectSource, DrawPackage, ProjectSnapshot, FunderUser, EvidenceRecord,
  ChangeOrderRecord, LienWaiverRecord, LenderPolicy, PreReview, GateCondition,
  AuthorizationRecord, ExternalConfirmation, ConceptualMapping, AuditEvent,
} from './types';

export const DISCLOSURE =
  'Simulated integration concept — fictional demo data only. No external system is connected and no funds are moved.';

export const FICTION_LABEL =
  'All organizations, people, projects, records, and amounts shown here are fictional.';

export const project: ProjectSource = {
  name: 'Harbor Point Medical Center',
  projectNumber: 'HPMC-2026-014',
  location: 'Salt Lake City, Utah',
  status: 'Active',
  type: 'Healthcare',
  generalContractor: 'Summit Ridge Builders',
  owner: 'Harbor Point Development',
  lender: 'Wasatch Private Credit',
  disbursementPartner: 'Mountain West Title & Escrow',
  totalProjectValue: 42_800_000,
  constructionFacility: 31_500_000,
};

export const draw: DrawPackage = {
  drawNumber: 'Draw Request #07',
  billingPeriod: 'June 1 – June 30, 2026',
  grossRequested: 2_180_000,
  retainage: 109_000,
  netRepresented: 2_071_000,
  milestone: 'Structural Steel & Building Dry-In',
  reportedCompletionPct: 64,
  executionRail: 'External / partner-controlled',
};

export const snapshot: ProjectSnapshot = {
  snapshotTimestamp: 'July 21, 2026 at 10:42 AM MDT',
  sourceMode: 'Read-only project snapshot',
  destination: 'Vektrum lender-governance workspace',
  includedRecordCategories: [
    'Funding/owner invoice', 'Schedule of values', 'Contractor invoice support',
    'Commitment context', 'Direct-cost summary', 'Inspection report',
    'Progress photographs', 'Signed construction contract',
    'Conditional lien waiver', 'Change-order register', 'Budget snapshot',
    'Prior draw history',
  ],
  sourceLabel: 'Procore-originated record — simulated',
};

export const UPDATED_SNAPSHOT_TIMESTAMP = 'July 21, 2026 at 10:58 AM MDT';

export const funder: FunderUser = {
  name: 'Olivia Chen',
  title: 'Senior Draw Officer',
  organization: 'Wasatch Private Credit',
  role: 'Authorized funder',
};

export const evidence: EvidenceRecord[] = [
  { id: 'SIM-INV-07', category: 'Funding/owner invoice', label: 'Owner draw invoice — period 07', source: 'Simulated Procore source' },
  { id: 'SIM-SOV-14', category: 'Schedule of values', label: 'Schedule of values (G703-style lines)', source: 'Simulated Procore source' },
  { id: 'SIM-SUP-07', category: 'Contractor invoice support', label: 'Subcontractor pay-app support package', source: 'Simulated Procore source' },
  { id: 'SIM-CMT-03', category: 'Commitment context', label: 'Prime contract & commitment context', source: 'Simulated Procore source' },
  { id: 'SIM-DCS-07', category: 'Direct-cost summary', label: 'Direct-cost summary — period 07', source: 'Simulated Procore source' },
  { id: 'SIM-INSP-19', category: 'Inspection report', label: 'Structural inspection report (current)', source: 'Simulated Procore source' },
  { id: 'SIM-PHOTO-07', category: 'Progress photographs', label: 'Dry-in progress photographs (12)', source: 'Simulated Procore source' },
  { id: 'SIM-CONTRACT-01', category: 'Signed construction contract', label: 'Executed prime construction contract', source: 'Simulated Procore source' },
  { id: 'SIM-BUD-07', category: 'Budget snapshot', label: 'Budget snapshot — period 07', source: 'Simulated Procore source' },
  { id: 'SIM-PRIOR-06', category: 'Prior draw history', label: 'Prior draws #01–#06 history', source: 'Simulated Procore source' },
];

export const changeOrder: ChangeOrderRecord = {
  id: 'CO-027',
  status: 'open',
  affectsCurrentMilestone: true,
  amount: 148_500,
  description: 'Structural steel connection detail revision',
  source: 'Simulated Procore-originated record',
};

export const lienWaiver: LienWaiverRecord = {
  id: 'SIM-LW-07',
  waiverType: 'Conditional progress lien waiver',
  status: 'draft',
  amount: 2_071_000,
  source: 'Simulated Procore-originated record',
};

export const lenderPolicy: LenderPolicy = {
  policyId: 'DEMO-WPC-HC-04',
  name: 'Wasatch Private Credit — Healthcare Construction Draw Policy',
  owner: 'Wasatch Private Credit',
  appliesTo: 'Healthcare construction facilities',
  evaluationMode: 'Funder-triggered, system-enforced',
  executionRail: 'External / partner-controlled',
  status: 'Simulated policy',
  lastRevision: 'May 15, 2026',
};

// Deterministic AI pre-review — BEFORE source updates.
export const preReviewBefore: PreReview = {
  reviewStatus: 'Needs resolution',
  riskLevel: 'critical',
  readiness: 'Not ready for gate completion',
  observations: [
    { kind: 'blocking', text: 'Conditional lien waiver is not approved.' },
    { kind: 'blocking', text: 'CO-027 remains open for the current milestone.' },
    { kind: 'informational', text: 'Requested amount reconciles to the imported schedule-of-values snapshot.' },
    { kind: 'informational', text: 'Inspection report is current.' },
    { kind: 'informational', text: 'Progress evidence is consistent with the reported completion.' },
    { kind: 'informational', text: 'Signed construction contract is present.' },
  ],
};

// Deterministic AI pre-review — AFTER the updated snapshot is received.
export const preReviewAfter: PreReview = {
  reviewStatus: 'Resolved',
  riskLevel: 'low',
  readiness: 'Ready for gate completion',
  observations: [
    { kind: 'informational', text: 'Conditional lien waiver is approved at source.' },
    { kind: 'informational', text: 'CO-027 approved at source; no open change orders on the current milestone.' },
    { kind: 'informational', text: 'Requested amount reconciles to the updated schedule-of-values snapshot.' },
    { kind: 'informational', text: 'Inspection report is current.' },
    { kind: 'informational', text: 'Progress evidence is consistent with the reported completion.' },
    { kind: 'informational', text: 'Signed construction contract is present.' },
  ],
};

export const AI_REQUIREMENT_LABEL = 'Current, documented, and no unresolved critical risk';

// The exact public-facing Vektrum 10 conditions (inert display fixture).
export const gateConditions: GateCondition[] = [
  { index: 1, label: 'Milestone status approved', baseStatus: 'passed' },
  { index: 2, label: 'Protection status ready for release', baseStatus: 'passed' },
  { index: 3, label: 'Sufficient funding or external funding confirmation', baseStatus: 'passed' },
  { index: 4, label: 'Payout readiness verified for selected rail', baseStatus: 'not_applicable',
    notApplicableReason: 'This draw uses an external partner-controlled execution rail. Payment readiness within a Vektrum-controlled rail is not evaluated.' },
  { index: 5, label: 'Contractor onboarding complete where required', baseStatus: 'passed' },
  { index: 6, label: 'No existing active release for this milestone', baseStatus: 'passed' },
  { index: 7, label: 'No open change orders on this milestone', baseStatus: 'blocked', resolvedByUpdate: true },
  { index: 8, label: 'Signed contract on file', baseStatus: 'passed' },
  { index: 9, label: 'Sequential-release ordering and prerequisites satisfied where required', baseStatus: 'passed' },
  { index: 10, label: 'Approved conditional lien waiver on file where required', baseStatus: 'blocked', resolvedByUpdate: true },
];

export const authorizationRecord: AuthorizationRecord = {
  authorizationId: 'DEMO-AUTH-HPMC-07',
  referenceId: 'DEMO-JTI-HPMC-07',
  status: 'Issued — simulated',
  railScope: 'External',
  authorizedBy: 'Olivia Chen',
  role: 'Senior Draw Officer',
  authorizedAt: 'July 21, 2026 at 11:08 AM MDT',
  authorizedGrossAmount: 2_180_000,
  expiration: 'August 20, 2026',
  signatureStatus: 'Simulated / inert',
  executionStatus: 'Awaiting external confirmation',
};

export const externalConfirmation: ExternalConfirmation = {
  executionStatus: 'Confirmed — simulated',
  method: 'External wire — simulated',
  confirmationReference: 'DEMO-MWTE-88241',
  confirmedBy: 'Mountain West Title & Escrow',
  confirmedAt: 'July 21, 2026 at 11:26 AM MDT',
};

export const conceptualMappings: ConceptualMapping[] = [
  { sourceConcept: 'Procore project', destinationConcept: 'Vektrum governed project context', prototypeStatus: 'conceptual', apiValidated: false, permissionValidated: false, notes: 'Identity + high-level project attributes.' },
  { sourceConcept: 'Funding/owner invoice', destinationConcept: 'Draw-review request', prototypeStatus: 'conceptual', apiValidated: false, permissionValidated: false, notes: 'Triggers a lender draw review.' },
  { sourceConcept: 'Schedule-of-values lines', destinationConcept: 'Draw cost breakdown', prototypeStatus: 'conceptual', apiValidated: false, permissionValidated: false, notes: 'G702/G703-style line items.' },
  { sourceConcept: 'Commitments', destinationConcept: 'Contract and counterparty context', prototypeStatus: 'conceptual', apiValidated: false, permissionValidated: false, notes: 'Prime contract & vendor context.' },
  { sourceConcept: 'Change orders / change events', destinationConcept: 'Potential policy exceptions', prototypeStatus: 'conceptual', apiValidated: false, permissionValidated: false, notes: 'Open COs may be lender-policy exceptions.' },
  { sourceConcept: 'Project documents', destinationConcept: 'Draw evidence references', prototypeStatus: 'conceptual', apiValidated: false, permissionValidated: false, notes: 'Reference only; documents remain in Procore.' },
  { sourceConcept: 'Invoice attachments', destinationConcept: 'Supporting-document references', prototypeStatus: 'conceptual', apiValidated: false, permissionValidated: false, notes: 'Reference only.' },
  { sourceConcept: 'Payment records', destinationConcept: 'Reconciliation reference only', prototypeStatus: 'conceptual', apiValidated: false, permissionValidated: false, notes: 'Read for reconciliation context; never executed by Vektrum.' },
];

export const MAPPING_CAVEAT =
  'Conceptual for prototype — API feasibility and permissions not yet validated.';

// Base audit events present from import; later events are appended by transitions.
export function auditEvent(
  actor: string, timestamp: string, eventType: string, explanation: string,
  reference: string,
): AuditEvent {
  return { actor, timestamp, eventType, explanation, source: 'Simulated', reference };
}
