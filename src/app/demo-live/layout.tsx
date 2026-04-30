import Link from 'next/link'
import { VektrumWordmark } from '@/components/ui/vektrum-logo'
import { DemoResetButton } from '@/components/demo/DemoResetButton'

export const metadata = {
  // Title is an explicit string so we don't get "Demo | Vektrum | Vektrum"
  // when the root layout's title.template applies on top of "Demo — Vektrum".
  title: 'Interactive Construction Draw Demo | Vektrum',
  description:
    'Walk through Vektrum end-to-end: the AI Draw Control Brief precondition, the 10-condition release gate, and the append-only, hash-chained audit trail. Funder, contractor, and admin views included.',
  alternates: { canonical: 'https://vektrum.io/demo-live' },
  openGraph: {
    title: 'Interactive Construction Draw Demo — Vektrum',
    description:
      'AI Draw Control Brief precondition, 10-condition release gate, and append-only audit trail walkthrough.',
    url: 'https://vektrum.io/demo-live',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    title: 'Interactive Construction Draw Demo — Vektrum',
    description:
      'AI Draw Control Brief precondition, 10-condition release gate, audit trail walkthrough.',
  },
}

export default function DemoLiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Demo banner — sticky so the disclaimer stays visible while scrolling */}
      <div className="sticky top-0 z-50 flex h-10 items-center justify-between gap-3 border-b border-white/10 bg-black px-4">
        <p className="text-[12px] font-semibold text-red-500">
          Demo Mode — All data is simulated. No real funds, accounts, or deals.
        </p>
        <div className="flex items-center gap-3">
          <DemoResetButton variant="banner" />
          <Link
            href="/auth/signup"
            className="text-[12px] font-semibold text-white/60 hover:text-white transition-colors"
          >
            View live app &rarr;
          </Link>
        </div>
      </div>



      {/* Main */}
      <main className="flex-1">{children}</main>

      </>
  )
}