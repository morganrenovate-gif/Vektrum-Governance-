import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Calendar, Mail } from 'lucide-react'
import { BOOK_CALL_URL, BOOK_CALL_EXTERNAL } from '@/lib/book-call'

// ISR: re-render at most every hour. Public marketing — no per-user data.
export const revalidate = 3600


export const metadata: Metadata = {
  title: 'Contact Vektrum | operations@vektrum.io',
  description: 'Contact Vektrum for funder inquiries, partnership discussions, or platform support.',
  alternates: { canonical: 'https://vektrum.io/contact' },
  openGraph: {
    title: 'Contact — Vektrum',
    description: 'Funder inquiries, partnership discussions, or platform support.',
    url: 'https://vektrum.io/contact',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    title: 'Contact — Vektrum',
    description: 'Funder inquiries, partnership discussions, or platform support.',
  },
}

export default function ContactPage() {
  return (
    <div className="bg-surface-0">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 py-16 sm:py-20">

        <div className="mb-10">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-[-0.025em]">
            Contact
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/65">
            For institutional buyers, a call is the fastest path to onboarding.
            For everything else, email works.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Book a call — primary */}
          <div className="rounded-2xl border border-vektrum-blue/30 bg-vektrum-blue/10 p-6 flex flex-col gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-blue/20">
              <Calendar size={18} className="text-vektrum-blue-subtle" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-1">
                Book a call
              </h2>
              <p className="text-[13px] leading-relaxed text-white/65">
                Institutional funders, lenders, and platform integrators — schedule
                a 30-minute onboarding call with the Vektrum team.
              </p>
            </div>
            <Link
              href={BOOK_CALL_URL}
              {...(BOOK_CALL_EXTERNAL ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="group mt-auto inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-vektrum-blue/25 hover:bg-vektrum-blue-hover transition-all"
            >
              Schedule a call
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Email */}
          <div className="rounded-2xl border border-white/[0.08] bg-surface-2 p-6 flex flex-col gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]">
              <Mail size={18} className="text-white/65" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-1">
                Email
              </h2>
              <p className="text-[13px] leading-relaxed text-white/65">
                General inquiries, support questions, and vendor due diligence packages.
              </p>
            </div>
            <a
              href="mailto:operations@vektrum.io"
              className="mt-auto text-[14px] font-medium text-vektrum-blue-subtle hover:text-white transition-colors"
            >
              operations@vektrum.io
            </a>
          </div>

        </div>

        <div className="mt-8 rounded-xl border border-white/[0.08] bg-surface-2 px-5 py-4">
          <p className="text-[13px] leading-relaxed text-white/65">
            Self-serve: contractors and standalone funders can{' '}
            <Link href="/auth/signup" className="text-white/80 hover:text-white underline underline-offset-2">
              create a free account
            </Link>{' '}
            and start a deal without a call. Institutional onboarding (portfolio setup,
            external-rail configuration, API integration) is handled directly by the team.
          </p>
        </div>

      </div>
    </div>
  )
}
