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
