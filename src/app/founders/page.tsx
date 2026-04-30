import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Founders — Vektrum',
  description:
    'Meet the team behind Vektrum. Three operators from construction finance who built the platform they wished existed.',
  alternates: { canonical: 'https://vektrum.io/founders' },
  openGraph: {
    title: 'Founders — Vektrum',
    description: 'Three operators from construction finance who built the platform they wished existed.',
    url: 'https://vektrum.io/founders',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    title: 'Founders — Vektrum',
    description: 'Three operators from construction finance who built the platform they wished existed.',
  },
}

const founders = [
  {
    initials: 'AM',
    name: 'Adam Morgan',
    title: 'Co-Founder & Chief Product Officer',
    bio1: 'Adam brings 10+ years of hands-on construction project management, having personally managed residential and commercial projects valued from $100K to $1M+. As Owner/Operator of Morgan Renovations, he managed full-cycle projects including estimating, budgeting, scheduling, crew oversight, and client relations.',
    bio2: 'While operating Morgan Renovations, Adam witnessed endemic payment governance failures: draws held up by minor disputes, no server-side enforcement of release conditions, no immutable record of approvals, and projects stalling while lenders and contractors negotiated administrative details. Recognizing this as a structural problem, Adam began building a solution called RenovateAI, architecting the platform around his direct understanding of how payment enforcement could prevent disputes before they cost projects.',
    bio3: 'Adam is accountable for Vektrum\'s technical architecture and product design. He built the foundational infrastructure (Supabase backend, Stripe Connect integration, API webhooks, DNS configuration) and continues to iterate on core architecture. He is self-taught in software engineering, learning the technologies he needed to solve the problem he understood.',
  },
  {
    initials: 'TW',
    name: 'Tanner Walstad',
    title: 'Co-Founder & Chief Commercial Officer',
    bio1: 'Tanner brings deep experience in sales, marketing, and go-to-market strategy across institutional software environments. His background includes roles at Canary Speech AI (Sales Specialist & Account Manager for institutional clients), Altol Consulting (Director of Sales and Marketing), World Financial Group (Sales team management), and digital commerce.',
    bio2: 'Tanner witnessed his mother\'s experience with contractor fraud and misappropriation. This gave him direct insight into a critical market failure: the absence of enforceable payment governance structures that protect property owners and lenders. He independently began building Vektrum as a marketplace platform to manage money transfer and dispute resolution in construction, recognizing that payment disputes were destroying relationships and finances at every tier of the market.',
    bio3: 'Tanner is accountable for Vektrum\'s commercial strategy, institutional partnerships, and market positioning. He brings institutional SaaS expertise to lender conversations and understands the compliance signaling, sales cycles, and governance requirements that institutional adoption requires.',
  },
  {
    initials: 'PW',
    name: 'Phillip Walstad',
    title: 'Board Member, Advisor & Strategic Partner',
    bio1: 'Phillip Walstad is a Utah-based serial entrepreneur and co-founder of Canary Speech, a healthcare AI company focused on voice biomarker technology for detecting mental health and neurological conditions through speech analysis.',
    bio2: 'Walstad\'s entrepreneurial background spans technology, social impact, and education sectors. He has founded or co-founded multiple ventures including Compass Group (board member; U.S. and Latin America expansion), Study&Work (education and internship platform), and Turnkey Social (social media marketing agency). His core expertise includes startup formation and scaling, go-to-market strategy, fundraising, product development, and team building.',
    bio3: 'As Vektrum\'s board member and strategic partner, Phillip provides governance oversight, capital strategy, and operational guidance from his experience building companies across multiple sectors. His background identifying emerging opportunities and scaling ventures to execution directly informs Vektrum\'s approach to institutional market expansion and operational rigor.',
  },
]

export default function FoundersPage() {
  return (
    <div>
      <section className="relative overflow-hidden bg-[#0D1B2A] pt-20 pb-16 sm:pt-28 sm:pb-20">
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
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface-2 px-4 py-1.5 shadow-sm mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-vektrum-green animate-pulse" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65">
              The Team
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.025em] text-white sm:text-4xl lg:text-5xl">
            Built by people who lived the problem
          </h1>
          <p className="mt-6 text-[16px] leading-relaxed text-white/55 max-w-2xl mx-auto">
            Vektrum was not founded by fintech generalists. It was built by operators from construction
            finance who watched the same preventable failures repeat — missed draws, stalled projects,
            lenders approving disbursements on trust instead of verification.
          </p>
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-surface-0" aria-label="Founding team">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="space-y-12">
            {founders.map((founder) => (
              <article
                key={founder.name}
                className="rounded-2xl border border-white/[0.08] bg-surface-2 p-8 hover:border-vektrum-blue/40 hover:shadow-lg hover:shadow-vektrum-blue/5 transition-all"
              >
                <div className="flex items-center gap-5 mb-6">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-vektrum-blue/10 border border-vektrum-blue/20 select-none">
                    <span className="font-display text-[17px] font-bold tracking-tight text-blue-300">
                      {founder.initials}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display text-[18px] font-bold text-white leading-tight">
                      {founder.name}
                    </h2>
                    <p className="mt-0.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/75">
                      {founder.title}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 text-[14px] leading-relaxed text-white/65">
                  <p>{founder.bio1}</p>
                  <p>{founder.bio2}</p>
                  <p>{founder.bio3}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.08] bg-surface-2 py-20 sm:py-24" aria-label="Get started with Vektrum">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65 mb-4">
            Work with us
          </p>
          <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl mb-4">
            The platform is live. The team is reachable.
          </h2>
          <p className="text-[15px] leading-relaxed text-white/55 mb-10 max-w-xl mx-auto">
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
              className="rounded-xl border border-white/[0.08] bg-surface-2 px-7 py-3 text-[14px] font-semibold text-white/55 hover:bg-surface-3 hover:border-vektrum-blue/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vektrum-blue focus-visible:ring-offset-2"
            >
              Contact the team
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

