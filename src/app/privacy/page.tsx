import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Vektrum',
  description: 'Vektrum Privacy Policy — how we collect, use, and protect your data.',
}

export default function PrivacyPage() {
  return (
    <div className="bg-vektrum-bg">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 py-16 sm:py-20">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-vektrum-text tracking-[-0.025em]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-[15px] text-vektrum-muted">Last updated: April 2026</p>

        <p className="mt-8 text-[15px] leading-relaxed text-vektrum-muted">
          {"Vektrum's Privacy Policy is currently in preparation. We collect only the minimum data required to operate the platform: account credentials, project and milestone data, and payment metadata. We never sell your data. For questions, contact "}
          <a href="mailto:lenders@vektrum.io" className="text-vektrum-blue hover:underline">
            lenders@vektrum.io
          </a>
          .
        </p>

        <div className="mt-10 rounded-xl border border-vektrum-border bg-vektrum-surface p-6">
          <p className="text-[15px] leading-relaxed text-vektrum-muted">
            All authentication data is managed by Supabase. All payment data is managed by Stripe.
            Vektrum stores project and milestone governance data only.
          </p>
        </div>
      </div>
    </div>
  )
}
