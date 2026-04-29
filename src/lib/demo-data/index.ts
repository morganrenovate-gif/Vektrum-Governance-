// ── Demo Data ────────────────────────────────────────────────────────────────
// Hardcoded mock data for all 4 demo deals. No real API calls.

/**
 * Browser CustomEvent name dispatched by DemoResetButton after a successful
 * POST /api/demo/reset call. All stateful demo components listen for this
 * event to restore their initial state without requiring a full page reload.
 *
 * Usage (dispatch):
 *   window.dispatchEvent(new CustomEvent(DEMO_RESET_EVENT))
 *
 * Usage (listen):
 *   useEffect(() => {
 *     const onReset = () => { setFoo(initial); ... }
 *     window.addEventListener(DEMO_RESET_EVENT, onReset)
 *     return () => window.removeEventListener(DEMO_RESET_EVENT, onReset)
 *   }, [])
 */
export const DEMO_RESET_EVENT = 'vektrum:demo-reset'

export type DemoMilestoneStatus =
  | 'not_started'
  | 'in_progress'
  | 'ready_for_review'
  | 'approved'
  | 'released'
  | 'disputed'

export interface DemoMilestone {
  id: string
  name: string
  amount: number
  status: DemoMilestoneStatus
  releasedAt?: string
  aiScore?: number
  aiRisk?: string
  aiRecommendation?: string
  documents: string[]
}

export interface DemoDeal {
  title: string
  total: number
  funded: number
  released: number
  status: string
  startedAgo: string
  contractor: string
  funder: string
  milestones: DemoMilestone[]
}

export interface DisputeMilestone {
  id: string
  name: string
  amount: number
  status: DemoMilestoneStatus
  releasedAt?: string
  documents: string[]
  disputeReason?: string
  disputedLineItem?: string
  aiScore?: number
  aiRisk?: string
  findings?: string[]
  fundsReleased?: number
  fundsHeld?: number
}

// ── Riverside Mixed-Use Development ─────────────────────────────────────────

export const riverside: DemoDeal = {
  title: 'Riverside Mixed-Use Development',
  total: 2_400_000,
  funded: 2_400_000,
  released: 480_000,
  status: 'active',
  startedAgo: '90 days ago',
  contractor: 'Marcus Webb',
  funder: 'Sarah Chen',
  milestones: [
    {
      id: 'ms-rv-1',
      name: 'Foundation & Site Prep',
      amount: 480_000,
      status: 'released',
      releasedAt: 'February 21, 2026',
      documents: [
        'Inspection Report — February 14, 2026',
        'Lien Waiver — February 18, 2026',
        'Draw Request #1 — $480,000',
      ],
    },
    {
      id: 'ms-rv-2',
      name: 'Framing & Structural Steel',
      amount: 720_000,
      status: 'approved',
      aiScore: 87,
      aiRisk: 'low',
      aiRecommendation: 'Approve',
      documents: [
        'Inspection Report — March 5, 2026',
        'Lien Waiver — March 8, 2026',
        'Draw Request #2 — $720,000',
      ],
    },
    {
      id: 'ms-rv-3',
      name: 'MEP Rough-In',
      amount: 680_000,
      status: 'ready_for_review',
      documents: [
        'Inspection Report — April 15, 2026',
        'Lien Waiver — April 17, 2026',
      ],
    },
    {
      id: 'ms-rv-4',
      name: 'Finishes & Certificate of Occupancy',
      amount: 520_000,
      status: 'not_started',
      documents: [],
    },
  ],
}

// ── Harbor Logistics Center ─────────────────────────────────────────────────

export const harbor: DemoDeal = {
  title: 'Harbor Logistics Center',
  total: 9_100_000,
  funded: 9_100_000,
  released: 2_160_000, // ms-hb-1 ($320k) + ms-hb-2 ($1,840k); ms-hb-3 is approved/pending release
  status: 'active',
  startedAgo: '180 days ago',
  contractor: 'Marcus Webb',
  funder: 'Sarah Chen',
  milestones: [
    {
      id: 'ms-hb-1',
      name: 'Site Preparation & Grading',
      amount: 320_000,
      status: 'released',
      releasedAt: '14 days ago',
      documents: [
        'Inspection Report — Grading Complete',
        'Lien Waiver — Webb Construction',
        'Draw Request #1 — $320,000',
      ],
    },
    {
      id: 'ms-hb-2',
      name: 'Concrete Sub-grade & Foundations',
      amount: 1_840_000,
      status: 'released',
      releasedAt: '7 days ago',
      documents: [
        'Inspection Report — Foundations',
        'Lien Waiver — Webb Construction',
        'Draw Request #2 — $1,840,000',
      ],
    },
    {
      id: 'ms-hb-3',
      name: 'Structural Steel Erection',
      amount: 2_180_000,
      // Starting state: approved and awaiting funder release — this is the
      // milestone the demo flow releases. Must NOT be 'released' on load.
      status: 'approved',
      aiScore: 91,
      aiRisk: 'low',
      aiRecommendation: 'Approve',
      documents: [
        'Inspection Report — Steel Erection',
        'Lien Waiver — Webb Construction',
        'Draw Request #3 — $2,180,000',
      ],
    },
    {
      id: 'ms-hb-4',
      name: 'Building Envelope & Roofing',
      amount: 2_640_000,
      status: 'in_progress',
      documents: [],
    },
    {
      id: 'ms-hb-5',
      name: 'MEP Systems & Commissioning',
      amount: 2_120_000,
      status: 'in_progress',
      documents: [],
    },
  ],
}

// ── Westside Medical Office Campus ──────────────────────────────────────────

export const westside: DemoDeal = {
  title: 'Westside Medical Office Campus',
  total: 4_750_000,
  funded: 4_750_000,
  released: 950_000,
  status: 'active',
  startedAgo: '30 days ago',
  contractor: 'Diane Reyes',
  funder: 'Sarah Chen',
  milestones: [
    {
      id: 'ms-ws-1',
      name: 'Site Work & Utilities',
      amount: 475_000,
      status: 'released',
      releasedAt: '15 days ago',
      documents: [
        'Inspection Report — Site Work',
        'Lien Waiver — Reyes Development',
        'Draw Request #1 — $475,000',
      ],
    },
    {
      id: 'ms-ws-2',
      name: 'Structural Frame & Enclosure',
      amount: 1_425_000,
      status: 'in_progress',
      documents: [],
    },
    {
      id: 'ms-ws-3',
      name: 'Interior Build-Out & MEP',
      amount: 1_900_000,
      status: 'not_started',
      documents: [],
    },
    {
      id: 'ms-ws-4',
      name: 'FF&E, Technology & CO',
      amount: 950_000,
      status: 'not_started',
      documents: [],
    },
  ],
}

// ── Harbor Dispute Milestones ───────────────────────────────────────────────

export const harborDisputeMilestones: DisputeMilestone[] = [
  {
    id: 'ms-hbd-1',
    name: 'Site Preparation & Grading',
    amount: 320_000,
    status: 'released',
    releasedAt: '60 days ago',
    documents: ['Inspection Report', 'Lien Waiver', 'Draw Request #1'],
  },
  {
    id: 'ms-hbd-2',
    name: 'Concrete Sub-grade & Foundations',
    amount: 1_840_000,
    status: 'released',
    releasedAt: '45 days ago',
    documents: ['Inspection Report', 'Lien Waiver', 'Draw Request #2'],
  },
  {
    id: 'ms-hbd-3',
    name: 'Structural Steel Erection',
    amount: 2_180_000,
    status: 'released',
    releasedAt: '30 days ago',
    documents: ['Inspection Report', 'Lien Waiver', 'Draw Request #3'],
  },
  {
    id: 'ms-hbd-4',
    name: 'Building Envelope & Roofing',
    amount: 2_640_000,
    status: 'released',
    releasedAt: '14 days ago',
    documents: ['Inspection Report', 'Lien Waiver', 'Draw Request #4'],
  },
  {
    id: 'ms-hbd-5',
    name: 'HVAC Equipment Procurement',
    amount: 487_000,
    status: 'disputed',
    disputedLineItem: 'HVAC equipment procurement — $487,000',
    disputeReason:
      'AI draw review flagged invoice mismatch: submitted amount ($847K) exceeds approved scope ($360K) by $487,000. Supporting documentation does not reconcile with change order CO-004.',
    aiScore: 34,
    aiRisk: 'high',
    findings: [
      '⚠ Invoice amount ($847K) exceeds approved scope ($360K) by $487,000',
      '⚠ Change order CO-004 not signed by funder',
      '✓ Lien waiver on file',
      '✓ General inspection report attached',
    ],
    documents: ['Invoice — HVAC Procurement', 'Change Order CO-004 (unsigned)'],
  },
  {
    id: 'ms-hbd-6',
    name: 'MEP Systems & Commissioning',
    amount: 2_120_000,
    status: 'released',
    releasedAt: 'Partial — 5 days ago',
    fundsReleased: 1_633_000,
    fundsHeld: 487_000,
    documents: ['Inspection Report — MEP Partial', 'Draw Request #6 — Partial'],
  },
]

// ── Canonical dashboard helpers ──────────────────────────────────────────────
//
// Single source of truth for derived values that dashboard pages need to show:
// total released, percent released, and milestone-released counts. Reading
// these from helpers prevents the stale-duplicate-constant problem where
// dashboard pages drifted from the canonical deal data.

/**
 * Returns the canonical released total for a deal at demo-start.
 * This is the value every dashboard summary tile should display before any
 * in-session releases happen.
 */
export function getDealReleasedAtStart(deal: DemoDeal): number {
  return deal.released
}

/**
 * Milestone summary for dashboard tiles and progress bars. Computed from the
 * canonical deal data — never hardcoded.
 *
 * - `released`  — count of milestones with status === 'released' at demo-start
 * - `total`     — total milestone count
 * - `pct`       — Math.round(deal.released / deal.total * 100), or 0 if total is 0
 */
export function getMilestoneSummary(deal: DemoDeal): {
  released: number
  total:    number
  pct:      number
} {
  const released = deal.milestones.filter((m) => m.status === 'released').length
  const total    = deal.milestones.length
  const pct      = deal.total > 0 ? Math.round((deal.released / deal.total) * 100) : 0
  return { released, total, pct }
}

// ── Fresh-deal factories (defense-in-depth) ─────────────────────────────────
//
// Demo client pages historically read the canonical exports (`harbor`,
// `riverside`, etc.) by reference. Nothing in code mutates those objects
// today, but if a future change ever did — for example, splicing a milestone
// or assigning `ms.status = 'released'` directly — the mutation would persist
// for every subsequent demo visitor in the same browser session, since the
// canonical object lives at module scope.
//
// These factories return a structured deep clone so each demo entry has its
// own isolated copy. Use them at the top of every client demo deal page:
//
//   const deal = useMemo(() => getFreshHarborDeal(), [])
//
// or for one-shot reads:
//
//   const deal = getFreshHarborDeal()

function clone<T>(value: T): T {
  // structuredClone is available in Node 17+ and all modern browsers.
  // The fallback path is only exercised in unusual runtimes (e.g. very
  // old Edge functions) — JSON round-trip is sufficient for our plain
  // demo data (no Dates, Maps, BigInts, or functions in the payload).
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

/** Returns a deep clone of the canonical Harbor deal. */
export function getFreshHarborDeal(): DemoDeal {
  return clone(harbor)
}

/** Returns a deep clone of the canonical Riverside deal. */
export function getFreshRiversideDeal(): DemoDeal {
  return clone(riverside)
}

/** Returns a deep clone of the canonical Westside deal. */
export function getFreshWestsideDeal(): DemoDeal {
  return clone(westside)
}

/** Returns a deep clone of the canonical Harbor-dispute milestone list. */
export function getFreshHarborDisputeMilestones(): DisputeMilestone[] {
  return clone(harborDisputeMilestones)
}

// ── Demo Schedule of Values (Harbor) ────────────────────────────────────────

export type DemoSovStatus = 'pending' | 'approved' | 'complete'

export interface DemoSovLineItem {
  id:           string
  description:  string
  total_amount: number
  drawn_amount: number
  status:       DemoSovStatus
  /** milestone_id the SOV item is linked to; null = unlinked in this demo */
  milestone_id: string | null
}

export const harborSovLineItems: DemoSovLineItem[] = [
  {
    id: 'sov-hb-1',
    description:  'Site Preparation & Grading',
    total_amount: 320_000,
    drawn_amount: 320_000,
    status:       'complete',
    milestone_id: 'ms-hb-1',
  },
  {
    id: 'sov-hb-2',
    description:  'Concrete Sub-grade & Foundations',
    total_amount: 1_840_000,
    drawn_amount: 1_840_000,
    status:       'complete',
    milestone_id: 'ms-hb-2',
  },
  {
    id: 'sov-hb-3',
    description:  'Structural Steel Erection',
    total_amount: 2_180_000,
    drawn_amount: 0,
    status:       'approved',
    milestone_id: 'ms-hb-3',  // linked
  },
  {
    id: 'sov-hb-4',
    description:  'Building Envelope & Roofing',
    total_amount: 2_640_000,
    drawn_amount: 0,
    status:       'pending',
    milestone_id: null,        // unlinked — demo shows advisory
  },
  {
    id: 'sov-hb-5',
    description:  'MEP Systems & Commissioning',
    total_amount: 2_120_000,
    drawn_amount: 0,
    status:       'pending',
    milestone_id: 'ms-hb-5',
  },
]

// ── Perplexity Draw Control Brief (Harbor ms-hb-3) ──────────────────────────

export interface DemoDrawBrief {
  generated_by:   string
  generated_at:   string
  milestone_id:   string
  milestone_name: string
  amount:         number
  ai_score:       number
  risk_level:     'low' | 'medium' | 'high'
  summary:        string
  findings:       string[]
  recommendation: string
}

export const harborDrawBrief: DemoDrawBrief = {
  generated_by:   'Perplexity Computer',
  generated_at:   '3 days ago',
  milestone_id:   'ms-hb-3',
  milestone_name: 'Structural Steel Erection',
  amount:         2_180_000,
  ai_score:       91,
  risk_level:     'low',
  summary:
    'Draw #3 for Structural Steel Erection has been independently reviewed. Steel ' +
    'erection is 100% complete per inspection. All supporting documents are in order ' +
    'and all 10 release-gate conditions are satisfied.',
  findings: [
    '✓ Inspection report confirms structural steel erection complete',
    '✓ Conditional lien waiver on file — Webb Construction',
    '✓ No open change orders on this milestone',
    '✓ Sequential prerequisites satisfied — milestones 1 & 2 released',
    '✓ Signed contract on file — Harbor_Logistics_Agreement.pdf',
    '✓ SOV line item linked — $2,180,000 allocated',
  ],
  recommendation:
    'All 10 release conditions verified. Funder authorization required to proceed.',
}

/** Returns a deep clone of the Harbor SOV line items. */
export function getFreshHarborSovItems(): DemoSovLineItem[] {
  return clone(harborSovLineItems)
}

// ── Contract (Harbor) ────────────────────────────────────────────────────────

export interface DemoContract {
  id:                   string
  document_name:        string
  status:               'signed' | 'pending_signatures' | 'funder_signed'
  contractor_signed_at: string | null
  funder_signed_at:     string | null
  docusign_envelope_id: string | null
  contract_value:       number
}

export const harborContract: DemoContract = {
  id:                   'contract-harbor-001',
  document_name:        'Harbor_Logistics_Agreement.pdf',
  status:               'signed',
  contractor_signed_at: 'October 25, 2025',
  funder_signed_at:     'October 25, 2025',
  docusign_envelope_id: 'ds-env-a4b2c8d1-harbor',
  contract_value:       9_100_000,
}

// ── Evidence Documents (Harbor Draw #3) ─────────────────────────────────────

export interface DemoEvidenceDoc {
  id:           string
  name:         string
  type:         'inspection_report' | 'lien_waiver' | 'draw_request' | 'photo'
  uploaded_at:  string
  milestone_id: string
}

export const harborDraw3Evidence: DemoEvidenceDoc[] = [
  {
    id:           'ev-hb3-1',
    name:         'Inspection Report — Steel Erection Complete',
    type:         'inspection_report',
    uploaded_at:  '5 days ago',
    milestone_id: 'ms-hb-3',
  },
  {
    id:           'ev-hb3-2',
    name:         'Conditional Lien Waiver — Webb Construction',
    type:         'lien_waiver',
    uploaded_at:  '5 days ago',
    milestone_id: 'ms-hb-3',
  },
  {
    id:           'ev-hb3-3',
    name:         'Draw Request #3 — $2,180,000',
    type:         'draw_request',
    uploaded_at:  '4 days ago',
    milestone_id: 'ms-hb-3',
  },
  {
    id:           'ev-hb3-4',
    name:         'Site Photo — Steel Frame Erection Progress',
    type:         'photo',
    uploaded_at:  '4 days ago',
    milestone_id: 'ms-hb-3',
  },
]

// ── Audit Timeline (Harbor Deal) ─────────────────────────────────────────────

export interface DemoAuditEvent {
  id:        string
  action:    string
  actor:     string
  timestamp: string
  detail?:   string
}

export const harborDealAuditTimeline: DemoAuditEvent[] = [
  { id: 'audit-1',  action: 'deal_created',          actor: 'Sarah Chen',          timestamp: 'October 25, 2025', detail: 'Deal created — $9,100,000 total contract value' },
  { id: 'audit-2',  action: 'contract_uploaded',      actor: 'Marcus Webb',         timestamp: 'October 25, 2025', detail: 'Harbor_Logistics_Agreement.pdf uploaded' },
  { id: 'audit-3',  action: 'docusign_envelope_sent', actor: 'Marcus Webb',         timestamp: 'October 25, 2025', detail: 'DocuSign envelope sent for signatures' },
  { id: 'audit-4',  action: 'contract_funder_signed', actor: 'Sarah Chen',          timestamp: 'October 25, 2025', detail: 'Funder signature completed in DocuSign' },
  { id: 'audit-5',  action: 'contract_signed',        actor: 'Marcus Webb',         timestamp: 'October 25, 2025', detail: 'Contract fully executed — both parties signed' },
  { id: 'audit-6',  action: 'sov_submitted',          actor: 'Marcus Webb',         timestamp: 'October 28, 2025', detail: 'Schedule of Values submitted — 5 line items, $9,100,000' },
  { id: 'audit-7',  action: 'sov_approved',           actor: 'Sarah Chen',          timestamp: 'October 29, 2025', detail: 'SOV approved — all 5 line items verified' },
  { id: 'audit-8',  action: 'milestone_released',     actor: 'Sarah Chen',          timestamp: '14 days ago',      detail: 'Site Preparation & Grading released — $320,000' },
  { id: 'audit-9',  action: 'milestone_released',     actor: 'Sarah Chen',          timestamp: '7 days ago',       detail: 'Concrete Sub-grade & Foundations released — $1,840,000' },
  { id: 'audit-10', action: 'evidence_uploaded',      actor: 'Marcus Webb',         timestamp: '5 days ago',       detail: 'Draw #3 evidence uploaded — inspection report, lien waiver, draw request' },
  { id: 'audit-11', action: 'draw_submitted',         actor: 'Marcus Webb',         timestamp: '4 days ago',       detail: 'Draw #3 submitted for review — $2,180,000' },
  { id: 'audit-12', action: 'ai_review_completed',    actor: 'Perplexity Computer', timestamp: '3 days ago',       detail: 'AI Draw Review completed — score 91/100, risk: low' },
  { id: 'audit-13', action: 'draw_brief_generated',   actor: 'Perplexity Computer', timestamp: '3 days ago',       detail: 'Draw Control Brief generated — all 10 release conditions verified' },
  { id: 'audit-14', action: 'milestone_approved',     actor: 'System',              timestamp: '2 days ago',       detail: 'Structural Steel Erection approved — awaiting funder authorization' },
  { id: 'audit-15', action: 'release_gate_verified',  actor: 'System',              timestamp: '2 days ago',       detail: 'Release gate verified — 10/10 conditions passed — funder authorization required' },
]
