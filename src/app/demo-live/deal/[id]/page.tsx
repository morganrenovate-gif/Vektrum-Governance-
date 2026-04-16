import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Clock, Brain, Shield, AlertCircle, Lock } from 'lucide-react'

// ── Mock data ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

interface Milestone {
  title: string
  amount: number
  status: 'released' | 'approved' | 'ready_for_review' | 'in_progress' | 'not_started'
  releasedAgo?: string
  aiScore?: number
  riskLevel?: string
  findings?: string[]
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
        <div className="space-y-4">
          {deal.milestones.map((ms, i) => (
            <MilestoneCard key={i} milestone={ms} index={i + 1} />
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Milestone Card ───────────────────────────────────────────────────────────

function MilestoneCard({ milestone: ms, index }: { milestone: Milestone; index: number }) {
  const statusConfig = {
    released: { label: 'Released', color: 'text-vektrum-green', bg: 'bg-vektrum-green-bg border-vektrum-green-border' },
    approved: { label: 'Approved', color: 'text-vektrum-blue', bg: 'bg-vektrum-blue-subtle border-vektrum-blue-border' },
    ready_for_review: { label: 'Ready for Review', color: 'text-vektrum-amber', bg: 'bg-vektrum-amber-bg border-vektrum-amber-border' },
    in_progress: { label: 'In Progress', color: 'text-vektrum-muted', bg: 'bg-vektrum-surface-alt border-vektrum-border' },
    not_started: { label: 'Not Started', color: 'text-vektrum-faint', bg: 'bg-vektrum-surface-alt border-vektrum-border' },
  }

  const cfg = statusConfig[ms.status]

  return (
    <div className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-vektrum-surface-alt text-[12px] font-bold text-vektrum-muted">
            {index}
          </span>
          <div>
            <p className="text-[14px] font-semibold text-vektrum-text">{ms.title}</p>
            <p className="text-[12px] text-vektrum-muted mt-0.5">{fmt(ms.amount)}</p>
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      {/* Released state */}
      {ms.status === 'released' && (
        <div className="border-t border-vektrum-border-subtle px-5 py-3 flex items-center gap-2 text-[13px] text-vektrum-green">
          <CheckCircle2 size={14} aria-hidden="true" />
          Released &mdash; {ms.releasedAgo}
        </div>
      )}

      {/* Approved state — show AI review */}
      {ms.status === 'approved' && ms.aiScore && (
        <div className="border-t border-vektrum-border-subtle">
          <div className="px-5 py-4 space-y-3">
            {/* AI Review Panel */}
            <div className="rounded-lg border border-vektrum-blue-border bg-vektrum-blue-subtle p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={14} className="text-vektrum-blue" aria-hidden="true" />
                <span className="text-[13px] font-semibold text-vektrum-blue">AI Draw Review</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Score</p>
                  <p className="text-xl font-bold text-vektrum-blue tabular-nums">{ms.aiScore}/100</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Risk</p>
                  <p className="text-[14px] font-semibold text-vektrum-green">{ms.riskLevel}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Recommendation</p>
                  <p className="text-[14px] font-semibold text-vektrum-green">Approve</p>
                </div>
              </div>
              <ul className="space-y-1.5">
                {ms.findings?.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12px] text-vektrum-blue">
                    <CheckCircle2 size={12} aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Approve button (non-functional) */}
            <button
              type="button"
              className="w-full rounded-lg bg-vektrum-blue px-4 py-2.5 text-[13px] font-medium text-white cursor-default"
              title="Demo mode — approval simulated"
            >
              Approve Draw
            </button>

            {/* Release button (disabled) */}
            <button
              type="button"
              disabled
              className="w-full rounded-lg border border-vektrum-border bg-vektrum-surface px-4 py-2.5 text-[13px] font-medium text-vektrum-muted opacity-60 cursor-not-allowed"
              title="Demo mode — no real releases"
            >
              <Lock size={12} className="inline mr-1.5" aria-hidden="true" />
              Release Funds (Demo)
            </button>

            {/* 7-condition gate checklist */}
            <div className="rounded-lg border border-vektrum-border bg-vektrum-surface p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={14} className="text-vektrum-blue" aria-hidden="true" />
                <span className="text-[12px] font-semibold text-vektrum-text">7-Condition Release Gate</span>
              </div>
              <ul className="space-y-2">
                {RELEASE_GATE_CONDITIONS.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12px] text-vektrum-green">
                    <CheckCircle2 size={12} className="flex-shrink-0" aria-hidden="true" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Ready for review state */}
      {ms.status === 'ready_for_review' && (
        <div className="border-t border-vektrum-border-subtle px-5 py-3 flex items-center gap-2 text-[13px] text-vektrum-amber">
          <AlertCircle size={14} aria-hidden="true" />
          AI Review Requested &mdash; pending analysis
        </div>
      )}

      {/* In progress state */}
      {ms.status === 'in_progress' && (
        <div className="border-t border-vektrum-border-subtle px-5 py-3 flex items-center gap-2 text-[13px] text-vektrum-muted">
          <Clock size={14} aria-hidden="true" />
          Work in progress
        </div>
      )}
    </div>
  )
}
