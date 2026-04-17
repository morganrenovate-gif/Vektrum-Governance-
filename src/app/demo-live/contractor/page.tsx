import Link from 'next/link'
import { HardHat, TrendingUp, DollarSign, CheckCircle2, Clock, ArrowRight, ArrowLeft } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_DEALS = [
  {
    slug: 'riverside',
    title: 'Riverside Mixed-Use Development',
    funder: 'Sarah Chen',
    funderCompany: 'Meridian Capital Partners',
    total: 2_400_000,
    pct: 20,
    milestonesCompleted: 3,
    milestonesTotal: 4,
  },
  {
    slug: 'harbor',
    title: 'Harbor Logistics Center',
    funder: 'Sarah Chen',
    funderCompany: 'Meridian Capital Partners',
    total: 9_100_000,
    pct: 38,
    milestonesCompleted: 3,
    milestonesTotal: 5,
  },
  {
    slug: 'westside',
    title: 'Westside Medical Office Campus',
    funder: 'Sarah Chen',
    funderCompany: 'Meridian Capital Partners',
    total: 4_750_000,
    pct: 20,
    milestonesCompleted: 1,
    milestonesTotal: 4,
  },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DemoContractorPage() {
  const totalDeals = MOCK_DEALS.length
  const totalFunded = MOCK_DEALS.reduce((s, d) => s + d.total, 0)
  const totalReleased = 4_890_000
  const pendingReview = 1

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
          You&apos;re viewing the Contractor dashboard as <strong>Marcus Webb</strong>. In the live app, this connects to your real deals and payments.
        </p>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-vektrum-text">
            Welcome back, Marcus
          </h1>
          <div className="mt-1.5 flex items-center gap-2">
            <p className="text-sm text-vektrum-muted">Contractor dashboard</p>
            <span className="inline-flex items-center rounded-full bg-vektrum-green-bg border border-vektrum-green-border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-vektrum-green">
              Contractor
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-lg bg-vektrum-blue px-4 py-2.5 text-[13px] font-medium text-white opacity-60 cursor-not-allowed"
          title="Demo mode — deal creation disabled"
        >
          <HardHat size={15} aria-hidden="true" />
          Create New Deal
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total Deals" value={totalDeals} href="#your-deals" />
        <MoneyTile label="Total Funded" amount={totalFunded} href="#your-deals" />
        <MoneyTile label="Total Released" amount={totalReleased} href="#your-deals" />
        <StatTile label="Pending Review" value={pendingReview} warning href="#draw-review" />
      </div>

      {/* Draw Review Status */}
      <section id="draw-review" className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden">
        <div className="border-l-4 border-vektrum-blue px-5 py-4 border-b border-vektrum-border-subtle">
          <p className="text-[13px] font-semibold text-vektrum-text">Draw Review Status</p>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-vektrum-text">MEP Rough-In &mdash; Riverside Mixed-Use Development</p>
              <p className="text-[12px] text-vektrum-muted mt-0.5">Status: Awaiting AI Review &middot; Amount: {formatCurrency(680_000)}</p>
            </div>
            <Link
              href="/demo-live/deal/riverside?from=contractor"
              className="inline-flex items-center gap-1 rounded-lg bg-vektrum-blue px-3 py-2 text-[12px] font-medium text-white hover:bg-vektrum-blue-hover transition-colors"
            >
              View Deal <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Your Deals */}
      <section id="your-deals">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-muted">
          Your Deals
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_DEALS.map((deal) => (
            <Link
              key={deal.slug}
              href={`/demo-live/deal/${deal.slug}?from=contractor`}
              className="group rounded-xl border border-vektrum-border bg-vektrum-surface p-5 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center rounded-full border border-vektrum-green-border bg-vektrum-green-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-vektrum-green">
                  Active
                </span>
                <span className="text-[11px] text-vektrum-faint">{deal.milestonesCompleted}/{deal.milestonesTotal} milestones</span>
              </div>
              <p className="text-[14px] font-semibold text-vektrum-text group-hover:text-vektrum-blue transition-colors">{deal.title}</p>
              <p className="mt-1 text-[12px] text-vektrum-muted">{deal.funder} &middot; {deal.funderCompany}</p>
              <p className="mt-0.5 text-[12px] text-vektrum-muted">Total: {formatCurrency(deal.total)}</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-vektrum-surface-alt overflow-hidden">
                  <div className="h-full rounded-full bg-vektrum-green" style={{ width: `${deal.pct}%` }} />
                </div>
                <span className="text-[11px] text-vektrum-faint tabular-nums">{deal.pct}%</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Inline components ────────────────────────────────────────────────────────

function StatTile({ label, value, warning = false, href }: { label: string; value: string | number; warning?: boolean; href?: string }) {
  const inner = (
    <div className={`rounded-lg border bg-vektrum-surface px-5 py-5 shadow-sm transition-all ${warning ? 'border-vektrum-amber-border' : 'border-vektrum-border'} ${href ? 'hover:border-vektrum-blue hover:shadow-md cursor-pointer' : ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">{label}</p>
      <p className={`mt-1.5 font-display text-4xl font-bold tabular-nums leading-none ${warning ? 'text-vektrum-amber' : 'text-vektrum-text'}`}>{value}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function MoneyTile({ label, amount, href }: { label: string; amount: number; href?: string }) {
  const inner = (
    <div className={`rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm transition-all ${href ? 'hover:border-vektrum-blue hover:shadow-md cursor-pointer' : ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">{label}</p>
      <p className="mt-1.5 font-display text-xl font-bold tabular-nums leading-none text-vektrum-text">{formatCurrency(amount)}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}
