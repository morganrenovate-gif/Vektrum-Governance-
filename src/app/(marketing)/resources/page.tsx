import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookOpen, FileText, Shield } from 'lucide-react'

// ISR: re-render at most every hour. Public marketing — no per-user data.
export const revalidate = 3600


export const metadata: Metadata = {
  title: 'Resources',
  description:
    'Guides, explainers, and case studies on construction disbursement governance — how release gates, dispute isolation, lien waivers, and audit trails work in practice.',
  alternates: { canonical: 'https://vektrum.io/resources' },
  openGraph: {
    title: 'Resources — Vektrum',
    description: 'Guides and explainers on construction disbursement governance, release gates, dispute isolation, and lien waivers.',
    url: 'https://vektrum.io/resources',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
}

const ARTICLES = [
  {
    slug: 'construction-dispute-isolation',
    category: 'Dispute Management',
    title: "Why a $15K Construction Dispute Shouldn't Freeze a $9M Project",
    description:
      'When a single disputed milestone locks the entire project budget, funders lose leverage and contractors lose cash flow. Milestone isolation changes the math.',
    readTime: '5 min read',
    icon: Shield,
  },
]

export default function ResourcesPage() {
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
            <BookOpen size={14} className="text-blue-300" aria-hidden="true" />
            <span className="text-[12px] font-medium text-white/55 tracking-wide">
              Resources
            </span>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-[-0.035em] text-white sm:text-5xl text-balance">
            Construction disbursement governance — explained
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-[17px] leading-relaxed text-white/55">
            Guides, explainers, and case studies on release gates, dispute isolation,
            lien waivers, and how authorization infrastructure works in practice.
          </p>
        </div>
      </section>

      {/* ─── Articles ──────────────────────────────────────────────────────── */}
      <section className="bg-[#0A1628] py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="space-y-6">
            {ARTICLES.map((article) => (
              <Link
                key={article.slug}
                href={`/resources/${article.slug}`}
                className="group block rounded-2xl border border-white/[0.08] bg-surface-2 p-7 hover:border-vektrum-blue/40 hover:shadow-lg hover:shadow-vektrum-blue/5 transition-all"
              >
                <div className="flex items-start gap-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-blue/10 flex-shrink-0 mt-0.5">
                    <article.icon size={19} className="text-blue-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-400">
                        {article.category}
                      </span>
                      <span className="text-[10px] text-white/40">·</span>
                      <span className="text-[10px] text-white/40">{article.readTime}</span>
                    </div>
                    <h2 className="text-[17px] font-bold tracking-[-0.02em] text-white group-hover:text-blue-200 transition-colors mb-2">
                      {article.title}
                    </h2>
                    <p className="text-[13px] leading-relaxed text-white/55">
                      {article.description}
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">
                      Read article
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* More coming soon */}
          <div className="mt-10 rounded-xl border border-white/[0.06] bg-surface-3 px-6 py-5 text-center">
            <FileText size={18} className="text-white/30 mx-auto mb-2" aria-hidden="true" />
            <p className="text-[13px] text-white/40">More guides coming soon — release gate deep dives, lien waiver workflows, and institutional rail setup.</p>
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.08] bg-surface-2 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <h2 className="text-xl font-bold tracking-[-0.025em] text-white sm:text-2xl">
            Ready to see it in action?
          </h2>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/demo-live/deal/harbor"
              className="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-6 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              View live demo
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <Link
              href="/help"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/[0.08] bg-surface-2 px-6 py-2.5 text-[13px] font-semibold text-white/55 hover:bg-surface-3 hover:border-vektrum-blue/40 transition-all"
            >
              Browse FAQ
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
