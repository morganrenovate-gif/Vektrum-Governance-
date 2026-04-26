import Link from 'next/link'
import { BOOK_CALL_URL, BOOK_CALL_EXTERNAL } from '@/lib/book-call'
import {
  ArrowRight,
  HelpCircle,
  Shield,
  Banknote,
  FileText,
  Users,
  AlertCircle,
  Lock,
} from 'lucide-react'

export const metadata = {
  title: 'Help — Vektrum',
  description:
    'Frequently asked questions about Vektrum construction payment governance. Learn how milestone payments, the release gate, disputes, and Stripe Connect work.',
}

interface FaqItem {
  q: string
  a: string
}

const TRUST_FAQ: FaqItem[] = [
  {
    q: 'Is Vektrum a payment processor?',
    a: 'No. Vektrum is a conditional authorization and audit layer. Payment execution happens through Stripe Connect or the customer\'s existing title, escrow, treasury, or banking process.',
  },
  {
    q: 'Does Vektrum hold funds?',
    a: 'Vektrum does not hold funds in its own bank account or act as escrow. For Stripe Connect releases, payment execution runs through Stripe Connect infrastructure. For external/manual releases, payment is executed outside Vektrum by the funder, title company, escrow company, or treasury process.',
  },
  {
    q: 'Does every customer need to use Stripe?',
    a: 'No. Stripe Connect is available for automated execution, especially for direct/private lending workflows. Institutional customers can use external/manual execution through their existing payment process.',
  },
  {
    q: 'Does Vektrum replace title or escrow companies?',
    a: 'No. Vektrum can give title and escrow teams a release authorization and audit layer before they execute disbursements.',
  },
  {
    q: 'Does AI approve releases?',
    a: 'No. AI-assisted review flags missing documents, conflicts, and risk signals. The funder triggers release, and the deterministic release gate enforces whether release is allowed.',
  },
  {
    q: 'Can admins release funds?',
    a: 'No. Admins cannot trigger milestone releases. Privileged admin actions require AAL2 MFA, justification, and audit logging.',
  },
  {
    q: 'What happens if a condition fails?',
    a: 'The release is blocked until the issue is resolved. The system records the failed gate evaluation for audit visibility.',
  },
  {
    q: 'What happens if Vektrum shuts down?',
    a: 'Payment execution remains with Stripe Connect or the customer-controlled payment process. Vektrum\'s role is authorization, audit, and recordkeeping. Customers can export deal and audit records.',
  },
]

const FAQ: FaqItem[] = [
  {
    q: 'What is Vektrum?',
    a: 'Vektrum is a construction payment governance platform. We enforce milestone-based disbursement rules so funds release only when work is verified. Vektrum governs the release process — Stripe holds the funds.',
  },
  {
    q: 'Does Vektrum hold my money?',
    a: 'No. Vektrum does not hold funds in its own bank account or act as escrow. For Stripe Connect releases, payment execution runs through Stripe Connect infrastructure — funds are held in Stripe-managed accounts. For external/manual releases, payment is executed outside Vektrum by the funder, title company, escrow company, or partner treasury process. Vektrum governs authorization and records proof.',
  },
  {
    q: 'How does Vektrum work with institutional payment partners?',
    a: 'For deals using an institutional partner (title company, escrow company, construction loan servicer, or treasury team), the partner executes payment through its existing process. Vektrum authorizes or blocks the release and records confirmation, reference, proof, actor, timestamp, and audit trail. Stripe Connect is not required for these deals.',
  },
  {
    q: 'What is the 10-condition release gate?',
    a: 'Before any milestone payment releases, 10 server-side conditions must all be true simultaneously: (1) milestone approved by the funder, (2) milestone cleared and eligible for release, (3) sufficient funded balance including the platform fee, (4) contractor payment account verified and active, (5) contractor onboarding complete, (6) no duplicate release on this milestone, (7) no pending change orders, (8) a fully-signed contract on file, (9) sequential-release ordering and explicit prerequisites satisfied (where required), and (10) an approved conditional lien waiver on file (where required). A separate AI-assisted draw review precondition runs independently before the gate.',
  },
  {
    q: 'How does dispute isolation work?',
    a: 'Each milestone is an independent financial unit. If a dispute is raised on one milestone, only that milestone is locked. All other milestones in the deal continue to flow normally.',
  },
  {
    q: 'Is Vektrum free for contractors?',
    a: 'Yes. Contractors always join free. No subscription, no per-milestone charge, no onboarding fee. The funder pays the Vektrum Compliance Review Fee when funds are disbursed.',
  },
  {
    q: 'How do funders get charged?',
    a: 'Vektrum uses a hybrid pricing model: a governance retainer (annual, based on portfolio size) plus a Vektrum Compliance Review Fee (per verified disbursement). Standalone projects have no retainer — pure performance pricing.',
  },
  {
    q: 'What happens if there is a dispute?',
    a: 'The disputed milestone is locked and enters Vektrum dispute management. Both parties can submit evidence. The dispute is isolated — it does not affect any other milestone in the deal.',
  },
  {
    q: 'How do I get started?',
    a: 'Sign up for a free account — it takes under a minute. Contractors can create an account anytime and get added to deals by their funder. Funders can create a standalone project immediately or contact us for institutional onboarding.',
  },
]

export default function HelpPage() {
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
            <HelpCircle size={14} className="text-vektrum-blue" />
            <span className="text-[12px] font-medium text-white/55 tracking-wide">
              Help center
            </span>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-[-0.035em] text-white sm:text-5xl text-balance">
            Frequently asked questions
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-[17px] leading-relaxed text-white/55">
            Everything you need to know about Vektrum, milestone payments, and
            construction payment governance.
          </p>
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#0A1628] py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="space-y-4">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-white/[0.08] bg-surface-2 p-6"
              >
                <h3 className="text-[15px] font-semibold text-white">{item.q}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/55">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Trust & Compliance FAQ ─────────────────────────────────────────── */}
      <section className="bg-surface-2 py-16 sm:py-20 border-t border-white/[0.08]">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="mb-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/65 mb-2">
              Trust &amp; Compliance
            </p>
            <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-white">
              Common questions from institutional buyers
            </h2>
          </div>
          <div className="space-y-3">
            {TRUST_FAQ.map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-white/[0.08] bg-surface-3 p-6"
              >
                <h3 className="text-[14px] font-semibold text-white">{item.q}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/70">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Contact ───────────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.08] bg-surface-2 py-20 sm:py-24">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl text-balance">
            Still have questions?
          </h2>
          <p className="mt-4 mx-auto max-w-md text-[15px] text-white/55">
            Reach out to our team and we will get back to you.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href={BOOK_CALL_URL}
              {...(BOOK_CALL_EXTERNAL ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Book a call
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/demo-live"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/[0.08] bg-surface-2 px-7 py-3 text-[14px] font-semibold text-white/55 shadow-sm hover:bg-surface-3 hover:border-vektrum-blue/40 transition-all"
            >
              Try the demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
