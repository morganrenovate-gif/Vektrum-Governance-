import Link from 'next/link'
import { VektrumWordmark } from '@/components/ui/vektrum-logo'
import { Shield, CheckCircle2, FileText, Brain, Banknote, Users, AlertTriangle, ArrowDown } from 'lucide-react'

// ISR: re-render at most every hour. Public marketing — no per-user data.
export const revalidate = 3600


export const metadata = {
  title: 'How It Works',
  description:
    'See how Vektrum enforces construction draw releases: AI-assisted draw review, a deterministic 10-condition release gate, and an append-only, hash-chained, tamper-evident audit trail. AI informs; the gate decides; the funder authorizes.',
  alternates: { canonical: 'https://vektrum.io/demo' },
  openGraph: {
    title: 'How Vektrum Works — Construction Payment Governance',
    description: 'AI-assisted draw review. 10-condition gate. Append-only, tamper-evident audit trail. AI informs; the gate decides; the funder authorizes.',
    url: 'https://vektrum.io/demo',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    title: 'How Vektrum Works',
    description: 'AI draw review, 10-condition gate, append-only hash-chained tamper-evident audit trail. AI informs; the gate decides.',
  },
}

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-vektrum-bg">
      {/* ── Section 1: Hero ───────────────────────────────────────────────── */}
      <section className="relative bg-vektrum-canvas overflow-hidden">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28 text-center">
          <div className="flex justify-center mb-6">
            <VektrumWordmark markSize={40} dark showTagline />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300 mb-6">
            AI-assisted draw review with multi-provider fallback
          </p>
          <div className="mx-auto h-px w-16 bg-vektrum-blue mb-8" />
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
            Every Construction Dollar,{' '}
            <br className="hidden sm:block" />
            Verified Before Release.
          </h1>
          <p className="mt-6 mx-auto max-w-2xl text-base sm:text-lg text-vektrum-canvas-text/70">
            Built for the multi-trillion-dollar U.S. construction disbursement market —
            an AI Draw Control Brief precondition, a 10-condition server-side release gate, and
            an append-only, hash-chained, tamper-evident audit trail.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-lg bg-vektrum-blue px-6 py-3 text-sm font-semibold text-white shadow-blue hover:bg-vektrum-blue-hover transition-colors"
            >
              See How It Works
              <ArrowDown size={14} aria-hidden="true" />
            </a>
            <a
              href="#ai-integration"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              View Live Demo
            </a>
          </div>
        </div>
      </section>

      {/* ── Section 2: The Problem ────────────────────────────────────────── */}
      <section className="bg-[#031226] py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-white mb-4">
            Why release authorization needs structure
          </h2>
          <p className="text-center text-sm text-white/70 mb-10 max-w-xl mx-auto">
            Construction draw governance is fragmented. Industry research describes the structural
            patterns below — see source links beneath each card.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                stat: '12%',
                desc: 'of construction draw requests are denied — 355,890 draws across nearly 30,000 loans',
                icon: AlertTriangle,
                sourceLabel: 'FDIC, Bank Monitoring with On-Site Inspections (2022, updated 2023)',
                sourceHref: '/resources/construction-dispute-isolation#source-1',
              },
              {
                stat: '$250K',
                desc: 'median loss per occupational fraud case in construction',
                icon: Users,
                sourceLabel: 'ACFE, Occupational Fraud 2024: A Report to the Nations',
                sourceHref: null,
              },
              {
                stat: 'Fragmented',
                desc: 'most draw workflows still rely on spreadsheets, email, and workflow tools rather than server-enforced release authorization',
                icon: Shield,
                sourceLabel: 'Bank Director, How Spreadsheets Add Risk to Construction Lending (2019)',
                sourceHref: '/resources/construction-dispute-isolation#source-3',
              },
            ].map((item) => (
              <div
                key={item.stat}
                className="rounded-xl border border-white/[0.08] bg-surface-2 p-6 text-center shadow-sm flex flex-col"
              >
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-vektrum-blue/10">
                  <item.icon size={18} className="text-blue-300" aria-hidden="true" />
                </div>
                <p className="font-display text-3xl font-bold text-white">{item.stat}</p>
                <p className="mt-2 text-sm text-white/70 flex-1">{item.desc}</p>
                <p className="mt-3 pt-3 border-t border-white/[0.06] text-[11px] text-white/45 leading-snug">
                  {item.sourceHref ? (
                    <Link href={item.sourceHref} className="hover:text-blue-300 transition-colors">
                      Source: {item.sourceLabel} →
                    </Link>
                  ) : (
                    <>Source: {item.sourceLabel}</>
                  )}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-[11.5px] text-white/40 leading-relaxed max-w-2xl mx-auto">
            Numbers describe industry context, not Vektrum performance. Vektrum does not claim to
            prevent fraud, eliminate disputes, or guarantee compliance — see the{' '}
            <Link href="/resources/construction-dispute-isolation#sources" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
              full Sources section
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── Section 3: How It Works — 5-Step Flow ─────────────────────────── */}
      <section id="how-it-works" className="bg-surface-2 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-white mb-4">
            How It Works
          </h2>
          <p className="text-center text-sm text-white/75 mb-12 max-w-xl mx-auto">
            From deal creation to fund release — every step verified, every dollar governed.
          </p>
          <div className="space-y-8 sm:space-y-0 sm:grid sm:grid-cols-5 sm:gap-4">
            {[
              {
                step: 1,
                title: 'Deal Created',
                desc: 'Deal funded — capital held by Stripe Connect or the customer\'s institutional payment partner, not by Vektrum.',
                icon: Banknote,
              },
              {
                step: 2,
                title: 'Milestones Set',
                desc: 'Work stages defined with amounts, descriptions, required documentation',
                icon: FileText,
              },
              {
                step: 3,
                title: 'Work Completed',
                desc: 'Contractor uploads evidence (photos, invoices, inspection reports)',
                icon: CheckCircle2,
              },
              {
                step: 4,
                title: 'AI Pre-Review',
                desc: 'AI pre-review analyzes documentation against milestone criteria and flags risks. AI informs the gate; the deterministic gate decides; the funder authorizes.',
                icon: Brain,
              },
              {
                step: 5,
                title: 'Release Authorized & Executed',
                desc: 'The 10-condition gate verifies ALL requirements. The funder authorizes; the selected rail (Stripe Connect or institutional partner) executes payment.',
                icon: Shield,
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vektrum-blue text-white font-display text-lg font-bold mb-3">
                  {item.step}
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
                <p className="text-[13px] text-white/75 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: AI Draw Review Integration ─────────────────────────── */}
      <section id="ai-integration" className="bg-vektrum-canvas py-16 sm:py-20 border-y-4 border-vektrum-blue/20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/[0.08] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-300">
              Required precondition before the gate
            </span>
          </div>
          <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-white mb-4">
            AI Draw Control Brief
          </h2>
          <p className="text-center text-sm text-vektrum-canvas-text/80 mb-3 max-w-2xl mx-auto">
            Before the 10-condition release gate evaluates a draw, the AI Draw Control Brief reads
            the submitted evidence and prepares a structured finding for the funder. The brief is
            a precondition — it is <strong className="text-white">separate from</strong> the
            numbered server-side conditions enforced by the gate.
          </p>
          <p className="text-center text-[12px] text-vektrum-canvas-text/60 mb-12 max-w-2xl mx-auto italic">
            AI pre-review informs the gate. The deterministic gate and funder control release.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* Left: Explanation */}
            <div className="space-y-6">
              {[
                'Before the release gate evaluates a draw, the AI pre-review reads the submitted evidence against the deal context.',
                'The pre-review scores completeness 0\u2013100, flags risk factors, and issues a structured pre-review finding: Ready, Hold, or Insufficient evidence. AI does not approve payment \u2014 the deterministic gate enforces conditions and the funder authorizes release.',
                'Every assessment is cryptographically logged to an append-only audit trail \u2014 hash-chained and tamper-evident.',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-vektrum-blue/20">
                    <CheckCircle2 size={14} className="text-blue-300" aria-hidden="true" />
                  </div>
                  <p className="text-sm text-vektrum-canvas-text leading-relaxed">{text}</p>
                </div>
              ))}
            </div>

            {/* Right: Mock DrawReviewAgent */}
            <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
                <Shield size={16} className="text-blue-300" aria-hidden="true" />
                <span className="text-sm font-semibold text-white">AI Pre-Review</span>
                <span className="inline-flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle2 size={12} aria-hidden="true" />
                  Reviewed
                </span>
              </div>

              {/* Score row */}
              <div className="px-5 py-3 flex flex-wrap items-center gap-4 border-b border-white/10">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/75">Completeness</p>
                  <p className="text-lg font-bold tabular-nums text-white">91/100</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/75">Risk</p>
                  <span className="inline-block rounded px-2 py-0.5 text-xs font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    low
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/75">Pre-review finding</p>
                  <span className="inline-block rounded px-2 py-0.5 text-xs font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    ready
                  </span>
                </div>
              </div>

              {/* Reasoning */}
              <div className="px-5 py-3 border-b border-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/75 mb-1">Reasoning</p>
                <p className="text-sm text-white/70">
                  Foundation work is well-documented with 4 supporting documents including an
                  inspection report. Amount aligns with scope and no outstanding disputes.
                </p>
              </div>

              {/* Findings */}
              <div className="px-5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/75 mb-2">Findings</p>
                <ul className="space-y-1.5">
                  {[
                    '4 supporting documents on file including inspection report',
                    'Amount ($45,000) aligns with agreed milestone scope',
                    'Deal status is active with no outstanding disputes',
                  ].map((finding, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/40" aria-hidden="true" />
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: The 10-Condition Release Gate ───────────────────────── */}
      <section className="bg-[#0D1B2A] py-16 sm:py-20 border-t-4 border-vektrum-blue/30">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-vektrum-blue/30 bg-vektrum-blue/[0.08] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-300">
              Deterministic — server-enforced
            </span>
          </div>
          <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-white mb-4">
            The 10-Condition Release Gate
          </h2>
          <p className="text-center text-sm text-white/70 mb-2 max-w-xl mx-auto">
            All <strong className="text-white">10 server-side conditions</strong> must pass before
            a release is authorized.
          </p>
          <p className="text-center text-[12px] text-white/50 mb-10 max-w-xl mx-auto italic">
            The AI Draw Control Brief above is a separate precondition — it is not one of the
            10 numbered conditions.
          </p>
          <div className="mx-auto max-w-xl rounded-xl border border-white/[0.08] bg-surface-2 p-6 shadow-md">
            <ul className="space-y-3">
              {[
                'Milestone status: approved',
                'Milestone protection status: ready_for_release',
                'Sufficient funding or external funding confirmation',
                'Payout readiness verified for selected rail',
                'Contractor onboarding complete where required',
                'No existing active release for this milestone',
                'No open change orders on this milestone',
                'Signed contract on file for this deal',
                'Sequential-release ordering and prerequisites satisfied where required',
                'Approved conditional lien waiver on file where required',
              ].map((condition, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm text-white">{condition}</span>
                </li>
              ))}
              {/* AI precondition */}
              <li className="flex items-center gap-3 pt-2 border-t border-white/[0.05]">
                <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-vektrum-blue text-white flex-shrink-0">
                  <span className="text-[8px] font-bold">+</span>
                </div>
                <span className="text-sm font-semibold text-blue-300">
                  AI-assisted draw review: current, documented, and no unresolved critical risk.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>


      {/* ── Section 7: CTA ────────────────────────────────────────────────── */}
      <section className="bg-vektrum-canvas py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-8">
            Ready to govern your next project?
          </h2>
          {/* Pricing snapshot */}
          <div className="mb-10 mx-auto max-w-lg rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/75">Pricing — v2.0</p>
            </div>
            <div className="divide-y divide-white/10">
              {[
                ['Standalone', '1.0% Vektrum Compliance Review Fee per verified disbursement', '$0 monthly'],
                ['Institutional', '0.70% CRF + 0.075% ACV governance retainer', 'From $5K/yr'],
                ['Enterprise', '0.65% CRF + negotiated retainer', 'Custom'],
              ].map(([tier, desc, price]) => (
                <div key={tier} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div>
                    <p className="text-[13px] font-semibold text-white">{tier}</p>
                    <p className="text-[12px] text-white/70">{desc}</p>
                  </div>
                  <span className="text-[12px] font-semibold text-blue-300-subtle whitespace-nowrap">{price}</span>
                </div>
              ))}
              <div className="px-5 py-3">
                <p className="text-[12px] font-semibold text-emerald-400">Contractors: Always $0. No subscription. No fees. Ever.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-vektrum-blue px-8 py-3 text-sm font-semibold text-white shadow-blue hover:bg-vektrum-blue-hover transition-colors"
            >
              Get started — it&apos;s free
            </Link>
            <Link
              href="mailto:operations@vektrum.io"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-8 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Contact operations@vektrum.io
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/75">
            <span>AI draw review: multi-provider with fallback chain</span>
            <span className="hidden sm:inline">|</span>
            <span>Next.js 15</span>
            <span className="hidden sm:inline">|</span>
            <span>Supabase</span>
            <span className="hidden sm:inline">|</span>
            <span>Stripe Connect</span>
          </div>
        </div>
      </section>
    </main>
  )
}
