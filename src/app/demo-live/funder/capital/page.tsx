import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'

// ── Data ─────────────────────────────────────────────────────────────────────

const PROJECTS = [
  { name: 'Riverside Mixed-Use', amount: 2_400_000, pct: 14.8, color: 'bg-vektrum-blue', textColor: 'text-vektrum-blue', released: 480_000, total: 2_400_000, status: 'active' },
  { name: 'Harbor Logistics', amount: 9_100_000, pct: 56.0, color: 'bg-vektrum-green', textColor: 'text-vektrum-green', released: 3_460_000, total: 9_100_000, status: 'active' },
  { name: 'Westside Medical', amount: 4_750_000, pct: 29.2, color: 'bg-vektrum-amber', textColor: 'text-vektrum-amber', released: 950_000, total: 4_750_000, status: 'active' },
]

const MILESTONE_STATUS = [
  { label: 'Released', count: 4, bg: 'bg-vektrum-green-bg', border: 'border-vektrum-green-border', text: 'text-vektrum-green' },
  { label: 'Approved (pending release)', count: 2, bg: 'bg-vektrum-blue-subtle', border: 'border-vektrum-blue-border', text: 'text-vektrum-blue' },
  { label: 'In Review / In Progress', count: 3, bg: 'bg-vektrum-amber-bg', border: 'border-vektrum-amber-border', text: 'text-vektrum-amber' },
  { label: 'Not Started', count: 4, bg: 'bg-vektrum-surface-alt', border: 'border-vektrum-border', text: 'text-vektrum-muted' },
]

const RECENT_RELEASES = [
  { date: 'Apr 1, 2026', project: 'Harbor Logistics', milestone: 'Structural Steel Erection', amount: 2_180_000 },
  { date: 'Mar 25, 2026', project: 'Harbor Logistics', milestone: 'Concrete Foundations', amount: 1_840_000 },
  { date: 'Mar 18, 2026', project: 'Westside Medical', milestone: 'Site Work & Utilities', amount: 475_000 },
  { date: 'Mar 10, 2026', project: 'Harbor Logistics', milestone: 'Site Preparation', amount: 320_000 },
  { date: 'Feb 23, 2026', project: 'Riverside Mixed-Use', milestone: 'Foundation & Site Prep', amount: 480_000 },
]

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
  const totalCommitted = 16_250_000
  const totalReleased = 4_890_000
  const heldPending = 11_360_000

  return (
    <div className="page-container section space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <Link
          href="/demo-live/funder"
          className="inline-flex items-center gap-1 text-[13px] text-vektrum-muted hover:text-vektrum-blue transition-colors w-fit"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Back to Dashboard
        </Link>
        <div className="mt-2">
          <h1 className="font-display text-2xl font-bold text-vektrum-text">Capital Overview</h1>
          <p className="mt-1 text-sm text-vektrum-muted">Sarah Chen &middot; Funder</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Total Capital Committed</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-vektrum-text">{fmt(totalCommitted)}</p>
        </div>
        <div id="released" className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Total Released to Date</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-vektrum-green">{fmt(totalReleased)}</p>
        </div>
        <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Held Pending Release</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-vektrum-amber">{fmt(heldPending)}</p>
        </div>
      </div>

      {/* Section 1: Allocation by Project — stacked CSS bar chart */}
      <section className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-vektrum-border-subtle">
          <p className="text-[13px] font-semibold text-vektrum-text">Allocation by Project</p>
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
                <span className="text-[12px] text-vektrum-text font-medium">{p.name}</span>
                <span className="text-[12px] text-vektrum-muted">{fmt(p.amount)} ({p.pct}%)</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: Release Velocity by Project */}
      <section className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-vektrum-border-subtle">
          <p className="text-[13px] font-semibold text-vektrum-text">Release Velocity by Project</p>
        </div>
        <div className="p-5 space-y-5">
          {PROJECTS.map((p) => {
            const releasedPct = Math.round((p.released / p.total) * 100)
            const pending = p.total - p.released
            return (
              <div key={p.name} className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-vektrum-text">{p.name}</p>
                  <span className="inline-flex items-center rounded-full border border-vektrum-green-border bg-vektrum-green-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-vektrum-green">
                    {p.status}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[12px] text-vektrum-muted">
                    <span>Released {fmtShort(p.released)} of {fmtShort(p.total)} total</span>
                    <span className="font-semibold tabular-nums">{releasedPct}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-vektrum-surface-alt overflow-hidden">
                    <div className={`h-full rounded-full ${p.color}`} style={{ width: `${releasedPct}%` }} />
                  </div>
                  <p className="text-[11px] text-vektrum-faint">
                    Released: {fmtShort(p.released)} | Pending: {fmtShort(pending)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Section 3: Milestone Status Distribution */}
      <section className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-vektrum-border-subtle">
          <p className="text-[13px] font-semibold text-vektrum-text">Milestone Status Distribution</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MILESTONE_STATUS.map((s) => (
              <div key={s.label} className={`rounded-lg border ${s.border} ${s.bg} px-4 py-3`}>
                <p className="font-display text-2xl font-bold tabular-nums text-vektrum-text">{s.count}</p>
                <p className={`mt-0.5 text-[11px] font-medium ${s.text}`}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Recent Releases table */}
      <section className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-vektrum-border-subtle">
          <p className="text-[13px] font-semibold text-vektrum-text">Recent Releases</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-vektrum-border-subtle">
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Date</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Project</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Milestone</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_RELEASES.map((r, i) => (
                <tr key={i} className="border-b border-vektrum-border-subtle last:border-0">
                  <td className="px-5 py-3 text-[13px] text-vektrum-muted whitespace-nowrap">{r.date}</td>
                  <td className="px-5 py-3 text-[13px] text-vektrum-text font-medium">{r.project}</td>
                  <td className="px-5 py-3 text-[13px] text-vektrum-muted">{r.milestone}</td>
                  <td className="px-5 py-3 text-[13px] text-vektrum-green font-semibold tabular-nums text-right">{fmt(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 5: Portfolio Health */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-vektrum-text mb-3">Portfolio Health</h2>
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-vektrum-surface-alt">
              <tr>
                <th className="text-left px-4 py-3 text-vektrum-muted font-medium">Project</th>
                <th className="text-left px-4 py-3 text-vektrum-muted font-medium">Risk Level</th>
                <th className="text-left px-4 py-3 text-vektrum-muted font-medium">AI Score Avg</th>
                <th className="text-left px-4 py-3 text-vektrum-muted font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Riverside Mixed-Use Development', href: '/demo-live/deal/riverside?from=funder', risk: 'Low', riskColor: 'text-green-600', score: '89/100', status: 'On Schedule' },
                { name: 'Harbor Logistics Center', href: '/demo-live/deal/harbor-dispute?from=funder', risk: 'Medium', riskColor: 'text-amber-600', score: '91/100', status: 'Dispute Active' },
                { name: 'Westside Medical Office Campus', href: '/demo-live/deal/westside?from=funder', risk: 'Low', riskColor: 'text-green-600', score: '74/100', status: 'On Schedule' },
              ].map(p => (
                <tr key={p.name} className="border-t hover:bg-vektrum-surface-alt/50">
                  <td className="px-4 py-3"><Link href={p.href} className="text-blue-600 hover:underline">{p.name}</Link></td>
                  <td className={`px-4 py-3 font-medium ${p.riskColor}`}>{p.risk}</td>
                  <td className="px-4 py-3 text-vektrum-text">{p.score}</td>
                  <td className="px-4 py-3 text-vektrum-muted">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-green-50 border-t border-green-100 text-sm text-green-700 font-medium">
            Overall portfolio health: Good — 2 of 3 projects on schedule · 1 dispute in resolution
          </div>
        </div>
      </section>
    </div>
  )
}
