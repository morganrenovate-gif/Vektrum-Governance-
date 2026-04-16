import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Vektrum | lenders@vektrum.io',
  description: 'Contact Vektrum for lender inquiries, partnership discussions, or platform support.',
}

export default function ContactPage() {
  return (
    <div className="bg-vektrum-bg">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 py-16 sm:py-20">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-vektrum-text tracking-[-0.025em]">
          Contact
        </h1>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6">
            <h2 className="text-[15px] font-semibold text-vektrum-text mb-2">
              Lender &amp; Partnership Inquiries
            </h2>
            <a
              href="mailto:lenders@vektrum.io"
              className="text-[15px] text-vektrum-blue hover:underline"
            >
              lenders@vektrum.io
            </a>
          </div>
          <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6">
            <h2 className="text-[15px] font-semibold text-vektrum-text mb-2">
              General Support
            </h2>
            <p className="text-[15px] leading-relaxed text-vektrum-muted">
              {'Use the Help Center or email '}
              <a
                href="mailto:lenders@vektrum.io"
                className="text-vektrum-blue hover:underline"
              >
                lenders@vektrum.io
              </a>
            </p>
          </div>
        </div>

        <p className="mt-10 text-[15px] leading-relaxed text-vektrum-muted">
          {'Vektrum is currently in private beta. If you are a construction lender or funder evaluating the platform, email '}
          <a href="mailto:lenders@vektrum.io" className="text-vektrum-blue hover:underline">
            lenders@vektrum.io
          </a>
          {' to speak with the team.'}
        </p>
      </div>
    </div>
  )
}
