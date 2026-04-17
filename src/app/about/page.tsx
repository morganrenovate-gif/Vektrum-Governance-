import Link from 'next/link'
import { ArrowRight, Shield, Lock, GitBranch } from 'lucide-react'

export const metadata = {
  title: 'About — Vektrum',
  description:
    'Vektrum is a construction payment governance platform. We protect milestone-based disbursements with server-enforced release gates and immutable audit trails.',
}

export default function AboutPage() {
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
          <h1 className="font-display text-4xl font-bold tracking-[-0.035em] text-vektrum-text sm:text-5xl text-balance">
            Construction payment governance.
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-[17px] leading-relaxed text-vektrum-muted">
            Vektrum protects every dollar in a construction deal. Funds release only
            when work is verified, disputes isolate to one milestone, and every
            action is permanently audited.
          </p>
        </div>
      </section>

      {/* ─── Mission ───────────────────────────────────────────────────────── */}
      <section className="bg-vektrum-surface py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-3xl mb-6">
            Why Vektrum exists
          </h2>
          <div className="space-y-4 text-[15px] leading-relaxed text-vektrum-muted">
            <p>
              Construction is a $2.19 trillion annual industry in the United States. Yet
              payment governance in the $500K&ndash;$25M project range is still managed
              through spreadsheets, email threads, and manual bank transfers.
            </p>
            <p>
              A $15K dispute on a $9M project can freeze the entire deal. Contractors
              wait 90 days for payment. Lenders have no automated way to enforce
              disbursement conditions. There is no industry-standard solution for
              milestone-based payment governance.
            </p>
            <p>
              Vektrum fills that gap. We built a platform where every milestone is an
              independent financial unit, every release passes 7 server-side conditions,
              and every action is recorded in an immutable audit trail.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Principles ────────────────────────────────────────────────────── */}
      <section className="bg-vektrum-bg py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-3xl text-center mb-12">
            Core principles
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: Shield,
                title: 'Governance, not custody',
                desc: 'Vektrum governs disbursement rules. Stripe holds the funds. We never touch your money.',
              },
              {
                icon: Lock,
                title: 'Isolation by default',
                desc: 'Every milestone is independent. A dispute on one never freezes another. Cash flow is protected.',
              },
              {
                icon: GitBranch,
                title: 'Permanent record',
                desc: 'No update. No delete. Every status change, approval, and payment is logged forever.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-8"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-blue/10 mb-5">
                  <item.icon size={20} className="text-vektrum-blue" />
                </div>
                <h3 className="text-[15px] font-semibold text-vektrum-text">{item.title}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-vektrum-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────────────── */}
      <section className="border-t border-vektrum-border bg-vektrum-surface py-20 sm:py-24">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-3xl text-balance">
            Protect your next deal
          </h2>
          <p className="mt-4 mx-auto max-w-md text-[15px] text-vektrum-muted">
            Contractors join free. Funders start with a standalone project or contact us
            for institutional onboarding.
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
