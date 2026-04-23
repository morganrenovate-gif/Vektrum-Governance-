import Link from 'next/link'
import { VektrumWordmark } from '@/components/ui/vektrum-logo'
import { Shield, CheckCircle2, FileText, Brain, Banknote, Users, AlertTriangle, ArrowDown } from 'lucide-react'

export const metadata = {
  title: 'Vektrum — Every Construction Dollar, Governed by AI',
  description: 'AI-verified milestone disbursements and immutable audit trails for construction payment governance.',
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-vektrum-blue mb-6">
            Powered by Perplexity AI
          </p>
          <div className="mx-auto h-px w-16 bg-vektrum-blue mb-8" />
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
            Every Construction Dollar,{' '}
            <br className="hidden sm:block" />
            Governed by AI.
          </h1>
          <p className="mt-6 mx-auto max-w-2xl text-base sm:text-lg text-vektrum-canvas-text/70">
            Vektrum protects $2.19T in annual U.S. construction spend with AI-verified
            milestone disbursements and immutable audit trails.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-lg bg-vektrum-blue px-6 py-3 text-sm font-semibold text-white shadow-blue hover:bg-vektrum-blue-hover transition-colors"
            >
              See How It Works
              <ArrowDown size={14} />
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
      <section className="bg-vektrum-bg py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-white mb-4">
            The Problem
          </h2>
          <p className="text-center text-sm text-white/55 mb-10 max-w-xl mx-auto">
            Construction payment governance is broken. The industry loses billions every year.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                stat: '$3.1B',
                desc: 'lost annually to contractor fraud and payment disputes',
                icon: AlertTriangle,
              },
              {
                stat: '87%',
                desc: 'of construction projects have payment timing conflicts',
                icon: Users,
              },
              {
                stat: 'Zero',
                desc: 'industry-standard solution for milestone-based disbursement',
                icon: Shield,
              },
            ].map((item) => (
              <div
                key={item.stat}
                className="rounded-xl border border-white/[0.08] bg-surface-2 p-6 text-center shadow-sm"
              >
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-vektrum-blue/10">
                  <item.icon size={18} className="text-vektrum-blue" />
                </div>
                <p className="font-display text-3xl font-bold text-white">{item.stat}</p>
                <p className="mt-2 text-sm text-white/55">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: How It Works — 5-Step Flow ─────────────────────────── */}
      <section id="how-it-works" className="bg-surface-2 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-white mb-4">
            How It Works
          </h2>
          <p className="text-center text-sm text-white/55 mb-12 max-w-xl mx-auto">
            From deal creation to fund release — every step verified, every dollar governed.
          </p>
          <div className="space-y-8 sm:space-y-0 sm:grid sm:grid-cols-5 sm:gap-4">
            {[
              {
                step: 1,
                title: 'Deal Created',
                desc: 'Funder deposits funds into Project Trust Account',
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
                title: 'AI Reviews Draw',
                desc: 'Perplexity AI analyzes documentation against milestone criteria, flags risks',
                icon: Brain,
              },
              {
                step: 5,
                title: 'Funds Released',
                desc: '8-condition gate verifies ALL requirements. Funds disbursed instantly.',
                icon: Shield,
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vektrum-blue text-white font-display text-lg font-bold mb-3">
                  {item.step}
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
                <p className="text-xs text-white/55 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: Perplexity AI Integration ──────────────────────────── */}
      <section id="ai-integration" className="bg-vektrum-canvas py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-white mb-4">
            Perplexity AI is the Governor of Every Dollar
          </h2>
          <p className="text-center text-sm text-vektrum-canvas-text/60 mb-12 max-w-2xl mx-auto">
            Before any milestone payment releases, Perplexity Sonar AI evaluates the evidence and issues a formal assessment.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* Left: Explanation */}
            <div className="space-y-6">
              {[
                'Before any milestone payment releases, Perplexity Sonar AI reviews the submitted evidence against the deal context.',
                'The AI scores the draw request 0\u2013100, flags risk factors, and issues a formal recommendation: Approve, Hold, or Reject.',
                'This assessment is cryptographically logged to an immutable audit trail \u2014 permanent, tamper-proof, legally defensible.',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-vektrum-blue/20">
                    <CheckCircle2 size={14} className="text-vektrum-blue" />
                  </div>
                  <p className="text-sm text-vektrum-canvas-text/80 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>

            {/* Right: Mock DrawReviewAgent */}
            <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
                <Shield size={16} className="text-vektrum-blue" />
                <span className="text-sm font-semibold text-white">AI Draw Review</span>
                <span className="inline-flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle2 size={12} />
                  Reviewed
                </span>
              </div>

              {/* Score row */}
              <div className="px-5 py-3 flex flex-wrap items-center gap-4 border-b border-white/10">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Score</p>
                  <p className="text-lg font-bold tabular-nums text-white">91/100</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Risk</p>
                  <span className="inline-block rounded px-2 py-0.5 text-xs font-bold uppercase bg-green-50 text-green-700">
                    low
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Recommendation</p>
                  <span className="inline-block rounded px-2 py-0.5 text-xs font-bold uppercase bg-green-50 text-green-700">
                    approve
                  </span>
                </div>
              </div>

              {/* Reasoning */}
              <div className="px-5 py-3 border-b border-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1">Reasoning</p>
                <p className="text-sm text-white/70">
                  Foundation work is well-documented with 4 supporting documents including an
                  inspection report. Amount aligns with scope and no outstanding disputes.
                </p>
              </div>

              {/* Findings */}
              <div className="px-5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-2">Findings</p>
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

      {/* ── Section 5: The 8-Condition Release Gate ────────────────────────── */}
      <section className="bg-vektrum-bg py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-white mb-4">
            The Release Gate
          </h2>
          <p className="text-center text-sm text-white/55 mb-10 max-w-xl mx-auto">
            ALL 8 conditions must be true simultaneously before any payment is released.
          </p>
          <div className="mx-auto max-w-xl rounded-xl border border-white/[0.08] bg-surface-2 p-6 shadow-md">
            <ul className="space-y-3">
              {[
                'Milestone status: approved',
                'Milestone protection status: ready_for_release',
                'Sufficient funded balance (including platform fee)',
                'Contractor Stripe payouts enabled',
                'Contractor onboarding complete',
                'No existing active release for this milestone',
                'No open change orders on this milestone',
                'Signed contract on file for this deal',
              ].map((condition, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-white">{condition}</span>
                </li>
              ))}
              {/* AI precondition */}
              <li className="flex items-center gap-3 pt-2 border-t border-white/[0.05]">
                <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-vektrum-blue text-white flex-shrink-0">
                  <span className="text-[8px] font-bold">+</span>
                </div>
                <span className="text-sm font-semibold text-vektrum-blue">
                  AI Draw Review: score &ge; 40, risk &lt; critical, assessment &lt; 48h old
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Section 6: Market Opportunity ──────────────────────────────────── */}
      <section className="bg-surface-2 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-2">
            Market Opportunity
          </h2>
          <p className="font-display text-5xl sm:text-6xl font-bold text-vektrum-blue mt-4 mb-2">
            $2.19 Trillion
          </p>
          <p className="text-sm text-white/55 mb-10">Annual U.S. Construction Spend</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            {[
              { value: '$3.1B', label: 'lost to fraud annually' },
              { value: '87%', label: 'of projects have payment disputes' },
              { value: 'Zero', label: 'standard solution exists' },
            ].map((item) => (
              <div key={item.value} className="rounded-lg border border-white/[0.08] bg-vektrum-bg p-4">
                <p className="font-display text-2xl font-bold text-white">{item.value}</p>
                <p className="mt-1 text-xs text-white/55">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto max-w-md rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-vektrum-blue mb-3">
              {"Vektrum's Total Addressable Market"}
            </p>
            <div className="space-y-2 text-left">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/55">SAM</span>
                <span className="font-display text-lg font-bold text-white">$500B</span>
              </div>
              <p className="text-xs text-white/30">Commercial + residential new construction</p>
              <div className="h-px bg-vektrum-blue-border" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/55">SOM Year 1</span>
                <span className="font-display text-lg font-bold text-white">$50M</span>
              </div>
              <p className="text-xs text-white/30">Targeting 5,000 funder-managed projects</p>
            </div>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/40">Pricing — v2.0</p>
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
                    <p className="text-[11px] text-white/50">{desc}</p>
                  </div>
                  <span className="text-[12px] font-semibold text-vektrum-blue-subtle whitespace-nowrap">{price}</span>
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
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/40">
            <span>Built on Perplexity AI</span>
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
