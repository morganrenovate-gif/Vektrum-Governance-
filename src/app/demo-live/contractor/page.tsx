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
    milestonesCompleted: 4,
    milestonesTotal: 5,
  },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DemoContractorPage() {
  const totalDeals = MOCK_DEALS.length
  const totalFunded = MOCK_DEALS.reduce((s, d) => s + d.total, 0)
  const totalReleased = 3_940_000   // Riverside $480K + Harbor $3.46M
  const pendingReview = 1

  return (
    <div className="min-h-screen bg-surface-0">
    <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16 space-y-8">
      {/* Back link */}
      <Link
        href="/demo-live"
        className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to role selector
      </Link>

      {/* Demo info */}
      <div className="rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/10 px-5 py-4">
        <p className="text-[13px] text-vektrum-blue leading-relaxed">
          You&apos;re viewing the Contractor dashboard as <strong>Marcus Webb</strong>. In the live app, this connects to your real deals and payments.
        </p>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px w-5 bg-vektrum-blue" />
            <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">Contractor Dashboard</p>
          </div>
          <h1 className="font-display text-[2.25rem] font-bold tracking-[-0.04em] text-white leading-[1.05]">
            Welcome back, Marcus
          </h1>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 self-start rounded-xl bg-vektrum-blue/40 px-4 py-2.5 text-[13px] font-semibold text-white/50 cursor-not-allowed"
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
      <section
        id="draw-review"
        className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden"
        
      >
        <div className="border-l-4 border-vektrum-blue px-5 py-4 border-b border-white/[0.06]">
          <p className="text-[13px] font-semibold text-white">Draw Review Status</p>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium text-white/80">MEP Rough-In &mdash; Riverside Mixed-Use Development</p>
              <p className="text-[12px] text-white/45 mt-0.5">Status: Awaiting AI Review &middot; Amount: {formatCurrency(680_000)}</p>
            </div>
            <Link
              href="/demo-live/deal/riverside?from=contractor"
              className="group inline-flex items-center gap-1.5 rounded-xl bg-vektrum-blue px-3 py-2 text-[12px] font-semibold text-white whitespace-nowrap hover:bg-vektrum-blue-hover transition-all hover:-translate-y-0.5"
            >
              View Deal <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Your Deals */}
      <section id="your-deals">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
          Your Deals
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_DEALS.map((deal) => (
            <Link
              key={deal.slug}
              href={`/demo-live/deal/${deal.slug}?from=contractor`}
              className="group rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card p-5 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.14]"
              
            >
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                  Active
                </span>
                <span className="text-[11px] text-white/45">{deal.milestonesCompleted}/{deal.milestonesTotal} milestones</span>
              </div>
              <p className="text-[14px] font-semibold text-white/80 group-hover:text-white transition-colors leading-snug">{deal.title}</p>
              <p className="mt-1 text-[12px] text-white/55">{deal.funder} &middot; {deal.funderCompany}</p>
              <p className="mt-0.5 text-[12px] text-white/50">Total: {formatCurrency(deal.total)}</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${deal.pct}%` }} />
                </div>
                <span className="text-[11px] text-white/45 tabular-nums">{deal.pct}%</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
    </div>
  )
}

// ── Inline components ────────────────────────────────────────────────────────

function StatTile({ label, value, warning = false, href }: { label: string; value: string | number; warning?: boolean; href?: string }) {
  const inner = (
    <div
      className={`rounded-2xl border bg-surface-2 shadow-card px-5 py-5 transition-all duration-300 ${warning ? 'border-vektrum-amber/30' : 'border-white/[0.08]'} ${href ? 'hover:-translate-y-0.5 hover:border-white/[0.14] cursor-pointer' : ''}`}
      
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p>
      <p className={`mt-2 font-display text-4xl font-bold tabular-nums leading-none ${warning ? 'text-amber-400' : 'text-white'}`}>{value}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function MoneyTile({ label, amount, href }: { label: string; amount: number; href?: string }) {
  const inner = (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-5 transition-all duration-300 ${href ? 'hover:-translate-y-0.5 hover:border-white/[0.14] cursor-pointer' : ''}`}
      
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p>
      <p className="mt-2 font-display text-xl font-bold tabular-nums leading-none text-white">{formatCurrency(amount)}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}
