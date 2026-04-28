'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Landmark, TrendingUp, DollarSign, AlertCircle, Lightbulb, ArrowRight, ArrowLeft, CheckCircle2, Clock, Zap } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { FundDealModal } from '@/components/demo/FundDealModal'
import { DemoFunderTour } from '@/components/demo/DemoFunderTour'
import { useDemoAutoReset } from '@/lib/demo-data/use-demo-auto-reset'

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
    contractor: 'Marcus Webb',
    contractorCompany: 'Webb Construction Group',
  },
  {
    id: 'harbor',
    title: 'Harbor Logistics Center',
    total: 9_100_000,
    funded: 9_100_000,
    released: 2_160_000,
    status: 'active',
    milestoneCount: 5,
    contractor: 'Marcus Webb',
    contractorCompany: 'Webb Construction Group',
  },
  {
    id: 'westside',
    title: 'Westside Medical Office Campus',
    total: 4_750_000,
    funded: 4_750_000,
    released: 950_000,
    status: 'active',
    milestoneCount: 4,
    contractor: 'Diane Reyes',
    contractorCompany: 'Reyes Development Partners',
  },
]

const BRIEFING_INSIGHTS = [
  'Milestone 3 on Riverside Mixed-Use is ready for AI review — $680,000 pending',
  'Harbor Logistics Milestone 3 (Structural Steel) passed AI review with score 91 — ready to approve',
  'Westside Medical Site Work released on time — project 20% complete',
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DemoFunderPage() {
  const [fundModal, setFundModal] = useState(false)

  useDemoAutoReset(() => {
    setFundModal(false)
  })

  const totalDeals = MOCK_DEALS.length
  const capitalDeployed = MOCK_DEALS.reduce((s, d) => s + d.funded, 0)
  const totalReleased = MOCK_DEALS.reduce((s, d) => s + d.released, 0)

  return (
    <div className="min-h-screen bg-surface-0">
    <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16 space-y-8">
      {/* Back link */}
      <Link
        href="/demo-live"
        className="inline-flex items-center gap-1.5 text-sm text-white/65 hover:text-white transition-colors"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to role selector
      </Link>

      {/* Demo info banner */}
      <div className="rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/10 px-5 py-4">
        <p className="text-[13px] text-blue-200 leading-relaxed">
          You&apos;re viewing the Funder dashboard as <strong>Sarah Chen</strong>. In the live app, this connects to your real portfolio.
        </p>
      </div>

      {/* Guided walkthrough — renders only when ?tour=1 is present */}
      <DemoFunderTour />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px w-5 bg-vektrum-blue" />
            <p className="text-[11px] tracking-[0.12em] uppercase text-blue-300 font-semibold">Funder Dashboard</p>
          </div>
          <h1 className="font-display text-[2.25rem] font-bold tracking-[-0.04em] text-white leading-[1.05]">
            Welcome back, Sarah
          </h1>
        </div>
        <button
          onClick={() => setFundModal(true)}
          className="group inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-xl bg-vektrum-blue px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 transition-all hover:bg-vektrum-blue-hover hover:shadow-xl hover:shadow-vektrum-blue/40 hover:-translate-y-0.5"
        >
          Fund New Deal
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <FundDealModal open={fundModal} onConfirm={() => setFundModal(false)} onClose={() => setFundModal(false)} />

      {/* Weekly Intelligence Briefing */}
      <div
        className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden"
        
      >
        <div className="border-l-4 border-vektrum-blue px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Lightbulb size={15} className="text-blue-400" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-white">Weekly Intelligence Briefing</p>
          </div>
        </div>
        <ul className="px-5 py-4 space-y-3">
          {BRIEFING_INSIGHTS.map((insight, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px] text-white/55 leading-relaxed">
              <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-vektrum-blue flex-shrink-0" />
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
          <div
            className="rounded-2xl border border-vektrum-amber/30 bg-surface-2 shadow-card px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-vektrum-amber/50 cursor-pointer"
            
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/75">Action Queue</p>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
                <AlertCircle size={13} className="text-amber-400" aria-hidden="true" />
              </div>
            </div>
            <p className="font-display text-4xl font-bold tabular-nums leading-none text-amber-400">1</p>
          </div>
        </Link>
      </div>

      {/* Portfolio Overview */}
      <div
        id="portfolio-overview"
        className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden"
        
      >
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-[13px] font-semibold text-white">Portfolio Overview</p>
        </div>
        <div className="p-5 space-y-2">
          {MOCK_DEALS.map((deal) => {
            const pct = deal.total > 0 ? Math.round((deal.released / deal.total) * 100) : 0
            return (
              <Link key={deal.id} href={`/demo-live/deal/${deal.id}?from=funder`} className="flex items-center gap-4 hover:bg-white/[0.03] rounded-xl px-3 py-2 -mx-3 transition-colors">
                <span className="text-[13px] font-medium text-white/70 hover:text-white transition-colors flex-1 min-w-0 truncate">
                  {deal.title}
                </span>
                <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400 flex-shrink-0">
                  Active
                </span>
                <span className="text-[12px] text-white/50 tabular-nums flex-shrink-0">{formatCurrency(deal.total)}</span>
                <div className="w-24 h-1.5 rounded-full bg-white/[0.08] flex-shrink-0 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[12px] text-white/50 tabular-nums w-20 text-right flex-shrink-0">{pct}% released</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Action Queue */}
      <section id="action-queue">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-400">
          Action Required
        </h2>
        <div className="space-y-3">
          <div
            className="rounded-2xl border border-vektrum-amber/25 bg-surface-2 shadow-card p-4 flex items-center justify-between"
            
          >
            <div>
              <p className="font-semibold text-white">Riverside Mixed-Use Development</p>
              <p className="text-sm text-white/50 mt-0.5">MEP Rough-In — {formatCurrency(680_000)} · Ready for Review</p>
            </div>
            <Link
              href="/demo-live/deal/riverside?from=funder"
              className="group inline-flex items-center gap-1.5 bg-vektrum-blue text-white px-4 py-2 rounded-xl text-sm font-semibold ml-4 whitespace-nowrap hover:bg-vektrum-blue-hover transition-all hover:-translate-y-0.5"
            >
              Review Draw
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div
            className="rounded-2xl border border-red-500/20 bg-surface-2 shadow-card p-4 flex items-center justify-between"
            
          >
            <div>
              <p className="font-semibold text-white">Harbor Logistics Center</p>
              <p className="text-sm text-red-400 mt-0.5">HVAC Equipment Procurement — {formatCurrency(487_000)} · Dispute Active</p>
            </div>
            <Link
              href="/demo-live/deal/harbor-dispute?from=funder"
              className="group inline-flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold ml-4 whitespace-nowrap hover:bg-red-500 transition-all hover:-translate-y-0.5"
            >
              View Dispute
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Funded Deals */}
      <section id="funded-deals">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
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
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
          Featured Scenario
        </h2>
        <Link
          href="/demo-live/deal/harbor-dispute?from=funder"
          className="group block rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14]"
          
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08] flex-shrink-0">
              <Zap size={16} className="text-red-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-white group-hover:text-blue-300 transition-colors">
                Partial Dispute Scenario
              </p>
              <p className="mt-1 text-[13px] text-white/65 leading-relaxed">
                See how Vektrum handles a flagged line item while keeping 84% of project funds flowing.
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-blue-300">
                View Scenario
                <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </div>
          </div>
        </Link>
      </section>
    </div>
    </div>
  )
}

// ── Inline components ────────────────────────────────────────────────────────

function StatTile({ label, value, icon: Icon, href }: { label: string; value: string | number; icon: React.ElementType; href?: string }) {
  const inner = (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-5 transition-all duration-300 ${href ? 'hover:-translate-y-0.5 hover:border-white/[0.14] cursor-pointer' : ''}`}
      
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/75">{label}</p>
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
          <Icon size={13} className="text-blue-400" aria-hidden="true" />
        </div>
      </div>
      <p className="font-display text-4xl font-bold tabular-nums leading-none text-white">{value}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function MoneyTile({ label, amount, icon: Icon, href }: { label: string; amount: number; icon: React.ElementType; href?: string }) {
  const inner = (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-5 transition-all duration-300 ${href ? 'hover:-translate-y-0.5 hover:border-white/[0.14] cursor-pointer' : ''}`}
      
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/75">{label}</p>
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
          <Icon size={13} className="text-blue-400" aria-hidden="true" />
        </div>
      </div>
      <p className="font-display text-2xl font-bold tabular-nums leading-none text-white">{formatCurrency(amount)}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function DealCard({ deal }: { deal: typeof MOCK_DEALS[number] }) {
  const pct = deal.total > 0 ? Math.round((deal.released / deal.total) * 100) : 0
  return (
    <Link
      href={`/demo-live/deal/${deal.id}?from=funder`}
      className="group rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card p-5 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.14]"

    >
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
          {deal.status}
        </span>
        <span className="text-[11px] text-white/75">{deal.milestoneCount} milestones</span>
      </div>
      <p className="text-[14px] font-semibold text-white/80 group-hover:text-white transition-colors leading-snug">{deal.title}</p>
      <p className="mt-1 text-[12px] text-white/50">{deal.contractor} &middot; {deal.contractorCompany}</p>
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] text-white/50 tabular-nums">{pct}%</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-[12px]">
        <span className="text-white/50">Total: {formatCurrency(deal.total)}</span>
        <span className="text-emerald-400 font-medium">Released: {formatCurrency(deal.released)}</span>
      </div>
    </Link>
  )
}
