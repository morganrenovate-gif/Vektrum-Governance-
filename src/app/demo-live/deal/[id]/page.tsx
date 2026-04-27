import { notFound } from 'next/navigation'
import Link from 'next/link'
import { DemoMilestoneList } from './demo-milestone-list'
import {
  riverside,
  harbor,
  westside,
  harborDisputeMilestones,
  type DemoDeal,
  type DemoMilestone,
  type DisputeMilestone,
} from '@/lib/demo-data'

// ── Demo data — canonical only ───────────────────────────────────────────────
//
// This route used to hold its own inline DEALS object that drifted from the
// canonical data in src/lib/demo-data/index.ts (e.g. Harbor's Structural Steel
// shown as "released" while the rest of the demo treated it as "approved").
//
// All deal data now comes from the canonical exports.  Local types here only
// describe the slimmer shape the milestone-list component expects.

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

interface ListMilestone {
  title:             string
  amount:            number
  status:            'released' | 'approved' | 'ready_for_review' | 'in_progress' | 'not_started' | 'disputed'
  releasedAgo?:      string
  aiScore?:          number
  riskLevel?:        string
  findings?:         string[]
  disputedLineItem?: string
  disputeReason?:    string
  fundsReleased?:    number
  fundsHeld?:        number
}

interface DealView {
  title:       string
  total:       number
  funded:      number
  released:    number
  status:      string
  startedAgo:  string
  contractor:  string
  funder:      string
  milestones:  ListMilestone[]
}

// ── Mappers ──────────────────────────────────────────────────────────────────
//
// The canonical types use slightly different field names than the
// presentation component expects (`name` vs `title`, `releasedAt` vs
// `releasedAgo`, `aiRisk` vs `riskLevel`).  Map at the boundary so the canonical
// data stays clean and the view component stays unchanged.

function mapDemoMilestone(m: DemoMilestone): ListMilestone {
  return {
    title:        m.name,
    amount:       m.amount,
    status:       m.status,
    releasedAgo:  m.releasedAt,
    aiScore:      m.aiScore,
    riskLevel:    m.aiRisk,
  }
}

function mapDisputeMilestone(m: DisputeMilestone): ListMilestone {
  return {
    title:            m.name,
    amount:           m.amount,
    status:           m.status,
    releasedAgo:      m.releasedAt,
    aiScore:          m.aiScore,
    riskLevel:        m.aiRisk,
    findings:         m.findings,
    disputedLineItem: m.disputedLineItem,
    disputeReason:    m.disputeReason,
    fundsReleased:    m.fundsReleased,
    fundsHeld:        m.fundsHeld,
  }
}

function fromDemoDeal(deal: DemoDeal): DealView {
  return {
    title:      deal.title,
    total:      deal.total,
    funded:     deal.funded,
    released:   deal.released,
    status:     deal.status,
    startedAgo: deal.startedAgo,
    contractor: deal.contractor,
    funder:     deal.funder,
    milestones: deal.milestones.map(mapDemoMilestone),
  }
}

// Harbor-dispute uses the harbor deal frame but its own milestone list. The
// canonical `harborDisputeMilestones` is a separate array (4 released + 1
// disputed + 1 partial-released).  Released total is the sum of fully released
// + the partial release on the MEP milestone.
const harborDisputeReleased = harborDisputeMilestones.reduce((sum, m) => {
  if (m.status === 'released' && m.fundsReleased == null) return sum + m.amount
  if (m.fundsReleased != null) return sum + m.fundsReleased
  return sum
}, 0)

const harborDispute: DealView = {
  title:      'Harbor Logistics Center — Partial Dispute',
  total:      9_100_000,
  funded:     9_100_000,
  released:   harborDisputeReleased,
  status:     'active',
  startedAgo: '180 days ago',
  contractor: harbor.contractor,
  funder:     harbor.funder,
  milestones: harborDisputeMilestones.map(mapDisputeMilestone),
}

const DEALS: Record<string, DealView> = {
  riverside:        fromDemoDeal(riverside),
  harbor:           fromDemoDeal(harbor),
  westside:         fromDemoDeal(westside),
  'harbor-dispute': harborDispute,
}

const RELEASE_GATE_CONDITIONS = [
  'Milestone approved by funder',
  'Milestone protection status: ready_for_release',
  'Funded balance covers this disbursement (incl. fee)',
  'Contractor Stripe payouts enabled',
  'Contractor onboarding complete',
  'No prior release on this milestone',
  'No pending change orders',
  'Signed contract on file',
  'Sequential-release ordering and prerequisites satisfied (where required)',
  'Approved conditional lien waiver on file (where required)',
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DemoDealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const deal = DEALS[id]
  if (!deal) notFound()

  const backHref = from === 'contractor' ? '/demo-live/contractor'
    : from === 'admin' ? '/demo-live/admin'
    : '/demo-live/funder'
  const backLabel = from === 'contractor' ? '← Back to contractor dashboard'
    : from === 'admin' ? '← Back to admin dashboard'
    : '← Back to funder dashboard'

  const pct = deal.total > 0 ? Math.round((deal.released / deal.total) * 100) : 0

  return (
    <div className="page-container section space-y-8">
      {/* Back link */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-[13px] text-white/70 hover:text-blue-300 transition-colors"
      >
        {backLabel}
      </Link>

      {/* Deal Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-display text-2xl font-bold text-white">{deal.title}</h1>
            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
              {deal.status}
            </span>
          </div>
          <p className="text-sm text-white/55">
            {deal.contractor} &middot; {deal.funder} &middot; Started {deal.startedAgo}
          </p>
        </div>
      </div>

      {/* Money Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-white/[0.08] bg-surface-2 px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Total</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-white">{fmt(deal.total)}</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-surface-2 px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Funded</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-white">{fmt(deal.funded)}</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-surface-2 px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Released</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-emerald-400">{fmt(deal.released)}</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-surface-2 px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Progress</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-white">{pct}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-surface-3 overflow-hidden">
            <div className="h-full rounded-full bg-vektrum-green" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Milestones */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/55">
          Milestones
        </h2>
        <DemoMilestoneList milestones={deal.milestones} releaseGateConditions={RELEASE_GATE_CONDITIONS} dealTotal={deal.total} dealReleased={deal.released} />
      </section>
    </div>
  )
}
