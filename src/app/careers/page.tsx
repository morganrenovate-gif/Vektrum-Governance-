import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Careers — Vektrum',
  description:
    'Join Vektrum and help build the future of construction payment governance. We are hiring engineers, designers, and domain experts.',
  alternates: { canonical: 'https://vektrum.io/careers' },
  openGraph: {
    title: 'Careers — Vektrum',
    description: 'Help build the governance layer for construction finance.',
    url: 'https://vektrum.io/careers',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    title: 'Careers — Vektrum',
    description: 'Help build the governance layer for construction finance.',
  },
}

export default function CareersPage() {
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
          <h1 className="font-display text-4xl font-bold tracking-[-0.035em] text-white sm:text-5xl text-balance">
            Build the future of construction payments.
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-[17px] leading-relaxed text-white/55">
            Vektrum is building the governance layer for construction finance.
            We are looking for engineers, designers, and domain experts who want
            to bring release-condition enforcement to a multi-trillion-dollar industry.
          </p>
        </div>
      </section>

      {/* ─── Open roles ────────────────────────────────────────────────────── */}
      <section className="bg-surface-2 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl text-center mb-12">
            Open roles
          </h2>

          <div className="rounded-2xl border border-white/[0.08] bg-surface-3 p-8 sm:p-10 text-center">
            <p className="text-[15px] text-white/55 leading-relaxed">
              We do not have any open roles listed right now. Check back soon or send us
              your resume — we are always interested in exceptional people.
            </p>
            <div className="mt-6">
              <Link
                href="mailto:operations@vektrum.io"
                className="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-6 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
              >
                Send your resume
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Why Vektrum ───────────────────────────────────────────────────── */}
      <section className="bg-surface-0 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl text-center mb-12">
            Why work at Vektrum
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                title: 'Real-world impact',
                desc: 'Construction moves $2.19T a year. The payment infrastructure is decades behind. We are fixing that.',
              },
              {
                title: 'Small team, big leverage',
                desc: 'Early-stage team where every person shapes the product. No layers of approval — ship what matters.',
              },
              {
                title: 'Technical depth',
                desc: 'Server-enforced release gates, AI-assisted draw review preconditions, append-only hash-chained tamper-evident audit trails. Hard problems with real consequences.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/[0.08] bg-surface-2 p-8"
              >
                <h3 className="text-[15px] font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-white/55">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
