import Link from 'next/link'
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

const FAQ: FaqItem[] = [
  {
    q: 'What is Vektrum?',
    a: 'Vektrum is a construction payment governance platform. We enforce milestone-based disbursement rules so funds release only when work is verified. Vektrum governs the release process — Stripe holds the funds.',
  },
  {
    q: 'Does Vektrum hold my money?',
    a: 'No. All funds are held by Stripe via Stripe Connect. Vektrum governs when and how funds are released, but never holds or touches the money directly.',
  },
  {
    q: 'What is the 7-condition release gate?',
    a: 'Before any milestone payment releases, 7 server-side conditions must all be true simultaneously: milestone approved, deal active, no open disputes, sufficient Project Trust Account balance, Stripe account verified, no duplicate release, and integrity check passed.',
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
            <HelpCircle size={14} className="text-vektrum-blue" />
            <span className="text-[12px] font-medium text-vektrum-muted tracking-wide">
              Help center
            </span>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-[-0.035em] text-vektrum-text sm:text-5xl text-balance">
            Frequently asked questions
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-[17px] leading-relaxed text-vektrum-muted">
            Everything you need to know about Vektrum, milestone payments, and
            construction payment governance.
          </p>
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="bg-vektrum-bg py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="space-y-4">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6"
              >
                <h3 className="text-[15px] font-semibold text-vektrum-text">{item.q}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-vektrum-muted">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Contact ───────────────────────────────────────────────────────── */}
      <section className="border-t border-vektrum-border bg-vektrum-surface py-20 sm:py-24">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-3xl text-balance">
            Still have questions?
          </h2>
          <p className="mt-4 mx-auto max-w-md text-[15px] text-vektrum-muted">
            Reach out to our team and we will get back to you.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="mailto:operations@vektrum.io"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Contact us
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-vektrum-border bg-vektrum-surface px-7 py-3 text-[14px] font-semibold text-vektrum-muted shadow-sm hover:bg-vektrum-surface-alt hover:border-vektrum-blue/40 transition-all"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
