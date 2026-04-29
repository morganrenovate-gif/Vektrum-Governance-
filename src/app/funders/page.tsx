import Link from 'next/link'
import { BOOK_CALL_URL, BOOK_CALL_EXTERNAL } from '@/lib/book-call'
import {
  ArrowRight,
  CheckCircle2,
  Shield,
  BarChart3,
  FileText,
  Lock,
  CreditCard,
  Building2,
} from 'lucide-react'

export const metadata = {
  title: 'For Funders & Capital Partners',
  description:
    'Conditional authorization infrastructure for construction lenders. 10-condition release gate, AI-assisted draw review, and immutable audit trail. Vektrum enforces your release conditions — your payment rail executes.',
  alternates: { canonical: 'https://vektrum.io/funders' },
  openGraph: {
    title: 'For Funders & Capital Partners — Vektrum',
    description: 'Conditional authorization infrastructure for construction lenders. 10-condition release gate enforces your conditions. Your rail executes.',
    url: 'https://vektrum.io/funders',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    title: 'For Funders & Capital Partners — Vektrum',
    description: '10-condition release gate for construction lenders. Your draw process, enforced.',
  },
}

export default function FundersPage() {
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
              For funders &amp; capital partners
            </span>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-[-0.035em] text-white sm:text-5xl text-balance">
            Your draw process, systematized.
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-[17px] leading-relaxed text-white/70">
            Stop managing draws in spreadsheets and email threads. Vektrum enforces
            your release conditions server-side, audits every disbursement, and gives
            you portfolio-level visibility.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/auth/signup"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Get started
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/[0.08] bg-surface-2 px-7 py-3 text-[14px] font-semibold text-white/55 shadow-sm hover:bg-surface-3 hover:border-vektrum-blue/40 transition-all"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Quick answer + non-custody trust ─────────────────────────────── */}
      <section className="bg-[#0D1B2A] pb-10 border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          {/* Non-custody trust strip */}
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 px-5 py-4 mb-8 flex items-start gap-3">
            <Shield size={15} className="text-blue-300 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] leading-relaxed text-white/70">
              <span className="font-semibold text-white">Vektrum does not hold funds, act as escrow, or execute wires.</span>{' '}
              For Stripe Connect deals, funds are held in Stripe-managed accounts. For institutional deals, your existing bank, title company, escrow company, or treasury executes payment. Vektrum enforces release conditions and records authorization proof.
            </p>
          </div>
          {/* Quick Answer */}
          <p className="text-[15px] leading-relaxed text-white/70 max-w-3xl">
            <strong className="text-white">What Vektrum does for funders:</strong>{' '}
            Before any disbursement is authorized, Vektrum evaluates 10 server-side conditions simultaneously — milestone approved, contract signed, lien waiver on file, change orders cleared, and more. Only when all pass does Vektrum issue an authorization signal. Your selected rail then executes. You keep your payment process. You add release enforcement.
          </p>
        </div>
      </section>

      {/* ─── Benefits ──────────────────────────────────────────────────────── */}
      <section className="bg-surface-0 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Shield,
                title: '10-condition release gate',
                desc: 'Every disbursement passes 10 server-side checks simultaneously before funds move.',
              },
              {
                icon: BarChart3,
                title: 'Portfolio dashboard',
                desc: 'Deal-level release readiness, risk flags, and disbursement status across active projects.',
              },
              {
                icon: FileText,
                title: 'Immutable audit trail',
                desc: 'Every approval, release, and status change recorded in an append-only, hash-chained log with timestamp and actor.',
              },
              {
                icon: Lock,
                title: 'Dispute isolation',
                desc: 'A $15K dispute locks one milestone. The other $8.98M keeps flowing on schedule.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/[0.08] bg-surface-2 p-8 hover:border-vektrum-blue/40 hover:shadow-lg hover:shadow-vektrum-blue/5 transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-blue/10 mb-5">
                  <item.icon size={20} className="text-blue-300" />
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
            How Vektrum works for funders
          </h2>
          <ol className="space-y-6">
            {[
              'Contractor creates a deal with milestones and amounts.',
              'You fund the deal. On Stripe Connect deals, funds are held in Stripe-managed accounts. On external-rail deals, funds are held by your institutional payment partner. Vektrum does not hold funds in either case.',
              'As work completes, contractors submit draw requests with documentation.',
              'You review and approve each milestone. The 10-condition gate enforces your rules.',
              'Approved releases execute via Stripe Connect or — on institutional deals — via your own treasury rail (wire / ACH / check) with Vektrum recording authorization and confirmation. Full audit trail either way.',
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

      {/* ─── Buyer Segments ────────────────────────────────────────────────── */}
      <section className="bg-surface-0 py-16 sm:py-20 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl text-center mb-4">
            Built for every construction capital structure
          </h2>
          <p className="text-center text-[14px] text-white/55 mb-12 max-w-2xl mx-auto">
            Vektrum works with your existing payment infrastructure — whether you run on Stripe Connect or your own institutional rail.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Private Lenders */}
            <div className="rounded-2xl border border-white/[0.08] bg-surface-2 p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-vektrum-blue/10">
                  <CreditCard size={18} className="text-blue-300" />
                </div>
                <h3 className="text-[15px] font-semibold text-white">Private lenders &amp; direct deals</h3>
              </div>
              <p className="text-[13px] leading-relaxed text-white/65 mb-5">
                Best for private lenders, fix-and-flip operators, construction bridge lenders, and direct lending funds who want automated disbursements without existing treasury infrastructure.
              </p>
              <ul className="space-y-2">
                {[
                  'Stripe Connect rail — automated payout to contractor after authorization',
                  '1% governance fee per authorized release, no retainer',
                  'Contractor Stripe onboarding in minutes',
                  'Full draw review, gate enforcement, and audit trail',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[12px] text-white/65">
                    <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Institutional Rails */}
            <div className="rounded-2xl border border-white/[0.08] bg-surface-2 p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-vektrum-blue/10">
                  <Building2 size={18} className="text-blue-300" />
                </div>
                <h3 className="text-[15px] font-semibold text-white">Institutional rails &amp; portfolio lenders</h3>
              </div>
              <p className="text-[13px] leading-relaxed text-white/65 mb-5">
                Best for construction loan servicers, credit funds, banks, title companies, and institutional investors with licensed payment infrastructure who want release-enforcement without changing their payment process.
              </p>
              <ul className="space-y-2">
                {[
                  'External/manual rail — Vektrum authorizes, your rail executes',
                  'No Stripe required — wire, ACH, title disbursement, or check',
                  'Partner API for programmatic confirmation by title/escrow systems',
                  'Annual retainer for portfolio onboarding and dedicated support',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[12px] text-white/65">
                    <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.08] bg-surface-2 py-20 sm:py-24">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl text-balance">
            Ready to systematize your draws?
          </h2>
          <p className="mt-4 mx-auto max-w-md text-[15px] text-white/55">
            Standalone: 1% per release, no annual retainer. Institutional portfolios get dedicated onboarding.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/auth/signup"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Create your account
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={BOOK_CALL_URL}
              {...(BOOK_CALL_EXTERNAL ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/[0.08] bg-surface-2 px-7 py-3 text-[14px] font-semibold text-white/55 shadow-sm hover:bg-surface-3 hover:border-vektrum-blue/40 transition-all"
            >
              Book a call
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
