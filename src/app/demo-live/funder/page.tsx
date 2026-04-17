'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Landmark, TrendingUp, DollarSign, AlertCircle, Lightbulb, ArrowRight, ArrowLeft, CheckCircle2, Clock, Zap } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { FundDealModal } from '@/components/demo/FundDealModal'

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
  },
  {
    id: 'harbor',
    title: 'Harbor Logistics Center',
    total: 9_100_000,
    funded: 9_100_000,
    released: 3_460_000,
    status: 'active',
    milestoneCount: 5,
  },
  {
    id: 'westside',
    title: 'Westside Medical Office Campus',
    total: 4_750_000,
    funded: 4_750_000,
    released: 950_000,
    status: 'active',
    milestoneCount: 4,
  },
]

const BRIEFING_INSIGHTS = [
  'Milestone 3 on Riverside Mixed-Use is ready for AI review — $680,000 pending',
  'Harbor Logistics Milestone 4 passed AI review with score 92 — ready to approve',
  'Westside Medical Site Work released on time — project 20% complete',
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DemoFunderPage() {
  const [fundModal, setFundModal] = useState(false)

  const totalDeals = MOCK_DEALS.length
  const capitalDeployed = MOCK_DEALS.reduce((s, d) => s + d.funded, 0)
  const totalReleased = MOCK_DEALS.reduce((s, d) => s + d.released, 0)

  return (
    <div className="page-container section space-y-8">
      {/* Back link */}
      <Link
        href="/demo-live"
        className="inline-flex items-center gap-1.5 text-sm text-vektrum-muted hover:text-vektrum-text transition-colors"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to role selector
      </Link>

      {/* Demo info */}
      <div className="rounded-xl border border-vektrum-blue-border bg-vektrum-blue-subtle px-5 py-4">
        <p className="text-[13px] text-vektrum-blue leading-relaxed">
          You&apos;re viewing the Funder dashboard as <strong>Sarah Chen</strong>. In the live app, this connects to your real portfolio.
        </p>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <button
          onClick={() => setFundModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Fund New Deal
        </button>
      </div>

      <FundDealModal open={fundModal} onConfirm={() => setFundModal(false)} onClose={() => setFundModal(false)} />

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
        <StatTile label="Total Deals" value={totalDeals} icon={TrendingUp} href="#funded-deals" />
        <MoneyTile label="Capital Deployed" amount={capitalDeployed} icon={DollarSign} href="/demo-live/funder/capital" />
        <MoneyTile label="Total Released" amount={totalReleased} icon={CheckCircle2} href="#portfolio-overview" />
        <Link href="/demo-live/deal/harbor-dispute?from=funder">
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-5 py-5 shadow-sm transition-all hover:border-orange-400 hover:shadow-md cursor-pointer">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Action Queue</p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100">
                <AlertCircle size={13} className="text-orange-500" aria-hidden="true" />
              </div>
            </div>
            <p className="font-display text-4xl font-bold tabular-nums leading-none text-orange-500">1</p>
          </div>
        </Link>
      </div>

      {/* Portfolio Overview */}
      <div id="portfolio-overview" className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-vektrum-border-subtle">
          <p className="text-[13px] font-semibold text-vektrum-text">Portfolio Overview</p>
        </div>
        <div className="p-5 space-y-3">
          {MOCK_DEALS.map((deal) => {
            const pct = deal.total > 0 ? Math.round((deal.released / deal.total) * 100) : 0
            return (
              <Link key={deal.id} href={`/demo-live/deal/${deal.id}?from=funder`} className="flex items-center gap-4 hover:bg-vektrum-surface-alt rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                <span className="text-[13px] font-medium text-vektrum-text hover:text-vektrum-blue transition-colors flex-1 min-w-0 truncate">
                  {deal.title}
                </span>
                <span className="inline-flex items-center rounded-full border border-vektrum-green-border bg-vektrum-green-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-vektrum-green flex-shrink-0">
                  Active
                </span>
                <span className="text-[12px] text-vektrum-muted tabular-nums flex-shrink-0">{formatCurrency(deal.total)}</span>
                <div className="w-24 h-2 rounded-full bg-vektrum-surface-alt flex-shrink-0 overflow-hidden">
                  <div className="h-full rounded-full bg-vektrum-green" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[12px] text-vektrum-muted tabular-nums w-20 text-right flex-shrink-0">{pct}% released</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Action Queue */}
      <section id="action-queue" className="mt-6">
        <h2 className="text-lg font-semibold text-vektrum-text mb-3 flex items-center gap-2">
          <AlertCircle size={18} className="text-amber-500" /> Action Required
        </h2>
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-vektrum-text">Riverside Mixed-Use Development</p>
            <p className="text-sm text-vektrum-muted">MEP Rough-In — {formatCurrency(680_000)} · Ready for Review</p>
          </div>
          <Link href="/demo-live/deal/riverside?from=funder" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Review Draw →
          </Link>
        </div>
        <div className="border border-red-200 bg-red-50 rounded-xl p-4 flex items-center justify-between mt-3">
          <div>
            <p className="font-medium text-vektrum-text">Harbor Logistics Center</p>
            <p className="text-sm text-red-600">HVAC Equipment Procurement — {formatCurrency(487_000)} · Dispute Active</p>
          </div>
          <Link href="/demo-live/deal/harbor-dispute?from=funder" className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700">
            View Dispute →
          </Link>
        </div>
      </section>

      {/* Funded Deals */}
      <section id="funded-deals">
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
          href="/demo-live/deal/harbor-dispute?from=funder"
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

function StatTile({ label, value, icon: Icon, href }: { label: string; value: string | number; icon: React.ElementType; href?: string }) {
  const inner = (
    <div className={`rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm transition-all ${href ? 'hover:border-vektrum-blue hover:shadow-md cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">{label}</p>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-vektrum-blue-subtle">
          <Icon size={13} className="text-vektrum-blue" aria-hidden="true" />
        </div>
      </div>
      <p className="font-display text-4xl font-bold tabular-nums leading-none text-vektrum-text">{value}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function MoneyTile({ label, amount, icon: Icon, href }: { label: string; amount: number; icon: React.ElementType; href?: string }) {
  const inner = (
    <div className={`rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm transition-all ${href ? 'hover:border-vektrum-blue hover:shadow-md cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">{label}</p>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-vektrum-blue-subtle">
          <Icon size={13} className="text-vektrum-blue" aria-hidden="true" />
        </div>
      </div>
      <p className="font-display text-xl font-bold tabular-nums leading-none text-vektrum-text">{formatCurrency(amount)}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function DealCard({ deal }: { deal: typeof MOCK_DEALS[number] }) {
  const pct = deal.total > 0 ? Math.round((deal.released / deal.total) * 100) : 0
  return (
    <Link
      href={`/demo-live/deal/${deal.id}?from=funder`}
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
        <span className="text-vektrum-muted">Total: {formatCurrency(deal.total)}</span>
        <span className="text-vektrum-green font-medium">Released: {formatCurrency(deal.released)}</span>
      </div>
    </Link>
  )
}
