/**
 * Procore × Vektrum prototype — deterministic fictional fixtures.
 *
 * SIMULATED INTEGRATION CONCEPT — fictional demo data only. No external system
 * is connected and no funds are moved. All organizations, people, projects,
 * records, and amounts are fictional. Every identifier is inert (DEMO-/MOCK-/SIM-).
 *
 * The release-unit amounts below feed the REAL, pure reconciliation module
 * (src/lib/engine/release-units.ts) via the demo machine — so the isolation math
 * shown to a presenter is computed, invariant-checked, and test-covered, not
 * hard-coded per screen.
 */
import type {
  ProjectSource, DrawPackage, ProjectSnapshot, FunderUser, EvidenceRecord,
  ChangeOrderRecord, LienWaiverRecord, LenderPolicy, PreReview, GateCondition,
  AuthorizationRecord, ExternalConfirmation, ConceptualMapping, AuditEvent,
  ReleaseUnitFixture,
} from './types';

export const DISCLOSURE =
  'Simulated integration concept — fictional demo data only. No external system is connected and no funds are moved.';

export const FICTION_LABEL =
  'All organizations, people, projects, records, and amounts shown here are fictional.';

export const SIMULATED_DEMO_NOTE = 'This is a simulated demo. No real funds are moved.';
export const EXECUTION_NOTE =
  'Authorization is demonstrated. Payment execution would flow through the selected rail.';

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
  milestone: 'Structural Steel, Concrete, MEP Rough-In & Dry-In',
  reportedCompletionPct: 64,
  executionRail: 'External / partner-controlled',
};

// ─── Release units — the Draw #07 SOV, broken into four governable units ─────
// Retainage is 5% on every unit. Grosses sum to $2,180,000; retainage to
// $109,000; nets to $2,071,000 — matching the draw header exactly.
//   ISOLATED: DEMO-MS-STEEL — $310,000 gross / $294,500 net (CO-027 + waiver).
//   ELIGIBLE: the other three — $1,870,000 gross / $1,776,500 net.
export const releaseUnits: ReleaseUnitFixture[] = [
  {
    id: 'DEMO-MS-STEEL',
    sovLine: 'SOV 03-100',
    label: 'Structural steel connection package',
    grossAmount: 310_000,
    retainageAmount: 15_500,
    isolationReason: 'Open change order CO-027 and an unapproved conditional lien waiver on this unit.',
    failedConditions: [
      'Condition 07 — No open change orders on this milestone',
      'Condition 10 — Approved conditional lien waiver on file where required',
    ],
    evidenceRefs: ['SIM-CO-027', 'SIM-LW-07', 'SIM-SOV-14'],
  },
  {
    id: 'DEMO-MS-CONCRETE',
    sovLine: 'SOV 03-050',
    label: 'Cast-in-place concrete — level 3',
    grossAmount: 720_000,
    retainageAmount: 36_000,
    evidenceRefs: ['SIM-INSP-19', 'SIM-SOV-14'],
  },
  {
    id: 'DEMO-MS-MEP',
    sovLine: 'SOV 15-200',
    label: 'MEP rough-in — level 2',
    grossAmount: 560_000,
    retainageAmount: 28_000,
    evidenceRefs: ['SIM-INSP-19', 'SIM-SOV-14'],
  },
  {
    id: 'DEMO-MS-ENVELOPE',
    sovLine: 'SOV 07-300',
    label: 'Building envelope / dry-in',
    grossAmount: 590_000,
    retainageAmount: 29_500,
    evidenceRefs: ['SIM-PHOTO-07', 'SIM-SOV-14'],
  },
];

/** The unit that is isolated before resolution. */
export const ISOLATED_UNIT_ID = 'DEMO-MS-STEEL';

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

export const UPDATED_SNAPSHOT_TIMESTAMP = 'July 21, 2026 at 11:14 AM MDT';

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
  amount: 294_500,
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

// Deterministic AI pre-review — BEFORE the isolated unit is corrected.
export const preReviewBefore: PreReview = {
  reviewStatus: 'Two exceptions contained to one unit',
  riskLevel: 'critical',
  readiness: 'Eligible units ready; one unit isolated',
  observations: [
    { kind: 'blocking', text: 'Structural steel unit (SOV 03-100): conditional lien waiver is not approved.' },
    { kind: 'blocking', text: 'Structural steel unit (SOV 03-100): CO-027 remains open.' },
    { kind: 'informational', text: 'Exceptions are scoped to a single release unit; three other units are unaffected.' },
    { kind: 'informational', text: 'No eligible unit depends on the isolated unit — nothing downstream is held.' },
    { kind: 'informational', text: 'Concrete, MEP rough-in, and envelope units reconcile to the imported schedule of values.' },
    { kind: 'informational', text: 'Inspection report is current; signed construction contract is present.' },
  ],
};

// Deterministic AI pre-review — AFTER the isolated unit is corrected at source.
export const preReviewAfter: PreReview = {
  reviewStatus: 'Resolved',
  riskLevel: 'low',
  readiness: 'Resolved unit ready for its own authorization',
  observations: [
    { kind: 'informational', text: 'Structural steel unit: conditional lien waiver is approved at source.' },
    { kind: 'informational', text: 'Structural steel unit: CO-027 approved at source; no open change orders remain.' },
    { kind: 'informational', text: 'Resolved unit reconciles to the updated schedule-of-values snapshot.' },
    { kind: 'informational', text: 'Inspection report is current.' },
    { kind: 'informational', text: 'Progress evidence is consistent with the reported completion.' },
    { kind: 'informational', text: 'Signed construction contract is present.' },
  ],
};

export const AI_REQUIREMENT_LABEL = 'Current, documented, and no unresolved critical risk';

// The public-facing Vektrum 10 conditions AS EVALUATED FOR THE ISOLATED UNIT
// (inert display fixture). Conditions 7 and 10 are the two the isolated unit
// fails until corrected at source. All other units evaluate these as passed.
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

// Round 1 — authorization of the ELIGIBLE units only. Excludes the isolated unit.
export const authEligible: AuthorizationRecord = {
  authorizationId: 'DEMO-AUTH-HPMC-07A',
  referenceId: 'DEMO-JTI-HPMC-07A',
  status: 'Issued — simulated',
  railScope: 'External',
  authorizedBy: 'Olivia Chen',
  role: 'Senior Draw Officer',
  authorizedAt: 'July 21, 2026 at 11:02 AM MDT',
  authorizedNetAmount: 1_776_500,
  authorizedGrossAmount: 1_870_000,
  includedUnitIds: ['DEMO-MS-CONCRETE', 'DEMO-MS-MEP', 'DEMO-MS-ENVELOPE'],
  excludedUnitIds: ['DEMO-MS-STEEL'],
  expiration: 'August 20, 2026',
  signatureStatus: 'Simulated / inert',
  executionStatus: 'Awaiting external confirmation',
};

// Round 2 — authorization of the RESOLVED unit only. A distinct record; the
// round-1 authorization above is never modified.
export const authResolved: AuthorizationRecord = {
  authorizationId: 'DEMO-AUTH-HPMC-07B',
  referenceId: 'DEMO-JTI-HPMC-07B',
  status: 'Issued — simulated',
  railScope: 'External',
  authorizedBy: 'Olivia Chen',
  role: 'Senior Draw Officer',
  authorizedAt: 'July 21, 2026 at 11:22 AM MDT',
  authorizedNetAmount: 294_500,
  authorizedGrossAmount: 310_000,
  includedUnitIds: ['DEMO-MS-STEEL'],
  excludedUnitIds: [],
  expiration: 'August 20, 2026',
  signatureStatus: 'Simulated / inert',
  executionStatus: 'Awaiting external confirmation',
};

export const externalConfirmation: ExternalConfirmation = {
  executionStatus: 'Confirmed — simulated',
  method: 'External wire — simulated',
  confirmationReference: 'DEMO-MWTE-88241',
  confirmedBy: 'Mountain West Title & Escrow',
  confirmedAt: 'July 21, 2026 at 11:31 AM MDT',
};

export const conceptualMappings: ConceptualMapping[] = [
  { sourceConcept: 'Procore project', destinationConcept: 'Vektrum governed project context', prototypeStatus: 'conceptual', apiValidated: false, permissionValidated: false, notes: 'Identity + high-level project attributes.' },
  { sourceConcept: 'Funding/owner invoice', destinationConcept: 'Draw-review request', prototypeStatus: 'conceptual', apiValidated: false, permissionValidated: false, notes: 'Triggers a lender draw review.' },
  { sourceConcept: 'Schedule-of-values lines', destinationConcept: 'Release units (governable)', prototypeStatus: 'conceptual', apiValidated: false, permissionValidated: false, notes: 'G702/G703-style line items become isolatable units.' },
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
