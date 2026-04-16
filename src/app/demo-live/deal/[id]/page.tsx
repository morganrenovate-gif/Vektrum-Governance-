import { notFound } from 'next/navigation'
import Link from 'next/link'
import { DemoMilestoneList } from './demo-milestone-list'

// ── Mock data ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

interface Milestone {
  title: string
  amount: number
  status: 'released' | 'approved' | 'ready_for_review' | 'in_progress' | 'not_started' | 'disputed'
  releasedAgo?: string
  aiScore?: number
  riskLevel?: string
  findings?: string[]
  disputedLineItem?: string
  disputeReason?: string
  fundsReleased?: number
  fundsHeld?: number
}

interface Deal {
  title: string
  total: number
  funded: number
  released: number
  status: string
  startedAgo: string
  contractor: string
  funder: string
  milestones: Milestone[]
}

const DEALS: Record<string, Deal> = {
  riverside: {
    title: 'Riverside Mixed-Use Development',
    total: 2_400_000,
    funded: 2_400_000,
    released: 480_000,
    status: 'active',
    startedAgo: '90 days ago',
    contractor: 'Marcus Webb',
    funder: 'Sarah Chen',
    milestones: [
      { title: 'Foundation & Site Prep', amount: 480_000, status: 'released', releasedAgo: '45 days ago' },
      { title: 'Framing & Structural Steel', amount: 720_000, status: 'approved', aiScore: 87, riskLevel: 'low', findings: ['Lien waiver on file', 'Inspection report attached', 'Amount aligns with scope', 'No open disputes'] },
      { title: 'MEP Rough-In', amount: 680_000, status: 'ready_for_review' },
      { title: 'Finishes & Certificate of Occupancy', amount: 520_000, status: 'not_started' },
    ],
  },
  harbor: {
    title: 'Harbor Logistics Center',
    total: 9_100_000,
    funded: 9_100_000,
    released: 3_460_000,
    status: 'active',
    startedAgo: '180 days ago',
    contractor: 'Marcus Webb',
    funder: 'Sarah Chen',
    milestones: [
      { title: 'Site Preparation & Grading', amount: 320_000, status: 'released', releasedAgo: '14 days ago' },
      { title: 'Concrete Sub-grade & Foundations', amount: 1_840_000, status: 'released', releasedAgo: '7 days ago' },
      { title: 'Structural Steel Erection', amount: 2_180_000, status: 'released', releasedAgo: '3 days ago' },
      { title: 'Building Envelope & Roofing', amount: 2_640_000, status: 'approved', aiScore: 92, riskLevel: 'low', findings: ['All 3 required documents present', 'Structural inspection signed off', 'No change orders pending'] },
      { title: 'MEP Systems & Commissioning', amount: 2_120_000, status: 'in_progress' },
    ],
  },
  westside: {
    title: 'Westside Medical Office Campus',
    total: 4_750_000,
    funded: 4_750_000,
    released: 950_000,
    status: 'active',
    startedAgo: '30 days ago',
    contractor: 'Marcus Webb',
    funder: 'Sarah Chen',
    milestones: [
      { title: 'Site Work & Utilities', amount: 475_000, status: 'released', releasedAgo: '15 days ago' },
      { title: 'Structural Frame & Enclosure', amount: 1_425_000, status: 'in_progress' },
      { title: 'Interior Build-Out & MEP', amount: 1_900_000, status: 'not_started' },
      { title: 'FF&E, Technology & CO', amount: 950_000, status: 'not_started' },
    ],
  },
  'harbor-dispute': {
    title: 'Harbor Logistics Center \u2014 Partial Dispute',
    total: 9_100_000,
    funded: 9_100_000,
    released: 7_640_000,
    status: 'active',
    startedAgo: '180 days ago',
    contractor: 'Marcus Webb',
    funder: 'Sarah Chen',
    milestones: [
      {
        title: 'Site Preparation & Grading',
        amount: 320_000,
        status: 'released',
        releasedAgo: '60 days ago',
      },
      {
        title: 'Concrete Sub-grade & Foundations',
        amount: 1_840_000,
        status: 'released',
        releasedAgo: '45 days ago',
      },
      {
        title: 'Structural Steel Erection',
        amount: 2_180_000,
        status: 'released',
        releasedAgo: '30 days ago',
      },
      {
        title: 'Building Envelope & Roofing',
        amount: 2_640_000,
        status: 'released',
        releasedAgo: '14 days ago',
      },
      {
        title: 'MEP Systems & Commissioning',
        amount: 2_120_000,
        status: 'disputed',
        disputedLineItem: 'HVAC equipment procurement \u2014 $487,000',
        disputeReason: 'AI draw review flagged invoice mismatch: submitted amount exceeds approved scope by $487,000. Supporting documentation does not reconcile with change order CO-004.',
        aiScore: 34,
        riskLevel: 'high',
        findings: [
          '\u26a0 Invoice amount ($847K) exceeds approved scope ($360K) by $487,000',
          '\u26a0 Change order CO-004 not signed by funder',
          '\u2713 Lien waiver on file',
          '\u2713 General inspection report attached',
        ],
        fundsReleased: 1_633_000,
        fundsHeld: 487_000,
      },
    ],
  },
}

const RELEASE_GATE_CONDITIONS = [
  'Milestone marked as approved by funder',
  'AI draw review completed with no high-risk flags',
  'No open disputes on this milestone',
  'Contractor Stripe account verified and payouts enabled',
  'Milestone amount matches funded allocation',
  'Funder has sufficient funded balance for this draw',
  'Audit log entry created for release action',
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DemoDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deal = DEALS[id]
  if (!deal) notFound()

  const pct = deal.total > 0 ? Math.round((deal.released / deal.total) * 100) : 0

  return (
    <div className="page-container section space-y-8">
      {/* Back link */}
      <Link
        href="/demo-live/funder"
        className="inline-flex items-center gap-1 text-[13px] text-vektrum-muted hover:text-vektrum-blue transition-colors"
      >
        &larr; Back to dashboard
      </Link>

      {/* Deal Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-display text-2xl font-bold text-vektrum-text">{deal.title}</h1>
            <span className="inline-flex items-center rounded-full border border-vektrum-green-border bg-vektrum-green-bg px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-vektrum-green">
              {deal.status}
            </span>
          </div>
          <p className="text-sm text-vektrum-muted">
            {deal.contractor} &middot; {deal.funder} &middot; Started {deal.startedAgo}
          </p>
        </div>
      </div>

      {/* Money Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Total</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-vektrum-text">{fmt(deal.total)}</p>
        </div>
        <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Funded</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-vektrum-text">{fmt(deal.funded)}</p>
        </div>
        <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Released</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-vektrum-green">{fmt(deal.released)}</p>
        </div>
        <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Progress</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-vektrum-text">{pct}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-vektrum-surface-alt overflow-hidden">
            <div className="h-full rounded-full bg-vektrum-green" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Milestones */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-muted">
          Milestones
        </h2>
        <DemoMilestoneList milestones={deal.milestones} releaseGateConditions={RELEASE_GATE_CONDITIONS} dealTotal={deal.total} dealReleased={deal.released} />
      </section>
    </div>
  )
}
