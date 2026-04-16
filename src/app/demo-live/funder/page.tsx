import Link from 'next/link'
import { Landmark, TrendingUp, DollarSign, AlertCircle, Lightbulb, ArrowRight, CheckCircle2, Clock, Zap } from 'lucide-react'

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_DEALS = [
  {
    id: 'riverside',
    title: 'Riverside Mixed-Use Development',
    total: 2_400_000,
    funded: 2_400_000,
    released: 480_000,
    status: 'active',
    milestoneCount: 4,
    actionRequired: true,
  },
  {
    id: 'harbor',
    title: 'Harbor Logistics Center',
    total: 9_100_000,
    funded: 9_100_000,
    released: 3_460_000,
    status: 'active',
    milestoneCount: 5,
    actionRequired: false,
  },
  {
    id: 'westside',
    title: 'Westside Medical Office Campus',
    total: 4_750_000,
    funded: 4_750_000,
    released: 950_000,
    status: 'active',
    milestoneCount: 4,
    actionRequired: false,
  },
]

const BRIEFING_INSIGHTS = [
  'Milestone 3 on Riverside Mixed-Use is ready for AI review — $680,000 pending',
  'Harbor Logistics Milestone 4 passed AI review with score 92 — ready to approve',
  'Westside Medical Site Work released on time — project 20% complete',
]

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DemoFunderPage() {
  const totalDeals = MOCK_DEALS.length
  const capitalDeployed = MOCK_DEALS.reduce((s, d) => s + d.funded, 0)
  const totalReleased = MOCK_DEALS.reduce((s, d) => s + d.released, 0)
  const actionQueue = MOCK_DEALS.filter(d => d.actionRequired).length

  return (
    <div className="page-container section space-y-8">
      {/* Demo info */}
      <div className="rounded-xl border border-vektrum-blue-border bg-vektrum-blue-subtle px-5 py-4">
        <p className="text-[13px] text-vektrum-blue leading-relaxed">
          You&apos;re viewing the Funder dashboard as <strong>Sarah Chen</strong>. In the live app, this connects to your real portfolio.
        </p>
      </div>

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-vektrum-text">
          Welcome back, Sarah
        </h1>
        <div className="mt-1.5 flex items-center gap-2">
          <p className="text-sm text-vektrum-muted">Funder dashboard</p>
          <span className="inline-flex items-center rounded-full bg-vektrum-blue-subtle border border-vektrum-blue-border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-vektrum-blue">
            Funder
          </span>
        </div>
      </div>

      {/* Weekly Intelligence Briefing */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden">
        <div className="border-l-4 border-vektrum-blue px-5 py-4 border-b border-vektrum-border-subtle">
          <div className="flex items-center gap-2">
            <Lightbulb size={15} className="text-vektrum-blue" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-vektrum-text">Weekly Intelligence Briefing</p>
          </div>
        </div>
        <ul className="px-5 py-4 space-y-3">
          {BRIEFING_INSIGHTS.map((insight, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px] text-vektrum-muted leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-vektrum-blue flex-shrink-0" />
              {insight}
            </li>
          ))}
        </ul>
      </div>

      {/* Capital Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/demo-live/funder/deals" className="hover:border-vektrum-blue hover:shadow-md transition-all cursor-pointer rounded-lg">
          <StatTile label="Total Deals" value={totalDeals} icon={TrendingUp} />
        </Link>
        <Link href="/demo-live/funder/capital" className="hover:border-vektrum-blue hover:shadow-md transition-all cursor-pointer rounded-lg">
          <MoneyTile label="Capital Deployed" amount={capitalDeployed} icon={DollarSign} />
        </Link>
        <Link href="/demo-live/funder/capital#released" className="hover:border-vektrum-blue hover:shadow-md transition-all cursor-pointer rounded-lg">
          <MoneyTile label="Total Released" amount={totalReleased} icon={CheckCircle2} />
        </Link>
        <Link href="/demo-live/funder#action-queue" className="hover:border-vektrum-blue hover:shadow-md transition-all cursor-pointer rounded-lg">
          <StatTile label="Action Queue" value={actionQueue} icon={AlertCircle} warning={actionQueue > 0} />
        </Link>
      </div>

      {/* Portfolio Risk Overview */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-vektrum-border-subtle">
          <p className="text-[13px] font-semibold text-vektrum-text">Portfolio Overview</p>
        </div>
        <div className="p-5 space-y-3">
          {MOCK_DEALS.map((deal) => {
            const pct = deal.total > 0 ? Math.round((deal.released / deal.total) * 100) : 0
            return (
              <div key={deal.id} className="flex items-center gap-4">
                <Link href={`/demo-live/deal/${deal.id}`} className="text-[13px] font-medium text-vektrum-text hover:text-vektrum-blue transition-colors flex-1 min-w-0 truncate">
                  {deal.title}
                </Link>
                <div className="w-24 h-2 rounded-full bg-vektrum-surface-alt flex-shrink-0 overflow-hidden">
                  <div className="h-full rounded-full bg-vektrum-green" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[12px] text-vektrum-muted tabular-nums w-10 text-right flex-shrink-0">{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Action Queue */}
      {actionQueue > 0 && (
        <section id="action-queue">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-amber">
            Action Queue ({actionQueue})
          </h2>
          <div className="rounded-xl border border-vektrum-amber-border bg-vektrum-surface shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-vektrum-text">Riverside Mixed-Use Development</p>
                <p className="text-[12px] text-vektrum-muted mt-0.5">MEP Rough-In &mdash; {fmt(680_000)} &mdash; ready for review</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2.5 py-0.5 text-[11px] font-medium text-vektrum-amber">
                  <Clock size={11} aria-hidden="true" />
                  Ready for review
                </span>
                <Link
                  href="/demo-live/deal/riverside"
                  className="inline-flex items-center gap-1 rounded-lg bg-vektrum-blue px-3 py-2 text-[12px] font-medium text-white hover:bg-vektrum-blue-hover transition-colors"
                >
                  Review <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* All Deals */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-muted">
          Funded Deals
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_DEALS.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </section>

      {/* Featured Scenario */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-muted">
          Featured Scenario
        </h2>
        <Link
          href="/demo-live/deal/harbor-dispute"
          className="group block rounded-xl border border-vektrum-border bg-vektrum-surface p-5 shadow-sm hover:shadow-md hover:border-vektrum-blue transition-all"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-vektrum-red-bg flex-shrink-0">
              <Zap size={16} className="text-vektrum-red" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-vektrum-text group-hover:text-vektrum-blue transition-colors">
                Partial Dispute Scenario
              </p>
              <p className="mt-1 text-[13px] text-vektrum-muted leading-relaxed">
                See how Vektrum handles a flagged line item while keeping 84% of project funds flowing.
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-vektrum-blue">
                View Scenario <ArrowRight size={12} aria-hidden="true" />
              </span>
            </div>
          </div>
        </Link>
      </section>
    </div>
  )
}

// ── Inline components ────────────────────────────────────────────────────────

function StatTile({ label, value, icon: Icon, warning = false }: { label: string; value: string | number; icon: React.ElementType; warning?: boolean }) {
  return (
    <div className={`rounded-lg border bg-vektrum-surface px-5 py-5 shadow-sm hover:border-vektrum-blue hover:shadow-md transition-all cursor-pointer ${warning ? 'border-vektrum-amber-border' : 'border-vektrum-border'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">{label}</p>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${warning ? 'bg-vektrum-amber-bg' : 'bg-vektrum-blue-subtle'}`}>
          <Icon size={13} className={warning ? 'text-vektrum-amber' : 'text-vektrum-blue'} aria-hidden="true" />
        </div>
      </div>
      <p className={`font-display text-4xl font-bold tabular-nums leading-none ${warning ? 'text-vektrum-amber' : 'text-vektrum-text'}`}>{value}</p>
    </div>
  )
}

function MoneyTile({ label, amount, icon: Icon }: { label: string; amount: number; icon: React.ElementType }) {
  return (
    <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm hover:border-vektrum-blue hover:shadow-md transition-all cursor-pointer">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">{label}</p>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-vektrum-blue-subtle">
          <Icon size={13} className="text-vektrum-blue" aria-hidden="true" />
        </div>
      </div>
      <p className="font-display text-xl font-bold tabular-nums leading-none text-vektrum-text">{fmt(amount)}</p>
    </div>
  )
}

function DealCard({ deal }: { deal: typeof MOCK_DEALS[number] }) {
  const pct = deal.total > 0 ? Math.round((deal.released / deal.total) * 100) : 0
  return (
    <Link
      href={`/demo-live/deal/${deal.id}`}
      className="group rounded-xl border border-vektrum-border bg-vektrum-surface p-5 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center rounded-full border border-vektrum-green-border bg-vektrum-green-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-vektrum-green">
          {deal.status}
        </span>
        <span className="text-[11px] text-vektrum-faint">{deal.milestoneCount} milestones</span>
      </div>
      <p className="text-[14px] font-semibold text-vektrum-text group-hover:text-vektrum-blue transition-colors">{deal.title}</p>
      <p className="mt-1 text-[12px] text-vektrum-muted">Marcus Webb &middot; Webb Construction Group</p>
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-vektrum-surface-alt overflow-hidden">
          <div className="h-full rounded-full bg-vektrum-green" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] text-vektrum-faint tabular-nums">{pct}%</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-[12px]">
        <span className="text-vektrum-muted">Total: {fmt(deal.total)}</span>
        <span className="text-vektrum-green font-medium">Released: {fmt(deal.released)}</span>
      </div>
    </Link>
  )
}
