import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  Banknote,
  Shield,
  FileText,
  Clock,
} from 'lucide-react'

export const metadata = {
  title: 'For Contractors — Vektrum',
  description:
    'Get paid when you deliver — not 90 days later. Milestone-based payouts, dispute isolation, and immutable proof of approved work. Always free for contractors.',
}

export default function ContractorsPage() {
  return (
    <div className="flex flex-col">
      {/* ─── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0D1B2A] pt-20 pb-16 sm:pt-28 sm:pb-20">
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
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface-2 px-4 py-1.5 shadow-sm mb-8">
            <div className="h-1.5 w-1.5 rounded-full bg-vektrum-green animate-pulse-slow" />
            <span className="text-[12px] font-medium text-white/70 tracking-wide">
              Always free for contractors
            </span>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-[-0.035em] text-white sm:text-5xl text-balance">
            Get paid when you deliver.
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-[17px] leading-relaxed text-white/70">
            No more 90-day net terms. No more chasing invoices. Vektrum releases
            milestone payments directly to your bank the moment work is approved.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/auth/signup"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Join free
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <p className="mt-4 text-[12px] text-white/45">
            No subscription. No per-milestone charge. No onboarding fee.
          </p>
        </div>
      </section>

      {/* ─── Benefits ──────────────────────────────────────────────────────── */}
      <section className="bg-surface-0 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Banknote,
                title: 'Milestone payouts',
                desc: 'Funds release per milestone — not at project close. Direct deposit via Stripe Connect.',
              },
              {
                icon: Shield,
                title: 'Dispute isolation',
                desc: 'A dispute on one milestone never freezes the others. Your cash flow stays intact.',
              },
              {
                icon: FileText,
                title: 'Proof of approval',
                desc: 'Immutable record that your work was reviewed and approved. Permanent and tamper-proof.',
              },
              {
                icon: Clock,
                title: 'No more waiting',
                desc: 'When work is verified and the funder approves, funds transfer immediately. No 90-day hold.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/[0.08] bg-surface-2 p-8 hover:border-vektrum-blue/40 hover:shadow-lg hover:shadow-vektrum-blue/5 transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-blue/10 mb-5">
                  <item.icon size={20} className="text-vektrum-blue" />
                </div>
                <h3 className="text-[15px] font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-white/55">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ──────────────────────────────────────────────────── */}
      <section className="bg-surface-2 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl text-center mb-12">
            How it works for contractors
          </h2>
          <ol className="space-y-6">
            {[
              'You receive an invite from your funder to join a deal on Vektrum.',
              'Set up your Stripe Connect account for direct deposit — takes minutes.',
              'Complete milestones and submit draw requests with supporting documentation.',
              'The funder reviews and approves. The 8-condition gate verifies everything server-side.',
              'Funds deposit directly to your bank. Immutable audit trail confirms every release.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-vektrum-blue text-[12px] font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-[14px] leading-relaxed text-white/70 pt-0.5">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── Always free ───────────────────────────────────────────────────── */}
      <section className="bg-surface-2 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-8 sm:p-10">
            <div className="flex items-start gap-4">
              <CheckCircle2 size={24} className="flex-shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <h3 className="text-lg font-bold text-white">Contractors always join free</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                  Vektrum charges the funder — never the contractor. No subscription fees,
                  no per-milestone charges, no onboarding costs. You get paid to build.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.08] bg-surface-2 py-20 sm:py-24">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl text-balance">
            Start getting paid on time
          </h2>
          <p className="mt-4 mx-auto max-w-md text-[15px] text-white/55">
            Join when your funder invites you — or create your account now and be ready.
          </p>
          <div className="mt-8">
            <Link
              href="/auth/signup"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Create your free account
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
