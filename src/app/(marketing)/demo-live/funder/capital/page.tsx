import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { riverside, harbor, westside, type DemoDeal } from '@/lib/demo-data'

// ── Data ─────────────────────────────────────────────────────────────────────
//
// All financial figures (totals, releases, milestone counts, recent releases)
// are derived from the canonical demo data in src/lib/demo-data/index.ts.
//
// Previously this file kept its own hardcoded copies — a stale Harbor
// `released: 3_460_000` / `pct: 56.0`, an entry for "Structural Steel
// Erection" in RECENT_RELEASES even though canonical state has that milestone
// as `approved`, and milestone-status counts that were off by one. Deriving
// from canonical exports prevents this kind of drift.
//
// Only colour / label / sort-position metadata lives in this file.

interface DealDisplay {
  display:   string
  color:     string
  textColor: string
}

const DEAL_DISPLAY: Record<string, DealDisplay> = {
  riverside: { display: 'Riverside Mixed-Use', color: 'bg-vektrum-blue',  textColor: 'text-blue-300' },
  harbor:    { display: 'Harbor Logistics',     color: 'bg-vektrum-green', textColor: 'text-emerald-400' },
  westside:  { display: 'Westside Medical',     color: 'bg-vektrum-amber', textColor: 'text-amber-400' },
}

const CANONICAL_DEALS: ReadonlyArray<{ id: string; deal: DemoDeal }> = [
  { id: 'riverside', deal: riverside },
  { id: 'harbor',    deal: harbor },
  { id: 'westside',  deal: westside },
]

// ── Summary tile values ─────────────────────────────────────────────────────

const totalCommitted = CANONICAL_DEALS.reduce((sum, { deal }) => sum + deal.total,    0)
const totalReleased  = CANONICAL_DEALS.reduce((sum, { deal }) => sum + deal.released, 0)
const heldPending    = totalCommitted - totalReleased

// ── Section 1 / 2: Allocation + Velocity ────────────────────────────────────

const PROJECTS = CANONICAL_DEALS.map(({ id, deal }) => {
  const display = DEAL_DISPLAY[id]
  // Each deal's share of total committed capital (drives the stacked bar chart).
  // Rounded to one decimal place, matching the previous visual.
  const pct = totalCommitted > 0
    ? Math.round((deal.total / totalCommitted) * 1000) / 10
    : 0
  return {
    name:      display.display,
    color:     display.color,
    textColor: display.textColor,
    amount:    deal.total,
    pct,
    released:  deal.released,
    total:     deal.total,
    status:    'active',
  }
})

// ── Section 3: Milestone Status Distribution ────────────────────────────────

const allMilestones = CANONICAL_DEALS.flatMap(({ deal }) => deal.milestones)

const MILESTONE_STATUS = [
  {
    label: 'Released',
    count: allMilestones.filter((m) => m.status === 'released').length,
    bg: 'bg-emerald-500/[0.08]', border: 'border-emerald-500/20', text: 'text-emerald-400',
  },
  {
    label: 'Approved (pending release)',
    count: allMilestones.filter((m) => m.status === 'approved').length,
    bg: 'bg-vektrum-blue/10', border: 'border-vektrum-blue/30', text: 'text-blue-300',
  },
  {
    label: 'In Review / In Progress',
    count: allMilestones.filter((m) => m.status === 'ready_for_review' || m.status === 'in_progress').length,
    bg: 'bg-amber-500/[0.08]', border: 'border-amber-500/20', text: 'text-amber-400',
  },
  {
    label: 'Not Started',
    count: allMilestones.filter((m) => m.status === 'not_started').length,
    bg: 'bg-surface-3', border: 'border-white/[0.08]', text: 'text-white/55',
  },
]

// ── Section 4: Recent Releases ──────────────────────────────────────────────
//
// Built strictly from milestones with status === 'released'. A milestone like
// Harbor's Structural Steel Erection — which starts the demo as `approved`
// (not yet released) — must NOT appear here.

const RECENT_RELEASES = CANONICAL_DEALS.flatMap(({ id, deal }) => {
  const display = DEAL_DISPLAY[id]
  return deal.milestones
    .filter((m) => m.status === 'released')
    .map((m) => ({
      date:      m.releasedAt ?? '',
      project:   display.display,
      milestone: m.name,
      amount:    m.amount,
    }))
})

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CapitalPage() {
  return (
    <div className="min-h-screen bg-surface-0">
    <div className="page-container section space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <Link
          href="/demo-live/funder"
          className="inline-flex items-center gap-1 text-[13px] text-white/70 hover:text-blue-300 transition-colors w-fit"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Back to Dashboard
        </Link>
        <div className="mt-2">
          <h1 className="font-display text-2xl font-bold text-white">Capital Overview</h1>
          <p className="mt-1 text-sm text-white/55">Sarah Chen &middot; Funder</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/[0.08] bg-surface-2 px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Total Capital Committed</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-white">{fmt(totalCommitted)}</p>
        </div>
        <div id="released" className="rounded-lg border border-white/[0.08] bg-surface-2 px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Total Released to Date</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-emerald-400">{fmt(totalReleased)}</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-surface-2 px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Held Pending Release</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-amber-400">{fmt(heldPending)}</p>
        </div>
      </div>

      {/* Section 1: Allocation by Project — stacked CSS bar chart */}
      <section className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <p className="text-[13px] font-semibold text-white">Allocation by Project</p>
        </div>
        <div className="p-5 space-y-4">
          {/* Stacked bar */}
          <div className="flex h-8 w-full rounded-lg overflow-hidden">
            {PROJECTS.map((p) => (
              <div
                key={p.name}
                className={`${p.color} flex items-center justify-center text-[11px] font-semibold text-white`}
                style={{ width: `${p.pct}%` }}
                title={`${p.name}: ${fmt(p.amount)} (${p.pct}%)`}
              >
                {p.pct >= 15 ? `${p.pct}%` : ''}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {PROJECTS.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-sm ${p.color} flex-shrink-0`} />
                <span className="text-[12px] text-white font-medium">{p.name}</span>
                <span className="text-[12px] text-white/55">{fmt(p.amount)} ({p.pct}%)</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: Release Velocity by Project */}
      <section className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <p className="text-[13px] font-semibold text-white">Release Velocity by Project</p>
        </div>
        <div className="p-5 space-y-5">
          {PROJECTS.map((p) => {
            const releasedPct = Math.round((p.released / p.total) * 100)
            const pending = p.total - p.released
            return (
              <div key={p.name} className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-white">{p.name}</p>
                  <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                    {p.status}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[12px] text-white/55">
                    <span>Released {fmtShort(p.released)} of {fmtShort(p.total)} total</span>
                    <span className="font-semibold tabular-nums">{releasedPct}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-surface-3 overflow-hidden">
                    <div className={`h-full rounded-full ${p.color}`} style={{ width: `${releasedPct}%` }} />
                  </div>
                  <p className="text-[11px] text-white/70">
                    Released: {fmtShort(p.released)} | Pending: {fmtShort(pending)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Section 3: Milestone Status Distribution */}
      <section className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <p className="text-[13px] font-semibold text-white">Milestone Status Distribution</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MILESTONE_STATUS.map((s) => (
              <div key={s.label} className={`rounded-lg border ${s.border} ${s.bg} px-4 py-3`}>
                <p className="font-display text-2xl font-bold tabular-nums text-white">{s.count}</p>
                <p className={`mt-0.5 text-[11px] font-medium ${s.text}`}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Recent Releases table */}
      <section className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <p className="text-[13px] font-semibold text-white">Recent Releases</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/70">Date</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/70">Project</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/70">Milestone</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/70 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_RELEASES.map((r, i) => (
                <tr key={i} className="border-b border-white/[0.05] last:border-0">
                  <td className="px-5 py-3 text-[13px] text-white/55 whitespace-nowrap">{r.date}</td>
                  <td className="px-5 py-3 text-[13px] text-white font-medium">{r.project}</td>
                  <td className="px-5 py-3 text-[13px] text-white/55">{r.milestone}</td>
                  <td className="px-5 py-3 text-[13px] text-emerald-400 font-semibold tabular-nums text-right">{fmt(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 5: Portfolio Health */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">Portfolio Health</h2>
        <div className="border border-white/[0.08] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-3">
              <tr>
                <th className="text-left px-4 py-3 text-white/55 font-medium">Project</th>
                <th className="text-left px-4 py-3 text-white/55 font-medium">Risk Level</th>
                <th className="text-left px-4 py-3 text-white/55 font-medium">AI Score Avg</th>
                <th className="text-left px-4 py-3 text-white/55 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Riverside Mixed-Use Development', href: '/demo-live/deal/riverside?from=funder', risk: 'Low', riskColor: 'text-emerald-400', score: '89/100', status: 'On Schedule' },
                { name: 'Harbor Logistics Center', href: '/demo-live/deal/harbor-dispute?from=funder', risk: 'Medium', riskColor: 'text-amber-400', score: '91/100', status: 'Dispute Active' },
                { name: 'Westside Medical Office Campus', href: '/demo-live/deal/westside?from=funder', risk: 'Low', riskColor: 'text-emerald-400', score: '74/100', status: 'On Schedule' },
              ].map(p => (
                <tr key={p.name} className="border-t border-white/[0.06] hover:bg-white/[0.03]">
                  <td className="px-4 py-3"><Link href={p.href} className="text-blue-300 hover:text-blue-200 hover:underline">{p.name}</Link></td>
                  <td className={`px-4 py-3 font-medium ${p.riskColor}`}>{p.risk}</td>
                  <td className="px-4 py-3 text-white">{p.score}</td>
                  <td className="px-4 py-3 text-white/55">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-emerald-500/[0.08] border-t border-emerald-500/20 text-sm text-emerald-400 font-medium">
            Overall portfolio health: Good — 2 of 3 projects on schedule · 1 dispute in resolution
          </div>
        </div>
      </section>
    </div>
    </div>
  )
}
