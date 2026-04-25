import Link from 'next/link'
import {
  ArrowRight,
  Shield,
  CheckCircle2,
  X,
  FileText,
  Lock,
  BarChart3,
  Building2,
  Scale,
} from 'lucide-react'

export const metadata = {
  title: 'Fee Structure — Vektrum',
  description:
    'A governance fee per verified disbursement. 1% when funds transfer. $0 until they do. Contractors are always free.',
}

// ─── Clarity Cell ─────────────────────────────────────────────────────────────
// Used in the 4-cell "who / when / how / minimum" strip beneath the hero.

function ClarityCell({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="flex flex-col gap-1 py-7 px-6 sm:px-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">
        {label}
      </p>
      <p className="text-[17px] font-bold tracking-[-0.02em] text-white">{value}</p>
      <p className="text-[11px] text-white/75 leading-snug">{sub}</p>
    </div>
  )
}

// ─── Engagement Card ──────────────────────────────────────────────────────────
// Replaces "tier card" — rate dominant, term-sheet feel.

interface EngagementCardProps {
  name: string
  /** Who this model is for — one line */
  descriptor: string
  /** Primary rate display, e.g. "1%" */
  ratePercent: string
  /** Concrete dollar example, e.g. "$500,000 release → $5,000 governance fee" */
  rateExample: string
  retainer: string
  retainerNote?: string
  setup: string
  features: string[]
  highlight?: boolean
  badge?: string
  cta?: string
  ctaHref?: string
}

function EngagementCard({
  name,
  descriptor,
  ratePercent,
  rateExample,
  retainer,
  retainerNote,
  setup,
  features,
  highlight = false,
  badge,
  cta = 'Get started',
  ctaHref = '/auth/signup',
}: EngagementCardProps) {
  return (
    <div
      className={[
        'relative flex flex-col rounded-2xl border p-7 transition-all',
        highlight
          ? 'border-vektrum-blue/40 bg-surface-2 shadow-2xl shadow-vektrum-blue/10 ring-1 ring-vektrum-blue/15'
          : 'border-white/[0.08] bg-surface-2 hover:border-white/[0.14]',
      ].join(' ')}
    >
      {badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-vektrum-blue px-3.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm shadow-vektrum-blue/30">
            {badge}
          </span>
        </div>
      )}

      {/* Rate — the number that dominates */}
      <div className="mb-6 pb-6 border-b border-white/[0.08]">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75 mb-4">
          {name}
        </p>
        <div className="flex items-baseline gap-2">
          <span
            className={[
              'font-display text-[54px] font-bold tracking-[-0.04em] leading-none',
              highlight ? 'text-vektrum-blue' : 'text-white',
            ].join(' ')}
          >
            {ratePercent}
          </span>
          <span className="text-[14px] text-white/75 pb-1 font-medium">
            per release
          </span>
        </div>
        <p className="mt-3 text-[12px] font-semibold text-emerald-400">
          {rateExample}
        </p>
        <p className="mt-1.5 text-[11px] text-white/50 leading-snug">{descriptor}</p>
      </div>

      {/* Structure — retainer + onboarding */}
      <div className="mb-6 space-y-3.5">
        <div className="flex items-start justify-between gap-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/75 shrink-0 mt-0.5">
            Retainer
          </span>
          <div className="text-right">
            <p className="text-[12px] font-semibold text-white/75">{retainer}</p>
            {retainerNote && (
              <p className="text-[11px] text-white/75 mt-0.5 leading-snug">
                {retainerNote}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-start justify-between gap-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/75 shrink-0 mt-0.5">
            Onboarding
          </span>
          <p className="text-[12px] font-semibold text-white/75 text-right">
            {setup}
          </p>
        </div>
      </div>

      {/* Features */}
      <ul className="mb-8 space-y-2.5 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckCircle2
              size={13}
              className="mt-[1px] flex-shrink-0 text-emerald-400/80"
            />
            <span className="text-[12px] leading-relaxed text-white/65">{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className={[
          'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition-all',
          highlight
            ? 'bg-vektrum-blue text-white shadow-lg shadow-vektrum-blue/25 hover:bg-vektrum-blue-hover'
            : 'border border-white/[0.14] bg-transparent text-white/65 hover:bg-white/[0.05] hover:border-white/[0.22] hover:text-white',
        ].join(' ')}
      >
        {cta}
        <ArrowRight size={13} />
      </Link>
    </div>
  )
}

// ─── Constant Row ──────────────────────────────────────────────────────────────

function ConstantRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] py-3.5 last:border-0">
      <span className="text-[13px] text-white/75">{label}</span>
      <span className="text-[13px] font-semibold text-white tabular-nums">
        {value}
      </span>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="flex flex-col">

      {/* ─── 1. Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0D1B2A] pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(26,58,150,1) 1px, transparent 1px), linear-gradient(90deg, rgba(26,58,150,1) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-vektrum-blue-subtle/30 to-transparent rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          {/* Eyebrow */}
          <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/75 mb-8">
            <span className="inline-block h-px w-6 bg-vektrum-blue/60" />
            Governance Fee
            <span className="inline-block h-px w-6 bg-vektrum-blue/60" />
          </p>

          {/* Primary statement */}
          <h1 className="font-display text-4xl font-bold tracking-[-0.04em] text-white sm:text-[52px] sm:leading-[1.06] text-balance">
            Priced on disbursement.
            <br />
            <span className="text-white/75">Earned on verified release.</span>
          </h1>

          {/* What it actually is */}
          <p className="mt-6 mx-auto max-w-xl text-[16px] leading-relaxed text-white/65">
            Vektrum charges a governance fee only when a milestone transfer
            completes — 10 conditions verified simultaneously, release
            authorized and funds disbursed to the contractor. We earn when funds move.
          </p>

          {/* The anchor sentence */}
          <div className="mt-8 inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] px-7 py-4">
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-emerald-300">
              $500,000 release → $5,000 governance fee
            </span>
            <span className="hidden sm:block text-white/60">·</span>
            <span className="text-[13px] text-white/75">
              Charged after transfer. Never before.
            </span>
          </div>
        </div>
      </section>

      {/* ─── 2. Clarity Strip ─────────────────────────────────────────────────── */}
      {/* Four cells that answer every obvious question in one glance. */}
      <section className="bg-surface-2 border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/[0.06] divide-y sm:divide-y-0">
            <ClarityCell
              label="Who pays"
              value="Funder"
              sub="Contractors are always free"
            />
            <ClarityCell
              label="When"
              value="After transfer"
              sub="Never before funds move"
            />
            <ClarityCell
              label="How"
              value="% of release"
              sub="1% standalone · lower with retainer"
            />
            <ClarityCell
              label="Minimum fee"
              value="$50"
              sub="Per verified disbursement"
            />
          </div>
        </div>
      </section>

      {/* ─── 3. What You're Paying For ────────────────────────────────────────── */}
      {/* Reframes: this isn't software — it's controlled disbursement infrastructure. */}
      <section className="bg-surface-0 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75 mb-3">
              What this fee covers
            </p>
            <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl">
              Not software licensing.{' '}
              <span className="text-white/60">
                Controlled disbursement infrastructure.
              </span>
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: Lock,
                title: 'Controlled disbursement',
                body: 'Funds only transfer after 10 server-side conditions are satisfied simultaneously. No manual override. Every release is a uniquely identified, server-verified event.',
              },
              {
                icon: FileText,
                title: 'Append-only audit infrastructure',
                body: 'Every approval, release, and status change is logged server-side with a UTC timestamp and actor identity. Records are append-only — the application never modifies or removes a logged entry.',
              },
              {
                icon: Shield,
                title: 'Milestone-level dispute isolation',
                body: 'A disputed draw locks one milestone. The remaining balance continues to flow on schedule. One contractor disagreement does not freeze your portfolio.',
              },
            ].map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-2xl border border-white/[0.08] bg-surface-2 p-7"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-blue/10 mb-5">
                  <pillar.icon size={19} className="text-vektrum-blue" />
                </div>
                <h3 className="text-[14px] font-bold text-white mb-3">
                  {pillar.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-white/50">
                  {pillar.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4. Value Anchor ──────────────────────────────────────────────────── */}
      {/* The section that makes 1% feel like the obvious choice. */}
      <section className="bg-surface-0 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">

            {/* Left: risk cost table */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75 mb-3">
                The cost of getting it wrong
              </p>
              <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl mb-8 text-balance">
                1% of what moves.
                <br />
                A fraction of what bad releases cost.
              </h2>

              <div className="rounded-2xl border border-white/[0.08] bg-surface-2 overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-2 border-b border-white/[0.08] px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/65">
                    Risk scenario
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/65 text-right">
                    Typical resolution cost
                  </span>
                </div>
                {[
                  {
                    risk: 'Single draw dispute',
                    cost: '$35,000 – $150,000',
                  },
                  {
                    risk: 'Duplicate payment recovery',
                    cost: '$15,000 – $60,000',
                  },
                  {
                    risk: 'Missing lien waiver / release',
                    cost: '$20,000 – $100,000',
                  },
                  {
                    risk: 'Fraudulent draw (direct loss)',
                    cost: '$50,000 – $500,000+',
                  },
                ].map((row, i) => (
                  <div
                    key={row.risk}
                    className={[
                      'grid grid-cols-2 px-5 py-3.5 border-b border-white/[0.06] last:border-0',
                      i % 2 === 1 ? 'bg-surface-3/40' : '',
                    ].join(' ')}
                  >
                    <span className="text-[13px] text-white/60">{row.risk}</span>
                    <span className="text-[13px] font-semibold text-red-400/80 text-right tabular-nums">
                      {row.cost}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-white/65 leading-relaxed">
                Estimates based on published construction litigation data and industry
                loss reporting. Actual costs vary by jurisdiction, deal size, and
                complexity.
              </p>
            </div>

            {/* Right: the comparison math */}
            <div className="rounded-2xl border border-vektrum-blue/25 bg-vektrum-blue/[0.07] p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-vektrum-blue/70 mb-6">
                In context
              </p>

              <div className="space-y-6">
                <div>
                  <p className="text-[13px] text-white/75 mb-1">
                    $5,000,000 construction deal · 5 milestones
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-[38px] font-bold tracking-[-0.04em] text-white leading-none">
                      $50,000
                    </span>
                    <span className="text-[14px] text-white/70">total fee</span>
                  </div>
                  <p className="mt-1.5 text-[12px] text-white/70">
                    1% × $5,000,000 disbursed across all milestones
                  </p>
                </div>

                <div className="border-t border-white/[0.08] pt-6">
                  <p className="text-[13px] font-semibold text-white/75 mb-4">
                    One avoided dispute on this deal:
                  </p>
                  <div className="space-y-2.5">
                    {[
                      'Avoids an estimated $35K–$150K in resolution costs',
                      'Avoids 60–180 days of potential schedule impact',
                      'Preserves the lender–contractor relationship',
                      'Keeps the remaining milestones on track',
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2.5">
                        <CheckCircle2
                          size={13}
                          className="mt-0.5 flex-shrink-0 text-emerald-400"
                        />
                        <span className="text-[12px] text-white/55 leading-snug">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
                  <p className="text-[12px] font-semibold text-emerald-400 leading-relaxed">
                    One avoided dispute on a $5M deal pays for Vektrum governance
                    one to three times over.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── 5. Fee Structure ─────────────────────────────────────────────────── */}
      {/* Three engagement models — not "plans", not "tiers". */}
      <section className="bg-[#0B1625] py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75 mb-3">
              Fee structure
            </p>
            <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl">
              Three engagement models.
              <span className="text-white/60"> One underlying structure.</span>
            </h2>
            <p className="mt-4 mx-auto max-w-lg text-[14px] text-white/55 leading-relaxed">
              Every model uses the same logic: a governance fee charged per verified
              disbursement. Institutional and Enterprise models add an annual retainer
              in exchange for a lower per-release rate.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <EngagementCard
              name="Standalone"
              descriptor="Stripe Connect rail — for direct lenders · Independent projects · Developers · Private lenders"
              ratePercent="1%"
              rateExample="$500,000 release → $5,000 governance fee"
              retainer="None"
              retainerNote="Pay only when a milestone closes"
              setup="Self-service — no setup fee"
              features={[
                '10-condition server-side release gate',
                'Milestone-level dispute isolation',
                'Append-only, timestamped audit trail',
                'Stripe Connect payouts to contractor',
                '$250 refundable commitment deposit',
              ]}
            />

            <EngagementCard
              name="Institutional Portfolio"
              descriptor="External rail — for lenders with existing payment infrastructure · Banks · Private credit funds · Regional lenders"
              ratePercent="0.70%"
              rateExample="$500,000 release → $3,500 governance fee"
              retainer="7.5 bps of ACV / year"
              retainerNote="Floor $5,000 · Cap $50,000 · Credited against per-release fees"
              setup="$5,000 – $15,000 one-time"
              highlight
              badge="Most Common"
              features={[
                'Everything in Standalone',
                'Portfolio risk dashboard + release readiness scores',
                'Annual retainer credited against per-release fees throughout the year',
                'Annual retainer based on Active Construction Volume',
                'Priority onboarding and support',
                'Rate reverts to 1% without active retainer',
              ]}
            />

            <EngagementCard
              name="Enterprise / Platform"
              descriptor="External rail — for lenders with existing payment infrastructure · Large lenders · Construction owners · Platform integrators"
              ratePercent="0.65%"
              rateExample="$500,000 release → $3,250 governance fee"
              retainer="50 – 100 bps of ACV / year"
              retainerNote="Floor $25,000 — negotiated annually"
              setup="$15,000 – $50,000 — integration included"
              cta="Contact us"
              ctaHref="mailto:operations@vektrum.io"
              features={[
                'Everything in Institutional',
                'LOS / core banking API integration (included)',
                'Dedicated customer success manager',
                '99.9% uptime SLA',
                'Audit export for regulatory compliance',
                'Custom MSA and addendum available',
              ]}
            />
          </div>
        </div>
      </section>

      {/* ─── 6. The Math ──────────────────────────────────────────────────────── */}
      {/* Real numbers at real scales. No ambiguity. */}
      <section className="bg-surface-2 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75 mb-3">
              The math
            </p>
            <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl">
              What it looks like at your scale.
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Example 1 — Standalone */}
            <div className="rounded-2xl border border-white/[0.08] bg-surface-3 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.08]">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/75">
                  Standalone
                </p>
                <p className="text-[14px] font-semibold text-white mt-1">
                  $750K project · 3 milestones
                </p>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {[
                  { label: 'Foundation draw', value: '$150,000 → $1,500' },
                  { label: 'Framing draw', value: '$300,000 → $3,000' },
                  { label: 'Certificate of Occupancy', value: '$300,000 → $3,000' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-6 py-3">
                    <span className="text-[12px] text-white/75">{row.label}</span>
                    <span className="text-[12px] font-semibold text-white tabular-nums">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-6 py-4 bg-surface-2">
                  <span className="text-[13px] font-semibold text-white">Total governance fee</span>
                  <span className="text-[18px] font-bold text-emerald-400 tabular-nums">$7,500</span>
                </div>
              </div>
              <div className="px-6 py-3 border-t border-white/[0.06]">
                <p className="text-[11px] text-white/65">No setup fee. No monthly charge. $250 deposit refunded at close.</p>
              </div>
            </div>

            {/* Example 2 — Institutional */}
            <div className="rounded-2xl border border-vektrum-blue/30 bg-surface-3 overflow-hidden">
              <div className="px-6 py-4 border-b border-vektrum-blue/20 bg-vektrum-blue/[0.08]">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-vektrum-blue/70">
                  Institutional Portfolio
                </p>
                <p className="text-[14px] font-semibold text-white mt-1">
                  $30M ACV · 24 releases / year
                </p>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {[
                  { label: 'Annual governance retainer', note: '7.5 bps × $30M', value: '$22,500 / yr' },
                  { label: 'Per-release fees', note: '0.70% × 24 × avg $250K', value: '$42,000 / yr' },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between px-6 py-3.5">
                    <div>
                      <p className="text-[12px] text-white/55">{row.label}</p>
                      <p className="text-[11px] text-white/75 mt-0.5">{row.note}</p>
                    </div>
                    <span className="text-[13px] font-semibold text-white tabular-nums shrink-0 ml-4">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-6 py-4 bg-surface-2">
                  <span className="text-[13px] font-semibold text-white">Total annual cost</span>
                  <span className="text-[18px] font-bold text-emerald-400 tabular-nums">$64,500 / yr</span>
                </div>
              </div>
              <div className="px-6 py-3 border-t border-white/[0.06]">
                <p className="text-[11px] text-white/65">Annual retainer credited against per-release fees throughout the year.</p>
              </div>
            </div>

            {/* Example 3 — Enterprise */}
            <div className="rounded-2xl border border-white/[0.08] bg-surface-3 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.08]">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/75">
                  Enterprise
                </p>
                <p className="text-[14px] font-semibold text-white mt-1">
                  $80M ACV · 40 releases / year
                </p>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {[
                  { label: 'Annual governance retainer', note: '65 bps × $80M', value: '$52,000 / yr' },
                  { label: 'Per-release fees', note: '0.65% × 40 × avg $500K', value: '$130,000 / yr' },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between px-6 py-3.5">
                    <div>
                      <p className="text-[12px] text-white/55">{row.label}</p>
                      <p className="text-[11px] text-white/75 mt-0.5">{row.note}</p>
                    </div>
                    <span className="text-[13px] font-semibold text-white tabular-nums shrink-0 ml-4">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-6 py-4 bg-surface-2">
                  <span className="text-[13px] font-semibold text-white">Total annual cost</span>
                  <span className="text-[18px] font-bold text-emerald-400 tabular-nums">$182,000 / yr</span>
                </div>
              </div>
              <div className="px-6 py-3 border-t border-white/[0.06]">
                <p className="text-[11px] text-white/65">Includes API integration, dedicated CSM, and custom MSA. Rate negotiated annually.</p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-[12px] text-white/65">
            Traditional construction platform licensing at comparable institutional scale
            typically runs $100,000–$300,000 / yr. Vektrum charges only when funds move.
          </p>
        </div>
      </section>

      {/* ─── 7. Without vs. With ──────────────────────────────────────────────── */}
      {/* The decision matrix for institutional buyers justifying internally. */}
      <section className="bg-surface-0 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75 mb-3">
              What changes
            </p>
            <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl">
              When governance is systematic.
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Manual process */}
            <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.04] p-7">
              <div className="flex items-center gap-2 mb-7">
                <div className="h-px flex-1 bg-red-500/15" />
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-400/50">
                  Manual draw management
                </p>
                <div className="h-px flex-1 bg-red-500/15" />
              </div>
              <ul className="space-y-5">
                {[
                  {
                    label: 'Draw approval',
                    desc: 'Email threads and PDFs — no timestamp, no actor log, no trail',
                  },
                  {
                    label: 'Dispute handling',
                    desc: 'Entire deal funding freezes until the dispute is resolved',
                  },
                  {
                    label: 'Duplicate releases',
                    desc: 'No programmatic protection — manual coordination required',
                  },
                  {
                    label: 'Audit trail',
                    desc: 'Spreadsheets and email archives — inconsistent, modifiable, incomplete',
                  },
                  {
                    label: 'Fund flow',
                    desc: 'Funder holds capital and initiates each wire transfer manually',
                  },
                  {
                    label: 'Compliance export',
                    desc: 'Manual compilation on request — time-consuming, error-prone',
                  },
                ].map((item) => (
                  <li key={item.label} className="flex items-start gap-3">
                    <X
                      size={14}
                      className="mt-0.5 text-red-400/70 flex-shrink-0"
                    />
                    <div>
                      <p className="text-[13px] font-semibold text-white/75">
                        {item.label}
                      </p>
                      <p className="text-[12px] text-white/75 mt-0.5 leading-snug">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* With Vektrum */}
            <div className="rounded-2xl border border-vektrum-blue/20 bg-vektrum-blue/[0.05] p-7">
              <div className="flex items-center gap-2 mb-7">
                <div className="h-px flex-1 bg-vektrum-blue/20" />
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-vektrum-blue/60">
                  With Vektrum governance
                </p>
                <div className="h-px flex-1 bg-vektrum-blue/20" />
              </div>
              <ul className="space-y-5">
                {[
                  {
                    label: '10-condition server-side gate',
                    desc: 'Every condition verified simultaneously. Timestamped audit entry on every decision.',
                  },
                  {
                    label: 'Milestone-level isolation',
                    desc: 'Disputed milestone locked. All others continue to release on schedule.',
                  },
                  {
                    label: 'Idempotent release logic',
                    desc: 'Duplicate releases prevented at the database level — idempotent by design.',
                  },
                  {
                    label: 'Append-only audit log',
                    desc: 'Every action server-logged, actor-attributed, and UTC-timestamped. No application-level deletion.',
                  },
                  {
                    label: 'Stripe custody + governance layer',
                    desc: 'Stripe holds capital. Vektrum governs release. Neither entity touches both.',
                  },
                  {
                    label: 'Audit log export',
                    desc: 'Full log available for export — structured, timestamped, and actor-attributed.',
                  },
                ].map((item) => (
                  <li key={item.label} className="flex items-start gap-3">
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 text-emerald-400 flex-shrink-0"
                    />
                    <div>
                      <p className="text-[13px] font-semibold text-white/75">
                        {item.label}
                      </p>
                      <p className="text-[12px] text-white/75 mt-0.5 leading-snug">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 8. Trust Layer ───────────────────────────────────────────────────── */}
      {/* Three non-negotiables about how the money actually flows. */}
      <section className="bg-surface-0 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Building2,
                headline: 'Stripe holds the money.',
                body: 'Funds do not pass through Vektrum. All capital is held in Stripe Connect managed accounts or processed through licensed payment partners. Vektrum does not hold, transmit, or control funds directly.',
              },
              {
                icon: FileText,
                headline: 'Every action is logged and append-only.',
                body: 'The audit log is append-only at the application layer. Every status change is timestamped and attributed to a named actor. The application never modifies or removes a logged entry.',
              },
              {
                icon: Scale,
                headline: 'We earn when you succeed.',
                body: 'No software license. No monthly access fee. The governance fee is charged only on successful disbursement — our incentives align exactly with yours.',
              },
            ].map((pillar) => (
              <div
                key={pillar.headline}
                className="rounded-2xl border border-white/[0.08] bg-surface-2 p-6"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-vektrum-blue/10 mb-4">
                  <pillar.icon size={17} className="text-vektrum-blue" />
                </div>
                <p className="text-[13px] font-bold text-white mb-2">
                  {pillar.headline}
                </p>
                <p className="text-[12px] leading-relaxed text-white/75">
                  {pillar.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 9. Universal Constants ───────────────────────────────────────────── */}
      {/* The things that never change, regardless of engagement model. */}
      <section className="bg-surface-2 py-14 sm:py-16">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="rounded-2xl border border-white/[0.08] bg-surface-3 p-7 sm:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75 mb-1">
              Universal across all models
            </p>
            <h2 className="text-lg font-bold tracking-[-0.02em] text-white mb-8">
              These never change.
            </h2>

            <div className="grid gap-x-12 gap-y-0 sm:grid-cols-2">
              <div>
                <ConstantRow label="Contractor fee" value="$0 — always" />
                <ConstantRow
                  label="Minimum governance fee"
                  value="$50 per disbursement"
                />
                <ConstantRow
                  label="Commitment deposit"
                  value="$250 — refundable at close"
                />
                <ConstantRow
                  label="Stripe processing"
                  value="At cost — zero markup"
                />
              </div>
              <div>
                <ConstantRow
                  label="Fee timing"
                  value="After transfer — never before"
                />
                <ConstantRow
                  label="Fee label"
                  value="Vektrum Compliance Review Fee"
                />
                <ConstantRow label="Funds held by" value="Stripe — not Vektrum" />
                <ConstantRow label="Audit trail" value="Append-only — no application deletion" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 9b. Which plan is right for me? ─────────────────────────────────── */}
      <section className="bg-surface-0 py-14 sm:py-16">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="rounded-2xl border border-white/[0.08] bg-surface-2 p-7 sm:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75 mb-1">
              Choosing your model
            </p>
            <h2 className="text-lg font-bold tracking-[-0.02em] text-white mb-8">
              Which plan is right for me?
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/[0.04] p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-vektrum-blue mb-2">
                  Standalone — Stripe Connect rail
                </p>
                <p className="text-[13px] leading-relaxed text-white/65">
                  Choose Standalone if you are a private lender, hard money lender, family office, or developer who does not have an existing payment infrastructure. Vektrum connects to Stripe and manages the full draw workflow end-to-end: submission, AI review, 10-condition gate, and automated contractor payout.
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-400 mb-2">
                  Institutional or Enterprise — External rail
                </p>
                <p className="text-[13px] leading-relaxed text-white/65">
                  Choose Institutional or Enterprise if you are a bank, credit union, construction loan servicer, title company, or fund manager with existing licensed payment infrastructure. Vektrum enforces your conditions and fires a signed authorization signal to your execution system — you retain full control of how funds move.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 10. CTA ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.08] bg-surface-2 py-20 sm:py-24">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75 mb-4">
            Get started
          </p>
          <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-white sm:text-[32px] text-balance">
            Standalone: self-service, no setup, 1% per release.
            <br />
            <span className="text-white/75">
              Institutional: contact us to configure your portfolio.
            </span>
          </h2>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/auth/signup"
              className="group inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-8 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Start a Standalone project
              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="mailto:operations@vektrum.io"
              className="inline-flex min-h-[50px] items-center justify-center rounded-xl border border-white/[0.10] bg-transparent px-8 py-3 text-[14px] font-semibold text-white/55 hover:bg-white/[0.04] hover:border-white/[0.18] hover:text-white transition-all"
            >
              Talk to us about Institutional
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[
              'Contractors always free',
              'No monthly fee',
              'No access fee',
              '$0 until funds move',
            ].map((item) => (
              <span
                key={item}
                className="flex items-center gap-1.5 text-[12px] text-white/75"
              >
                <span className="inline-block h-1 w-1 rounded-full bg-white/30" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
