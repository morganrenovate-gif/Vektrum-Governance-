import Link from 'next/link'
import {
  CheckCircle2,
  ArrowRight,
  Shield,
  Zap,
  Building2,
  TrendingUp,
  Lock,
} from 'lucide-react'

export const metadata = {
  title: 'Pricing — Vektrum',
  description:
    'Simple project-based pricing. Funders pay. Contractors join free. Start with 30 days on us.',
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

interface PlanProps {
  name: string
  price: string
  period: string
  tagline: string
  audience: string
  projectSize: string
  features: string[]
  highlight?: boolean
  badge?: string
  cta?: string
}

function PlanCard({
  name,
  price,
  period,
  tagline,
  audience,
  projectSize,
  features,
  highlight = false,
  badge,
  cta = 'Start free trial',
}: PlanProps) {
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

      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-faint">
          {name}
        </p>
        <div className="mt-2 flex items-end gap-1.5">
          <span className="text-4xl font-bold tracking-[-0.04em] text-vektrum-text tabular-nums">
            {price}
          </span>
          {price !== 'Custom' && (
            <span className="mb-1 text-[14px] text-vektrum-muted">{period}</span>
          )}
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-vektrum-muted">{tagline}</p>
      </div>

      <div className="mb-6 space-y-1.5">
        <div className="flex items-start gap-2">
          <Building2 size={13} className="mt-0.5 flex-shrink-0 text-vektrum-faint" />
          <span className="text-[12px] text-vektrum-muted">{audience}</span>
        </div>
        <div className="flex items-start gap-2">
          <TrendingUp size={13} className="mt-0.5 flex-shrink-0 text-vektrum-faint" />
          <span className="text-[12px] text-vektrum-muted">{projectSize}</span>
        </div>
      </div>

      <ul className="mb-8 flex flex-col gap-2.5 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckCircle2
              size={14}
              className="mt-0.5 flex-shrink-0 text-vektrum-green"
            />
            <span className="text-[13px] leading-relaxed text-vektrum-muted">{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/auth/signup"
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

// ─── Page ─────────────────────────────────────────────────────────────────────

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
              Funder pays &mdash; Contractors join free
            </span>
          </div>

          <h1 className="text-4xl font-bold tracking-[-0.035em] text-vektrum-text sm:text-5xl text-balance">
            Simple, project-based pricing
          </h1>
          <p className="mt-5 mx-auto max-w-lg text-[17px] leading-relaxed text-vektrum-muted">
            The funder controls the deal. The funder pays for Vektrum.
            Contractors join every deal they&rsquo;re invited to at zero cost.
          </p>
        </div>
      </section>

      {/* ─── Pricing cards ───────────────────────────────────────────────────── */}
      <section className="bg-vektrum-bg py-4 pb-20 sm:pb-28">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid gap-6 sm:grid-cols-3">
            <PlanCard
              name="Standard"
              price="$299"
              period="/ project / month"
              tagline="Solo GC, small lender, or first deal. Full governance from day one."
              audience="Solo GC or small private lender"
              projectSize="1–3 active projects up to $5M each"
              features={[
                'Full 7-condition release gate',
                'Milestone isolation',
                'Immutable audit trail',
                'Stripe Connect payouts',
                'Dispute management',
                'Change order tracking',
                'Up to 3 active projects',
              ]}
            />
            <PlanCard
              name="Professional"
              price="$599"
              period="/ project / month"
              tagline="The tier most commercial lenders and active GCs run on."
              audience="Commercial lender or GC managing multiple jobs"
              projectSize="3–20 active projects, any size"
              features={[
                'Everything in Standard',
                'Up to 20 active projects',
                'Release Readiness score per deal',
                'Portfolio risk dashboard',
                'Weekly intelligence briefing',
                'AI draw review (coming soon)',
                'Priority support',
              ]}
              highlight
              badge="Most Common"
            />
            <PlanCard
              name="Enterprise"
              price="$1,499"
              period="/ project / month"
              tagline="Or $25K&ndash;$80K/year for 20+ projects. 3 enterprise funders = $1M ARR."
              audience="Large lender or developer with 20+ concurrent projects"
              projectSize="Unlimited projects, $10M+ deal sizes"
              features={[
                'Everything in Professional',
                'Unlimited active projects',
                'Custom annual pricing available',
                'Dedicated onboarding',
                'SLA-backed support',
                'Custom integrations',
                'Audit export for compliance',
              ]}
              cta="Contact us"
            />
          </div>
        </div>
      </section>

      {/* ─── Funder pays callout ─────────────────────────────────────────────── */}
      <section className="bg-vektrum-canvas py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="rounded-2xl border border-vektrum-blue/30 bg-vektrum-blue/10 p-8 sm:p-10">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-vektrum-blue/20">
                <Shield size={20} className="text-vektrum-blue-subtle" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-[-0.02em]">
                  The funder pays. Contractors join free.
                </h2>
                <p className="mt-3 text-[14px] leading-relaxed text-white/70">
                  The funder controls the deal. The funder pays for Vektrum.
                  Contractors join every deal they&rsquo;re invited to at zero cost &mdash; no subscription,
                  no onboarding fee, no per-milestone charge. Vektrum&rsquo;s incentive is aligned with the
                  funder: protect capital, enforce terms, and make contractors want to be on the platform.
                </p>
                <p className="mt-4 text-[13px] font-semibold text-white/50 italic">
                  &ldquo;Vektrum never holds funds. Stripe holds the funds. Vektrum holds the rules.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Trust details row ───────────────────────────────────────────────── */}
      <section className="bg-vektrum-bg py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid gap-6 sm:grid-cols-3">
            {/* Free trial */}
            <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-vektrum-green-bg mb-4">
                <Zap size={18} className="text-vektrum-green" />
              </div>
              <h3 className="text-[15px] font-semibold text-vektrum-text tracking-[-0.01em]">
                30-day free trial
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-vektrum-muted">
                Full Standard access for 30 days. No credit card at signup.
                A card is required only at your first Stripe funding event &mdash; not before.
              </p>
            </div>

            {/* Stripe fees */}
            <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-vektrum-blue-subtle mb-4">
                <Lock size={18} className="text-vektrum-blue" />
              </div>
              <h3 className="text-[15px] font-semibold text-vektrum-text tracking-[-0.01em]">
                Stripe fees at cost
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-vektrum-muted">
                Vektrum never marks up Stripe fees. You pay exactly what Stripe charges &mdash;
                disclosed at every transaction. No hidden spread.
              </p>
            </div>

            {/* Path to $1M ARR */}
            <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-vektrum-amber-bg mb-4">
                <TrendingUp size={18} className="text-vektrum-amber" />
              </div>
              <h3 className="text-[15px] font-semibold text-vektrum-text tracking-[-0.01em]">
                Built for funder-led growth
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-vektrum-muted">
                3 enterprise funders = $1M ARR. Each funder mandates Vektrum on their deals &mdash;
                contractors follow. $1M in 9&ndash;12 months via this flywheel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Competitive context ─────────────────────────────────────────────── */}
      <section className="bg-vektrum-canvas py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
            Where Vektrum fits
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl">
            Built for the gap Procore doesn&rsquo;t serve
          </h2>
          <p className="mt-4 mx-auto max-w-md text-[15px] text-white/60">
            Procore and Textura serve $50M+ construction projects. Traditional lenders serve nothing.
            Vektrum is purpose-built for $500K&ndash;$25M deals &mdash; the market with the most payment disputes,
            the least protection, and the highest need.
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
            30 days free. No credit card at signup. Funder pays when funding starts.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/auth/signup"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Start free trial
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-vektrum-border bg-vektrum-surface px-7 py-3 text-[14px] font-semibold text-vektrum-muted shadow-sm hover:bg-vektrum-surface-alt hover:border-vektrum-blue/40 transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
