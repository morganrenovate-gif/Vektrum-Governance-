import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | Vektrum',
  description: 'Vektrum Terms of Service for the construction payment governance platform.',
}

export default function TermsPage() {
  return (
    <div className="bg-vektrum-bg">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 py-16 sm:py-20">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-vektrum-text tracking-[-0.025em]">
          Terms of Service
        </h1>
        <p className="mt-2 text-[15px] text-vektrum-muted">Last updated: April 2026</p>

        <p className="mt-8 text-[15px] leading-relaxed text-vektrum-muted">
          {"Vektrum's Terms of Service are currently in preparation by licensed legal counsel. If you are a lender or funder evaluating Vektrum, please contact us at "}
          <a href="mailto:lenders@vektrum.io" className="text-vektrum-blue hover:underline">
            lenders@vektrum.io
          </a>
          {' for a preview of the draft agreement and our MSA template.'}
        </p>

        <div className="mt-10 rounded-xl border border-vektrum-border bg-vektrum-surface p-6">
          <p className="text-[15px] leading-relaxed text-vektrum-muted">
            Vektrum is a technology governance platform. Funds are held in Stripe Connect managed
            accounts, not by Vektrum. Vektrum is not a money transmitter. Vektrum is a governance
            and authorization layer.
          </p>
        </div>

        <p className="mt-10 text-[15px] leading-relaxed text-vektrum-muted">
          {'Questions? Email '}
          <a href="mailto:lenders@vektrum.io" className="text-vektrum-blue hover:underline">
            lenders@vektrum.io
          </a>
        </p>
      </div>
    </div>
  )
}
