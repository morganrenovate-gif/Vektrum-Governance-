import Link from 'next/link'
import { HardHat, TrendingUp, DollarSign, CheckCircle2, Clock, ArrowRight } from 'lucide-react'

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
    funder: 'Sarah Chen',
  },
  {
    id: 'harbor',
    title: 'Harbor Logistics Center',
    total: 9_100_000,
    funded: 9_100_000,
    released: 3_460_000,
    status: 'active',
    milestoneCount: 5,
    funder: 'Sarah Chen',
  },
  {
    id: 'westside',
    title: 'Westside Medical Office Campus',
    total: 4_750_000,
    funded: 4_750_000,
    released: 950_000,
    status: 'active',
    milestoneCount: 4,
    funder: 'Sarah Chen',
  },
]

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DemoContractorPage() {
  const totalDeals = MOCK_DEALS.length
  const totalFunded = MOCK_DEALS.reduce((s, d) => s + d.funded, 0)
  const totalReleased = MOCK_DEALS.reduce((s, d) => s + d.released, 0)
  const pendingReview = 1

  return (
    <div className="page-container section space-y-8">
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
        <StatTile label="Total Deals" value={totalDeals} />
        <MoneyTile label="Total Funded" amount={totalFunded} />
        <MoneyTile label="Total Released" amount={totalReleased} />
        <StatTile label="Pending Review" value={pendingReview} warning />
      </div>

      {/* Draw Review Status */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden">
        <div className="border-l-4 border-vektrum-blue px-5 py-4 border-b border-vektrum-border-subtle">
          <p className="text-[13px] font-semibold text-vektrum-text">Draw Review Status</p>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-vektrum-text">Riverside Mixed-Use Development</p>
              <p className="text-[12px] text-vektrum-muted mt-0.5">MEP Rough-In &mdash; {fmt(680_000)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2.5 py-0.5 text-[11px] font-medium text-vektrum-amber">
                <Clock size={11} aria-hidden="true" />
                Ready for review
              </span>
              <Link
                href="/demo-live/deal/riverside"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-vektrum-blue hover:text-vektrum-blue-hover transition-colors"
              >
                View <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* All Deals */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-muted">
          Your Deals
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_DEALS.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Inline components ────────────────────────────────────────────────────────

function StatTile({ label, value, warning = false }: { label: string; value: string | number; warning?: boolean }) {
  return (
    <div className={`rounded-lg border bg-vektrum-surface px-5 py-5 shadow-sm ${warning ? 'border-vektrum-amber-border' : 'border-vektrum-border'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">{label}</p>
      <p className={`mt-1.5 font-display text-4xl font-bold tabular-nums leading-none ${warning ? 'text-vektrum-amber' : 'text-vektrum-text'}`}>{value}</p>
    </div>
  )
}

function MoneyTile({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">{label}</p>
      <p className="mt-1.5 font-display text-xl font-bold tabular-nums leading-none text-vektrum-text">{fmt(amount)}</p>
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
      <p className="mt-1 text-[12px] text-vektrum-muted">Funder: {deal.funder} &middot; Meridian Capital Partners</p>
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-vektrum-surface-alt overflow-hidden">
          <div className="h-full rounded-full bg-vektrum-green" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] text-vektrum-faint tabular-nums">{pct}%</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-[12px]">
        <span className="text-vektrum-muted">Funded: {fmt(deal.funded)}</span>
        <span className="text-vektrum-green font-medium">Released: {fmt(deal.released)}</span>
      </div>
    </Link>
  )
}
