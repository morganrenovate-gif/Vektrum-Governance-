import Link from 'next/link'
import { VektrumWordmark } from '@/components/ui/vektrum-logo'
import { DemoResetButton } from '@/components/demo/DemoResetButton'

export const metadata = {
  title: 'Demo — Vektrum',
  description: 'Interactive demo of the Vektrum construction payment governance platform.',
}

export default function DemoLiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Demo banner */}
      <div className="flex h-10 items-center justify-between gap-3 border-b border-white/10 bg-black px-4">
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