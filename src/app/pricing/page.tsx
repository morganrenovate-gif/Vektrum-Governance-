import Link from 'next/link'
import {
  CheckCircle2,
  ArrowRight,
  Shield,
  Building2,
  Lock,
  DollarSign,
  BarChart3,
} from 'lucide-react'

export const metadata = {
  title: 'Pricing — Vektrum',
  description:
    'Governance retainer + performance fee. Contractors always free. You pay when the platform delivers verified disbursements — not before.',
}

// ─── Tier Card ────────────────────────────────────────────────────────────────

interface TierProps {
  num: string
  name: string
  target: string
  crfRate: string
  crfNote?: string
  retainer: string
  retainerNote?: string
  implementation: string
  features: string[]
  highlight?: boolean
  badge?: string
  cta?: string
  ctaHref?: string
}

function TierCard({
  num,
  name,
  target,
  crfRate,
  crfNote,
  retainer,
  retainerNote,
  implementation,
  features,
  highlight = false,
  badge,
  cta = 'Get started',
  ctaHref = '/auth/signup',
}: TierProps) {
  return (
    <div
      className={[
        'relative flex flex-col rounded-2xl border p-8 transition-shadow',
        highlight
          ? 'border-vektrum-blue bg-vektrum-surface shadow-xl shadow-vektrum-blue/10'
          : 'border-vektrum-border bg-vektrum-surface hover:shadow-lg hover:shadow-vektrum-blue/5',
      ].join(' ')}
    >
      {badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-vektrum-blue px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
            {badge}
          </span>
        </div>
      )}

      {/* Tier header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-vektrum-blue/10 text-[11px] font-bold text-vektrum-blue">
            {num}
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-faint">
            {name}
          </p>
        </div>
        <div className="flex items-start gap-2 mb-1">
          <Building2 size={13} className="mt-0.5 flex-shrink-0 text-vektrum-faint" />
          <span className="text-[12px] text-vektrum-muted">{target}</span>
        </div>
      </div>

      {/* CRF Rate */}
      <div className="mb-4 rounded-xl border border-vektrum-border bg-vektrum-surface-alt px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-vektrum-faint mb-1">
          Vektrum Compliance Review Fee
        </p>
        <p className="text-[20px] font-bold tracking-[-0.03em] text-vektrum-text tabular-nums">
          {crfRate}
        </p>
        {crfNote && (
          <p className="mt-0.5 text-[11px] text-vektrum-muted">{crfNote}</p>
        )}
      </div>

      {/* Governance Retainer */}
      <div
        className={[
          'mb-5 rounded-xl border px-4 py-3',
          retainer === 'None'
            ? 'border-vektrum-border bg-vektrum-surface-alt'
            : 'border-vektrum-blue/20 bg-vektrum-blue/5',
        ].join(' ')}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-vektrum-faint mb-1">
          Portfolio Governance Retainer
        </p>
        <p
          className={[
            'text-[13px] font-semibold',
            retainer === 'None' ? 'text-vektrum-muted' : 'text-vektrum-blue',
          ].join(' ')}
        >
          {retainer}
        </p>
        {retainerNote && (
          <p className="mt-0.5 text-[11px] text-vektrum-muted">{retainerNote}</p>
        )}
      </div>

      {/* Implementation */}
      <div className="mb-5 flex items-start gap-2">
        <Lock size={12} className="mt-0.5 flex-shrink-0 text-vektrum-faint" />
        <span className="text-[12px] text-vektrum-muted">
          <span className="font-medium text-vektrum-text">Implementation: </span>
          {implementation}
        </span>
      </div>

      {/* Features */}
      <ul className="mb-8 flex flex-col gap-2.5 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-vektrum-green" />
            <span className="text-[13px] leading-relaxed text-vektrum-muted">{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className={[
          'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition-all',
          highlight
            ? 'bg-vektrum-blue text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover'
            : 'border border-vektrum-border bg-vektrum-surface-alt text-vektrum-muted hover:border-vektrum-blue/40 hover:text-vektrum-text',
        ].join(' ')}
      >
        {cta}
        <ArrowRight size={14} />
      </Link>
    </div>
  )
}

// ─── Constant row ──────────────────────────────────────────────────────────────

function ConstantRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-vektrum-border py-3 last:border-0">
      <span className="text-[13px] text-vektrum-muted">{label}</span>
      <span className="text-[13px] font-semibold text-vektrum-text">{value}</span>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="flex flex-col">

      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-vektrum-bg pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(26,58,150,1) 1px, transparent 1px), linear-gradient(90deg, rgba(26,58,150,1) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-vektrum-blue-subtle/50 to-transparent rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-vektrum-border bg-vektrum-surface px-4 py-1.5 shadow-sm mb-8">
            <div className="h-1.5 w-1.5 rounded-full bg-vektrum-green animate-pulse-slow" />
            <span className="text-[12px] font-medium text-vektrum-muted tracking-wide">
              Pricing Model v2.0 &mdash; Effective April 2026
            </span>
          </div>

          <h1 className="text-4xl font-bold tracking-[-0.035em] text-vektrum-text sm:text-5xl text-balance">
            Governance + Performance.
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-[17px] leading-relaxed text-vektrum-muted">
            We charge a small governance retainer on active portfolios and a
            success-based compliance fee on each verified disbursement &mdash; never
            before money moves, and never from contractors.
          </p>
        </div>
      </section>

      {/* ─── Three tiers ─────────────────────────────────────────────────────── */}
      <section className="bg-vektrum-bg py-4 pb-12 sm:pb-16">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid gap-6 lg:grid-cols-3">

            <TierCard
              num="01"
              name="Standalone Project"
              target="Individual contractors · Developers · Private projects"
              crfRate="1.0%"
              crfNote="per verified milestone disbursement"
              retainer="None"
              retainerNote="Pure performance model — pay only when money moves"
              implementation="Self-service — no implementation fee"
              features={[
                'Full 7-condition release gate',
                'Milestone isolation & immutable audit trail',
                'Stripe Connect payouts',
                'Dispute management & change order tracking',
                '$50 minimum · $25,000 maximum per release',
                '$250 commitment deposit (refundable at close)',
                'Contractors always join free',
              ]}
            />

            <TierCard
              num="02"
              name="Institutional Portfolio"
              target="Banks · Private credit funds · Regional lenders"
              crfRate="0.70%"
              crfNote="per verified disbursement (retainer rate)"
              retainer="0.075% of ACV / year"
              retainerNote="Floor: $5,000 / yr · Cap: $50,000 / yr"
              implementation="$5,000–$15,000 one-time setup"
              highlight
              badge="Most Common"
              features={[
                'Everything in Standalone',
                'Reduced CRF rate (0.70% vs. 1.0%)',
                'Retainer converts to fee credit on first disbursement',
                'Portfolio risk dashboard',
                'Release Readiness score per deal',
                'Priority support',
                'Rate reverts to 1.0% without retainer',
              ]}
            />

            <TierCard
              num="03"
              name="Enterprise / Platform"
              target="Large contractors · Owners · Construction lenders at scale"
              crfRate="0.65%"
              crfNote="per verified disbursement — negotiated annually"
              retainer="0.05–0.10% of ACV / year"
              retainerNote="Floor: $25,000 / yr — negotiated"
              implementation="$15,000–$50,000 — includes integration & training"
              cta="Contact us"
              ctaHref="mailto:lenders@vektrum.io"
              features={[
                'Everything in Institutional',
                'LOS / API integration (included)',
                'Dedicated portfolio dashboard',
                'Dedicated customer success manager',
                '99.9% uptime SLA',
                'Audit export for compliance',
                'Custom MSA & addendum available',
              ]}
            />

          </div>
        </div>
      </section>

      {/* ─── Universal constants ─────────────────────────────────────────────── */}
      <section className="bg-vektrum-bg pb-20 sm:pb-24">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-8 sm:p-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-faint mb-1">
              Universal across all tiers
            </p>
            <h2 className="text-xl font-bold tracking-[-0.02em] text-vektrum-text mb-8">
              These never change, regardless of tier
            </h2>

            <div className="grid gap-x-12 gap-y-0 sm:grid-cols-2">
              <div>
                <ConstantRow label="Contractor fee" value="$0 — always free" />
                <ConstantRow label="Minimum per disbursement" value="$50" />
                <ConstantRow label="Maximum per disbursement" value="$25,000" />
                <ConstantRow label="Commitment deposit" value="$250 (refundable at project close)" />
              </div>
              <div>
                <ConstantRow label="Stripe processing fees" value="At cost — zero markup" />
                <ConstantRow label="Fee timing" value="Never before money moves" />
                <ConstantRow label="Fee label" value="Vektrum Compliance Review Fee" />
                <ConstantRow label="Funds held by" value="Stripe — not Vektrum" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────────────────────────── */}
      <section className="bg-vektrum-canvas py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="rounded-2xl border border-vektrum-blue/30 bg-vektrum-blue/10 p-8 sm:p-10">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-vektrum-blue/20">
                <Shield size={20} className="text-vektrum-blue-subtle" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-[-0.02em]">
                  Two knobs. One sentence.
                </h2>
                <p className="mt-3 text-[14px] leading-relaxed text-white/70">
                  Every tier uses the same core structure: a <strong className="text-white/90">governance component</strong>{' '}
                  (the portfolio retainer — predictable, billed annually) plus a{' '}
                  <strong className="text-white/90">performance component</strong>{' '}
                  (the Vektrum Compliance Review Fee — charged per verified disbursement). The only difference
                  across tiers is scale and whether the retainer applies. Standalone clients have no
                  retainer — pure performance pricing. Institutional and Enterprise clients commit to
                  a retainer in exchange for a lower CRF rate.
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 size={14} className="text-vektrum-blue-subtle" />
                      <p className="text-[12px] font-semibold text-white/80 uppercase tracking-wide">Governance Retainer</p>
                    </div>
                    <p className="text-[13px] text-white/60 leading-relaxed">
                      Annual fee based on Active Construction Volume (ACV). Creates predictable baseline revenue.
                      Billed to the institution — never the contractor.
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign size={14} className="text-vektrum-amber" />
                      <p className="text-[12px] font-semibold text-white/80 uppercase tracking-wide">Vektrum Compliance Review Fee</p>
                    </div>
                    <p className="text-[13px] text-white/60 leading-relaxed">
                      Charged per verified disbursement only — never before money moves.
                      Success-based: Vektrum earns when the deal closes a milestone correctly.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Example calculation ─────────────────────────────────────────────── */}
      <section className="bg-vektrum-bg py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-faint mb-2">
            Example calculation
          </p>
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-vektrum-text mb-8 text-balance">
            Regional bank, $50M annual construction portfolio
          </h2>
          <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface overflow-hidden">
            <div className="bg-vektrum-blue px-6 py-4">
              <p className="text-[13px] font-semibold text-white">Institutional tier — 0.075% ACV retainer + 0.70% CRF</p>
            </div>
            <div className="divide-y divide-vektrum-border">
              <div className="flex items-center justify-between px-6 py-4">
                <span className="text-[14px] text-vektrum-muted">Governance Retainer (0.075% of $50M ACV)</span>
                <span className="text-[14px] font-semibold text-vektrum-text tabular-nums">$37,500 / yr</span>
              </div>
              <div className="flex items-center justify-between px-6 py-4">
                <span className="text-[14px] text-vektrum-muted">Vektrum Compliance Review Fee (0.70% × 6 avg draws of $500K)</span>
                <span className="text-[14px] font-semibold text-vektrum-text tabular-nums">$21,000 / yr</span>
              </div>
              <div className="flex items-center justify-between px-6 py-4 bg-vektrum-green-bg/30">
                <span className="text-[14px] font-semibold text-vektrum-text">Total annual cost</span>
                <span className="text-[18px] font-bold text-vektrum-green tabular-nums">$58,500 / yr</span>
              </div>
            </div>
          </div>
          <p className="mt-4 text-[12px] text-vektrum-faint leading-relaxed">
            For context: equivalent Procore ARR at comparable scale is $120,000–$250,000/yr.
            Vektrum is outcome-aligned pricing — not a discount, a different model.
          </p>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="border-t border-vektrum-border bg-vektrum-surface py-20 sm:py-24">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-3xl text-balance">
            Start protecting your deals today
          </h2>
          <p className="mt-4 mx-auto max-w-md text-[15px] text-vektrum-muted">
            Standalone projects: self-service, no implementation fee.
            Institutional portfolios: contact us to get started.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/auth/signup"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Start Standalone project
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="mailto:lenders@vektrum.io"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-vektrum-border bg-vektrum-surface px-7 py-3 text-[14px] font-semibold text-vektrum-muted shadow-sm hover:bg-vektrum-surface-alt hover:border-vektrum-blue/40 transition-all"
            >
              Talk to us about Institutional
            </Link>
          </div>
          <p className="mt-6 text-[12px] text-vektrum-faint">
            Contractors always join free &mdash; no subscription, no per-milestone charge, no onboarding fee.
          </p>
        </div>
      </section>

    </div>
  )
}
