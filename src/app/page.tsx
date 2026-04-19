import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Shield,
  GitBranch,
  FileText,
  ArrowRight,
  Lock,
  CheckCircle2,
  Zap,
  Building2,
  TrendingUp,
  X,
  BadgeCheck,
  Star,
  AlertCircle,
  Banknote,
} from 'lucide-react'
import { DemoScene } from '@/components/homepage/demo-scene'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="flex flex-col">
      {/* ─── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-vektrum-bg">
        {/* Blueprint grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(26,58,150,1) 1px, transparent 1px), linear-gradient(90deg, rgba(26,58,150,1) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        {/* Brand blue radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-vektrum-blue-subtle/60 to-transparent rounded-full blur-3xl" />

       <div className="relative max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-24 pb-20 sm:pt-32 sm:pb-28">
         <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center"></div>
         {/* Left: hero copy */}
        <div>
          {/* Badge */}
          <div className="animate-fade-in flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-vektrum-border bg-vektrum-surface px-4 py-1.5 shadow-sm">
              <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-vektrum-green animate-pulse-slow" />
              <span className="text-[11px] sm:text-[12px] font-medium text-vektrum-muted tracking-wide text-center">
                Milestone payments &mdash; server-enforced
              </span>
            </div>
          </div>

          {/* Headline — display typeface for authority */}
          <h1 className="animate-fade-in font-display text-center text-[2rem] font-bold tracking-[-0.035em] text-vektrum-text sm:text-5xl lg:text-[3.75rem] lg:leading-[1.08] text-balance leading-[1.12]">
            Control every construction draw.
            <br className="hidden sm:block" />
            <span className="text-vektrum-faint">Before money moves.</span>
          </h1>

          {/* Sub */}
          <p className="animate-fade-in-delay mx-auto mt-6 max-w-lg text-center text-[17px] leading-relaxed text-vektrum-muted">
             Vektrum enforces milestone-based releases, isolates disputes to individual draws, and ensures funds move only when work is verified.
          </p>

          <p className="mx-auto mt-4 max-w-3xl text-center text-[15px] leading-relaxed text-vektrum-faint">
             Vektrum is a software governance layer. We enforce release conditions and audit every disbursement. We do not hold, transmit, or control funds. We are built to operate alongside licensed escrow providers, not replace them.
          </p>

          {/* CTAs */}
          <div className="animate-fade-in-delay-2 mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/auth/signup"
              className="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-8 py-3.5 text-[15px] font-semibold text-white shadow-blue transition-all hover:bg-vektrum-blue-hover hover:shadow-lg"
            >
              Start a deal — it&rsquo;s free
              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <a
              href="#demo"
              className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-vektrum-border bg-vektrum-surface px-7 py-3 text-[14px] font-semibold text-vektrum-muted shadow-sm hover:bg-vektrum-surface-alt hover:border-vektrum-blue/40 transition-all"
            >
              See how it works
            </a>
          </div>

          {/* Trust signals — above fold, 2026 fintech standard */}
          <div className="animate-fade-in-delay-3 mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-2 text-[12px] text-vektrum-faint">
              <BadgeCheck size={14} className="text-vektrum-blue" aria-hidden="true" />
              <span>Payments via Stripe Connect</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-vektrum-faint">
              <Shield size={14} className="text-vektrum-green" aria-hidden="true" />
              <span>7-condition server-side gate</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-vektrum-faint">
              <Lock size={14} className="text-vektrum-muted" aria-hidden="true" />
              <span>Funds held by Stripe, not Vektrum</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-vektrum-faint">
              <Star size={14} className="text-vektrum-amber" aria-hidden="true" />
              <span>Contractors always join free</span>
            </div>
            {/* Right: product preview */}
<div className="hidden lg:block mt-12 lg:mt-0">
  <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface shadow-2xl shadow-vektrum-blue/10 overflow-hidden">
    <div className="flex items-center gap-1.5 border-b border-vektrum-border bg-vektrum-surface-alt px-4 py-3">
      <div className="h-2.5 w-2.5 rounded-full bg-vektrum-blue/30" />
      <div className="h-2.5 w-2.5 rounded-full bg-vektrum-blue/40" />
      <div className="h-2.5 w-2.5 rounded-full bg-vektrum-blue/50" />
      <div className="mx-auto flex items-center gap-2 rounded-md border border-vektrum-border-subtle bg-vektrum-bg px-3 py-1">
        <div className="h-1.5 w-1.5 rounded-full bg-vektrum-blue" />
        <span className="text-[11px] text-vektrum-faint">app.vektrum.io</span>
      </div>
    </div>

    <div className="p-5 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-faint">
        $15K dispute — $9M project unaffected
      </p>

      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-3.5 flex items-center justify-between">
        <span className="text-[12px] font-medium text-vektrum-text">Harbor Logistics Center</span>
        <span className="text-[13px] font-bold tabular-nums text-vektrum-text">$9,000,000</span>
      </div>

      <div className="space-y-2">
        <div className="rounded-lg border border-vektrum-blue/20 bg-vektrum-blue/5 px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-vektrum-blue flex-shrink-0" />
            <span className="text-[12px] font-medium text-vektrum-text">Site Preparation</span>
          </div>
          <p className="text-[11px] font-semibold tabular-nums text-vektrum-blue">$320,000 released</p>
        </div>

        <div className="rounded-lg border border-vektrum-border bg-vektrum-surface-alt px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={13} className="text-vektrum-blue flex-shrink-0" />
              <span className="text-[12px] font-medium text-vektrum-text">Concrete Sub-grade</span>
            </div>
            <span className="rounded-full bg-vektrum-blue/10 px-2 py-0.5 text-[10px] font-medium text-vektrum-blue">Review hold</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-vektrum-blue font-semibold">$15,000 locked</p>
            <p className="text-[10px] text-vektrum-faint">Isolated — does not block others</p>
          </div>
        </div>

        {[
          { label: 'Structural Steel', amount: '$2,180,000', pct: 100 },
          { label: 'MEP Systems', amount: '$1,640,000', pct: 75 },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-vektrum-border bg-vektrum-surface px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <Banknote size={13} className="text-vektrum-blue flex-shrink-0" />
                <span className="text-[12px] font-medium text-vektrum-text">{m.label}</span>
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-vektrum-blue">{m.amount}</span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-vektrum-surface-alt">
              <div className="absolute left-0 top-0 h-full rounded-full bg-vektrum-blue" style={{ width: `${m.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/5 px-4 py-3">
        <p className="text-[12px] font-semibold text-vektrum-blue">$8,985,000 continues flowing</p>
        <p className="mt-0.5 text-[11px] text-vektrum-muted">
          The $15K dispute is isolated to its milestone. Every other payment proceeds on schedule.
        </p>
      </div>
    </div>
  </div>
  </div>
  </div>
  </div>
      </section>

{/* ─── Audience Split ────────────────────────────────────────────────── */}
<section className="bg-vektrum-bg py-16 sm:py-20">
  <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-12">
    <div className="mb-8 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-faint">
        Choose your path
      </p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <Link
        href="/lenders"
        className="group flex flex-col rounded-2xl border border-vektrum-border bg-vektrum-surface p-10 transition-all duration-300 hover:border-vektrum-blue/40 hover:shadow-lg hover:shadow-vektrum-blue/5"
      >
        <span className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-blue">
          For funders
        </span>
        <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-vektrum-text sm:text-2xl">
          Protect capital. Control every release.
        </h2>
        <p className="mt-4 flex-1 text-[14px] leading-relaxed text-vektrum-muted">
          Enforce milestone-based releases. Eliminate draw disputes before funds move.
        </p>
        <div className="mt-8 inline-flex items-center gap-2 text-[13px] font-semibold text-vektrum-blue transition-all group-hover:gap-3">
          Explore for funders
          <ArrowRight size={14} />
        </div>
      </Link>

      <Link
        href="/contractors"
        className="group flex flex-col rounded-2xl border border-vektrum-border bg-vektrum-surface p-10 transition-all duration-300 hover:border-vektrum-blue/40 hover:shadow-lg hover:shadow-vektrum-blue/5"
      >
        <span className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-green">
          For contractors
        </span>
        <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-vektrum-text sm:text-2xl">
          Get paid when the work is done.
        </h2>
        <p className="mt-4 flex-1 text-[14px] leading-relaxed text-vektrum-muted">
          Get paid faster with verified milestones. Reduce disputes. Keep projects moving.
        </p>
        <div className="mt-8 inline-flex items-center gap-2 text-[13px] font-semibold text-vektrum-green transition-all group-hover:gap-3">
          Explore for contractors
          <ArrowRight size={14} />
        </div>
      </Link>
    </div>
  </div>
</section>

      {/* ─── Credibility Bar ───────────────────────────────────────────────── */}
<section className="border-b border-vektrum-border bg-vektrum-surface/60">
  <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8 lg:px-12">
    <div className="mb-5 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
      {[
        { icon: Zap, text: "AI-reviewed on every draw", color: "text-vektrum-blue" },
        { icon: Shield, text: "Stripe Connect secured funds", color: "text-vektrum-green" },
        { icon: Lock, text: "Zero fund custody by Vektrum", color: "text-vektrum-muted" },
        { icon: CheckCircle2, text: "Real-time milestone verification", color: "text-vektrum-blue" },
        { icon: Shield, text: "Vektrum requires a licensed fund custodian", color: "text-vektrum-green" },
      ].map(({ icon: Icon, text, color }) => (
        <div key={text} className="flex items-center gap-2">
          <Icon size={14} className={color} aria-hidden="true" />
          <span className="text-[12px] font-medium text-vektrum-muted">
            {text}
          </span>
        </div>
      ))}
    </div>

    <p className="text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-faint">
      Built for institutional-grade construction finance
    </p>
  </div>
</section>

      {/* ─── Live Proof Bar ────────────────────────────────────────────────── */}
      <section className="border-y border-vektrum-border bg-vektrum-surface">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-10">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-vektrum-border-subtle">
            {[
              {
                value: '7',
                label: 'Server-side conditions before any dollar moves',
                sub: 'Platform architecture',
              },
              {
                value: '$0',
                label: 'Held by Vektrum — Stripe holds the funds',
                sub: 'By design',
              },
              {
                value: '∞',
                label: 'Releases immutable after completion',
                sub: 'Audit log',
              },
              {
                value: '1',
                label: 'Dispute isolates 1 milestone, not the whole deal',
                sub: 'Release gate',
              },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center text-center sm:px-6">
                <span className="text-2xl font-bold tracking-[-0.02em] text-vektrum-text font-numeric sm:text-3xl">
                  {stat.value}
                </span>
                <span className="mt-1.5 text-[13px] leading-snug text-vektrum-muted">
                  {stat.label}
                </span>
                <span className="mt-1 text-[11px] text-vektrum-faint">{stat.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

            {/* ─── Partnership Model Flow ─────────────────────────────────────────── */}
      <section className="bg-vektrum-surface border-b border-vektrum-border py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6 sm:px-8 lg:px-12">
          <div className="mb-10 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-faint">
              How the partnership works
            </span>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[14px] leading-relaxed text-vektrum-muted">
              Licensed escrow or title partners hold funds. Vektrum provides the governance layer that enforces release conditions and preserves the audit trail.
            </p>
          </div>

          <div className="hidden gap-2 sm:grid sm:grid-cols-[1fr_32px_1fr_32px_1fr] sm:items-center">
            <div className="rounded-2xl border-2 border-vektrum-blue bg-vektrum-surface p-7">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-vektrum-blue/10">
                <Building2 size={18} className="text-vektrum-blue" />
              </div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-vektrum-blue">
                Fund custodian
              </p>
              <h3 className="mb-3 text-[14px] font-semibold leading-snug text-vektrum-text">
                Licensed Escrow / Title Company
              </h3>
              <p className="text-[13px] leading-relaxed text-vektrum-muted">
                Serves as the licensed fund custodian and holds project funds.
              </p>
            </div>

            <div className="flex justify-center">
              <ArrowRight size={18} className="text-vektrum-faint" />
            </div>

            <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-7">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-vektrum-amber-bg">
                <Shield size={18} className="text-vektrum-amber" />
              </div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-vektrum-amber">
                Governance software
              </p>
              <h3 className="mb-3 text-[14px] font-semibold leading-snug text-vektrum-text">
                Vektrum Software Layer
              </h3>
              <p className="text-[13px] leading-relaxed text-vektrum-muted">
                Enforces release conditions, verifies milestones, and maintains the audit trail.
              </p>
            </div>

            <div className="flex justify-center">
              <ArrowRight size={18} className="text-vektrum-faint" />
            </div>

            <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-7">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-vektrum-green-bg">
                <CheckCircle2 size={18} className="text-vektrum-green" />
              </div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-vektrum-green">
                Payment recipient
              </p>
              <h3 className="mb-3 text-[14px] font-semibold leading-snug text-vektrum-text">
                Contractor
              </h3>
              <p className="text-[13px] leading-relaxed text-vektrum-muted">
                Receives payment only after verified release conditions are met.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:hidden">
            <div className="rounded-2xl border-2 border-vektrum-blue bg-vektrum-surface p-7">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-vektrum-blue/10">
                <Building2 size={18} className="text-vektrum-blue" />
              </div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-vektrum-blue">
                Fund custodian
              </p>
              <h3 className="mb-3 text-[14px] font-semibold leading-snug text-vektrum-text">
                Licensed Escrow / Title Company
              </h3>
              <p className="text-[13px] leading-relaxed text-vektrum-muted">
                Serves as the licensed fund custodian and holds project funds.
              </p>
            </div>

            <div className="flex justify-center">
              <ArrowRight size={18} className="rotate-90 text-vektrum-faint" />
            </div>

            <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-7">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-vektrum-amber-bg">
                <Shield size={18} className="text-vektrum-amber" />
              </div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-vektrum-amber">
                Governance software
              </p>
              <h3 className="mb-3 text-[14px] font-semibold leading-snug text-vektrum-text">
                Vektrum Software Layer
              </h3>
              <p className="text-[13px] leading-relaxed text-vektrum-muted">
                Enforces release conditions, verifies milestones, and maintains the audit trail.
              </p>
            </div>

            <div className="flex justify-center">
              <ArrowRight size={18} className="rotate-90 text-vektrum-faint" />
            </div>

            <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-7">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-vektrum-green-bg">
                <CheckCircle2 size={18} className="text-vektrum-green" />
              </div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-vektrum-green">
                Payment recipient
              </p>
              <h3 className="mb-3 text-[14px] font-semibold leading-snug text-vektrum-text">
                Contractor
              </h3>
              <p className="text-[13px] leading-relaxed text-vektrum-muted">
                Receives payment only after verified release conditions are met.
              </p>
            </div>
          </div>
        </div>
      </section>
      
{/* ─── Proof Layer ───────────────────────────────────────────────────── */}
<section className="bg-vektrum-bg py-12 sm:py-16">
  <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-12">
    <div className="mb-8 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-faint">
        Why teams trust Vektrum
      </p>
    </div>

    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-8">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-vektrum-text">
          Built by operators
        </h3>
        <p className="mt-3 text-[13px] leading-relaxed text-vektrum-muted">
          Created by construction and product operators who understand draw friction, dispute risk, and delayed payments.
        </p>
      </div>

      <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-8">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-vektrum-text">
          Funds held by Stripe
        </h3>
        <p className="mt-3 text-[13px] leading-relaxed text-vektrum-muted">
          Vektrum governs release conditions. Stripe Connect holds and moves funds.
        </p>
      </div>

      <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-8">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-vektrum-text">
          Built for real deal sizes
        </h3>
        <p className="mt-3 text-[13px] leading-relaxed text-vektrum-muted">
          Purpose-built for construction deals from $500K to $25M.
        </p>
      </div>
    </div>
  </div>
</section>

      {/* ─── Trust Numbers ───────────────────────────────────────────────── */}
      <section className="bg-vektrum-bg py-10">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-vektrum-text sm:text-3xl font-numeric">$0</p>
              <p className="mt-1 text-[13px] text-vektrum-muted">in disputed funds lost</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-vektrum-text sm:text-3xl font-numeric">7</p>
              <p className="mt-1 text-[13px] text-vektrum-muted">condition release gate</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-vektrum-text sm:text-3xl">AI-reviewed</p>
              <p className="mt-1 text-[13px] text-vektrum-muted">every draw request</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Interactive Demo ──────────────────────────────────────────────── */}
      <section id="demo" className="bg-vektrum-bg py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Left: copy */}
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-faint">
                How it works
              </span>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-3xl">
                See the governance in action
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-vektrum-muted">
                Three scenes. Deal creation, AI draw pre-clearance, and the defining scenario: a $15K
                dispute locked to one milestone while $8.98M keeps flowing.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Every release passes 7 server-side checks simultaneously',
                  'Disputes isolate — one milestone locked, all others proceed',
                  'AI pre-clearance flags risk before the funder sees it',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-vektrum-green" />
                    <span className="text-[13px] leading-relaxed text-vektrum-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Right: demo */}
            <DemoScene />
          </div>
        </div>
      </section>

      {/* ─── Competitive Gap Table ─────────────────────────────────────────── */}
      <section className="bg-vektrum-canvas py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-12">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Competitive positioning
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl">
              The gap nobody else fills
            </h2>
            <p className="mt-3 mx-auto max-w-md text-[15px] text-white/60">
              Procore and Textura serve $50M+ jobs. Traditional lenders serve nothing automated.
              Vektrum owns $500K&ndash;$25M &mdash; the highest-dispute, least-protected segment.
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/10 -mx-2 sm:mx-0">
            <table className="w-full border-collapse text-left" style={{ minWidth: '520px' }}>
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-3 sm:px-5 py-3.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
                    Capability
                  </th>
                  <th className="px-3 sm:px-5 py-3.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
                    Procore
                  </th>
                  <th className="px-3 sm:px-5 py-3.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
                    Traditional Funder
                  </th>
                  <th className="px-3 sm:px-5 py-3.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-vektrum-blue">
                    Vektrum
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Deal size', '$50M+', 'Any', '$500K\u2013$25M'],
                  ['Milestone isolation', '✗', '✗', '✓'],
                  ['7-condition gate', '✗', '✗', '✓'],
                  ['Contractor free', '✗', '✗', '✓'],
                  ['Funder controls release', 'Partial', 'Manual', '✓ Auto'],
                  ['AI draw review', '✗', '✗', 'Coming soon'],
                  ['Immutable audit', 'Partial', '✗', '✓'],
                ].map(([label, procore, traditionalFunder, vektrum], i) => (
                  <tr
                    key={label}
                    className={[
                      'border-b border-white/5',
                      i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]',
                    ].join(' ')}
                  >
                    <td className="px-3 sm:px-5 py-3 text-[12px] sm:text-[13px] font-medium text-white/70">{label}</td>
                    <td className="px-3 sm:px-5 py-3 text-[12px] sm:text-[13px] text-white/40">
                      {procore === '✗' ? <X size={13} className="text-vektrum-red/60" /> : procore}
                    </td>
                    <td className="px-3 sm:px-5 py-3 text-[12px] sm:text-[13px] text-white/40">
                      {traditionalFunder === '✗' ? <X size={13} className="text-vektrum-red/60" /> : traditionalFunder}
                    </td>
                    <td className="px-3 sm:px-5 py-3 text-[12px] sm:text-[13px] font-semibold text-vektrum-blue-subtle">
                      {vektrum === '✓' || vektrum === '✓ Auto' ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-vektrum-green flex-shrink-0" />
                          {vektrum === '✓ Auto' ? <span className="text-[11px]">Auto</span> : ''}
                        </span>
                      ) : vektrum === 'Coming soon' ? (
                        <span className="text-[10px] text-vektrum-amber">Soon</span>
                      ) : (
                        vektrum
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Core Protections (4 cards) ────────────────────────────────────── */}
      <section className="bg-vektrum-bg py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-faint">
              Core protections
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-3xl">
              Every dollar governed
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1 — Milestone isolation */}
            <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-8 hover:border-vektrum-blue/40 hover:shadow-lg hover:shadow-vektrum-blue/5 transition-all duration-300">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-blue/10 mb-5">
                <Shield size={20} className="text-vektrum-blue" />
              </div>
              <h3 className="text-[15px] font-semibold text-vektrum-text tracking-[-0.01em]">
                Milestone isolation
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-vektrum-muted">
                Each milestone is an independent financial unit. A dispute on one never
                freezes another. A $9M job is never held up by a $15K disagreement.
              </p>
            </div>

            {/* Card 2 — Release gate */}
            <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-8 hover:border-vektrum-blue/40 hover:shadow-lg hover:shadow-vektrum-blue/5 transition-all duration-300">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-amber-bg mb-5">
                <Lock size={20} className="text-vektrum-amber" />
              </div>
              <h3 className="text-[15px] font-semibold text-vektrum-text tracking-[-0.01em]">
                7-condition release gate
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-vektrum-muted">
                Every release passes 7 server-side checks simultaneously. Milestone approved,
                funds available, no disputes, no pending changes, contractor verified, Stripe active,
                no duplicates.
              </p>
            </div>

            {/* Card 3 — Audit trail */}
            <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-8 hover:border-vektrum-blue/40 hover:shadow-lg hover:shadow-vektrum-blue/5 transition-all duration-300">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-green-bg mb-5">
                <GitBranch size={20} className="text-vektrum-green" />
              </div>
              <h3 className="text-[15px] font-semibold text-vektrum-text tracking-[-0.01em]">
                Immutable audit trail
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-vektrum-muted">
                No update. No delete. Every status change, approval, and payment logged with
                timestamp and actor. Full accountability for every dollar, forever.
              </p>
            </div>

            {/* Card 4 — AI Pre-Clearance */}
            <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-8 hover:border-vektrum-blue/40 hover:shadow-lg hover:shadow-vektrum-blue/5 transition-all duration-300 relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-blue/10 mb-5">
                <Zap size={20} className="text-vektrum-blue" />
              </div>
              <h3 className="text-[15px] font-semibold text-vektrum-text tracking-[-0.01em]">
                AI pre-clearance
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-vektrum-muted">
                Before a milestone reaches the funder, Vektrum AI checks for red flags: lien
                waivers, document completeness, change order conflicts. Funders see
                pre-cleared or flagged &mdash; not raw docs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Built for (3 personas) ────────────────────────────────────────── */}
      <section className="bg-vektrum-canvas py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Built for
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl">
              Every party in the deal
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Contractors */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 hover:border-vektrum-blue/30 transition-colors">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-blue-subtle">
                Contractors
              </span>
              <h3 className="mt-3 text-lg font-semibold text-white tracking-[-0.01em]">
                Get paid when you deliver
              </h3>
              <ul className="mt-5 flex flex-col gap-3">
                {[
                  'Milestone-based payouts — no 90-day net terms',
                  'Immutable proof that work was approved',
                  'Disputes isolate one milestone, not the whole project',
                  'Direct deposit to your bank via Stripe Connect',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-vektrum-green" />
                    <span className="text-[13px] leading-relaxed text-white/70">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Funders & GCs */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 hover:border-vektrum-blue/30 transition-colors">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-amber">
                Funders
              </span>
              <h3 className="mt-3 text-lg font-semibold text-white tracking-[-0.01em]">
                Release only what&rsquo;s earned
              </h3>
              <ul className="mt-5 flex flex-col gap-3">
                {[
                  'Approve each milestone before funds move',
                  'Full audit trail for every disbursement',
                  'Change orders tracked and gated',
                  '7-condition server-side release enforcement',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-vektrum-green" />
                    <span className="text-[13px] leading-relaxed text-white/70">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Lenders */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 hover:border-vektrum-blue/30 transition-colors">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-green">
                Lenders
              </span>
              <h3 className="mt-3 text-lg font-semibold text-white tracking-[-0.01em]">
                Your draw process, systematized
              </h3>
              <ul className="mt-5 flex flex-col gap-3">
                {[
                  'Milestone approvals without your team touching paper',
                  'Release gates run server-side — not spreadsheets',
                  'Audit trails for compliance, due diligence, and disputes',
                  'Portfolio risk scores and readiness dashboards built in',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-vektrum-green" />
                    <span className="text-[13px] leading-relaxed text-white/70">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works (steps) ──────────────────────────────────────────── */}
      <section className="bg-vektrum-bg py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-faint">
              The process
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-3xl">
              Protected at every step
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: '01',
                title: 'Create deal',
                desc: 'Contractor creates a deal with defined milestones and amounts. The full contract value is set upfront.',
                icon: FileText,
              },
              {
                step: '02',
                title: 'Fund the Project',
                desc: 'Funder deposits funds via Stripe. Money is held — Vektrum governs release but never holds funds directly.',
                icon: Building2,
              },
              {
                step: '03',
                title: 'Complete & approve',
                desc: 'Contractor marks work done. Funder reviews, inspects, and approves each milestone independently.',
                icon: CheckCircle2,
              },
              {
                step: '04',
                title: 'Release payment',
                desc: 'All 7 release conditions verified server-side. Funds transfer to contractor via Stripe. Fully audited.',
                icon: TrendingUp,
              },
            ].map((item) => (
              <div
                key={item.step}
                className="group relative rounded-2xl border border-vektrum-border bg-vektrum-surface p-6 hover:border-vektrum-blue/40 hover:shadow-lg hover:shadow-vektrum-blue/5 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-[12px] font-semibold text-vektrum-faint">
                    {item.step}
                  </span>
                  <div className="h-px flex-1 bg-vektrum-border-subtle" />
                  <item.icon
                    size={18}
                    className="text-vektrum-faint group-hover:text-vektrum-blue transition-colors"
                  />
                </div>
                <h3 className="text-[15px] font-semibold text-vektrum-text tracking-[-0.01em]">
                  {item.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-vektrum-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Demo CTA ────────────────────────────────────────────────────── */}
      <section className="py-12 bg-vektrum-canvas text-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-3">See Vektrum in Action</h2>
          <p className="text-white/70 mb-6">Watch a live walkthrough of milestone-gated payments, AI draw review, and dispute resolution.</p>
          <Link
            href="/demo-live"
            className="inline-block bg-white text-vektrum-canvas font-semibold px-8 py-3 rounded-xl hover:bg-white/90 transition-colors"
          >
            View Interactive Demo →
          </Link>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────────────── */}
      <section className="border-t border-vektrum-border bg-vektrum-surface py-20 sm:py-24">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-3xl text-balance">
            Stop losing money to broken payment processes
          </h2>
          <p className="mt-4 mx-auto max-w-md text-[15px] text-vektrum-muted">
            30 days free. No credit card at signup. Funder pays when funding starts.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/auth/signup"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Create your account
              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-vektrum-border bg-vektrum-surface px-7 py-3 text-[14px] font-semibold text-vektrum-muted shadow-sm hover:bg-vektrum-surface-alt hover:border-vektrum-blue/40 transition-all"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
