import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Vektrum | operations@vektrum.io',
  description: 'Contact Vektrum for funder inquiries, partnership discussions, or platform support.',
}

export default function ContactPage() {
  return (
    <div className="bg-vektrum-bg">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 py-16 sm:py-20">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-[-0.025em]">
          Contact
        </h1>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-6">
            <h2 className="text-[15px] font-semibold text-white mb-2">
              Funder &amp; Partnership Inquiries
            </h2>
            <a
              href="mailto:operations@vektrum.io"
              className="text-[15px] text-vektrum-blue hover:underline"
            >
              operations@vektrum.io
            </a>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-6">
            <h2 className="text-[15px] font-semibold text-white mb-2">
              General Support
            </h2>
            <p className="text-[15px] leading-relaxed text-white/55">
              {'Use the Help Center or email '}
              <a
                href="mailto:operations@vektrum.io"
                className="text-vektrum-blue hover:underline"
              >
                operations@vektrum.io
              </a>
            </p>
          </div>
        </div>

        <p className="mt-10 text-[15px] leading-relaxed text-white/55">
          {'Vektrum is open to contractors and funders. Create a free account to get started, or if you are an institutional funder evaluating the platform, email '}
          <a href="mailto:operations@vektrum.io" className="text-vektrum-blue hover:underline">
            operations@vektrum.io
          </a>
          {' to speak with the team.'}
        </p>
      </div>
    </div>
  )
}
