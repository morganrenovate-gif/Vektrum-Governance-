import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Founders — Vektrum',
  description:
    'Meet the team behind Vektrum. Three operators from construction finance who built the platform they wished existed.',
}

const founders = [
  {
    initials: 'AM',
    name: 'Adam Morgan',
    title: 'Chief Product Officer',
    bio: "Adam spent years on the contractor side watching milestone payments stall in email threads and PDF approval chains. He built the first version of Vektrum's document verification workflow before joining forces with the Walstad brothers. His focus is translating construction finance workflows into product logic — specifically the draw request, compliance check, and release gate that sits at the center of the platform.",
  },
  {
    initials: 'TW',
    name: 'Tanner Walstad',
    title: 'Chief Commercial Officer',
    bio: "Tanner comes from the lending side. He worked with regional banks and credit unions that were manually tracking construction draws in spreadsheets — approving disbursements based on site visit photos emailed in by contractors. That process worked until it didn't. His job at Vektrum is making sure lenders can adopt the platform without disrupting their existing origination workflows, and that the compliance record it produces is one their auditors will accept.",
  },
  {
    initials: 'PW',
    name: 'Phillip Walstad',
    title: 'Board & Strategic Advisor',
    bio: 'Phillip brings the institutional perspective. With a background in construction project finance and real estate capital markets, he advises on the regulatory boundaries that Vektrum must operate within — particularly around fund custody, disbursement authority, and audit trail requirements for federally regulated lenders. He keeps the platform grounded in what the compliance and legal side of the industry will actually accept.',
  },
]

export default function FoundersPage() {
  return (
    <div>
      <section className="relative overflow-hidden bg-vektrum-bg pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(var(--color-vektrum-blue) 1px, transparent 1px), linear-gradient(90deg, var(--color-vektrum-blue) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-vektrum-blue-subtle/50 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div className="relative max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-vektrum-border bg-vektrum-surface px-4 py-1.5 shadow-sm mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-vektrum-green animate-pulse" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-faint">
              The Team
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-4xl lg:text-5xl">
            Built by people who lived the problem
          </h1>
          <p className="mt-6 text-[16px] leading-relaxed text-vektrum-muted max-w-2xl mx-auto">
            Vektrum was not founded by fintech generalists. It was built by operators from construction
            finance who watched the same preventable failures repeat — missed draws, stalled projects,
            lenders approving disbursements on trust instead of verification.
          </p>
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-vektrum-bg" aria-label="Founding team">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {founders.map((founder) => (
              <article
                key={founder.name}
                className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-8 hover:border-vektrum-blue/40 hover:shadow-lg hover:shadow-vektrum-blue/5 transition-all"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-vektrum-blue/10 border border-vektrum-blue/20 mb-6 select-none">
                  <span className="font-display text-[17px] font-bold tracking-tight text-vektrum-blue">
                    {founder.initials}
                  </span>
                </div>
                <h2 className="font-display text-[17px] font-bold text-vektrum-text leading-tight">
                  {founder.name}
                </h2>
                <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-vektrum-faint">
                  {founder.title}
                </p>
                <div className="mt-1 h-px w-8 bg-vektrum-blue/30" aria-hidden="true" />
                <p className="mt-5 text-[14px] leading-relaxed text-vektrum-muted">
                  {founder.bio}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-vektrum-canvas py-20 sm:py-28" aria-label="Origin story">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-faint mb-4">
            How Vektrum started
          </p>
          <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl mb-10">
            Two solutions. One problem. One company.
          </h2>
          <div className="space-y-6 text-[15px] leading-relaxed text-white/70">
            <p>
              Adam and Tanner did not know each other when they each independently decided to build
              software for the same broken process: construction draw disbursement. Adam was approaching
              it from the contractor side — frustrated that projects stalled because lenders had no
              reliable way to verify milestone completion. Tanner was approaching it from inside a
              lender that was approving six-figure disbursements based on unverified photos attached
              to email threads.
            </p>
            <p>
              They were, in effect, building competing products. Adam's first prototype let
              contractors submit milestone documentation through a structured workflow instead of
              informal email. Tanner's let lenders define release conditions and track draw
              status across a portfolio. Neither product was complete. Both pointed at the same gap.
            </p>
            <p>
              When they eventually connected — through a mutual contact in regional construction
              lending — the overlap was immediate and obvious. They merged the two prototypes, brought
              in Phillip for regulatory and capital markets guidance, and rebuilt from scratch as a
              unified governance layer: a single platform where contractors submit, lenders verify,
              and funds release only when the conditions are met. No exceptions. No manual overrides.
              No email threads standing between a contractor and their payment.
            </p>
            <p>
              That is still what Vektrum does. The platform is more complete now — compliance AI,
              immutable audit trails, Stripe Connect fund custody — but the core logic has not
              changed since the first whiteboard session: funds should release when work is verified,
              not when someone decides to trust a photo.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-vektrum-border bg-vektrum-surface py-20 sm:py-24" aria-label="Get started with Vektrum">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-faint mb-4">
            Work with us
          </p>
          <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-3xl mb-4">
            The platform is live. The team is reachable.
          </h2>
          <p className="text-[15px] leading-relaxed text-vektrum-muted mb-10 max-w-xl mx-auto">
            If you're a lender evaluating construction loan software, or a contractor tired of
            payment delays, talk to us directly. No sales funnel, no demo request form routed to an
            SDR. The founders take early calls.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vektrum-blue focus-visible:ring-offset-2"
            >
              Get started
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border border-vektrum-border bg-vektrum-surface px-7 py-3 text-[14px] font-semibold text-vektrum-muted hover:bg-vektrum-surface-alt hover:border-vektrum-blue/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vektrum-blue focus-visible:ring-offset-2"
            >
              Contact the team
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

