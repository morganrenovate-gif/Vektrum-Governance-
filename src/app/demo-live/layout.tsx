import Link from 'next/link'
import { VektrumWordmark } from '@/components/ui/vektrum-logo'

export const metadata = {
  title: 'Demo — Vektrum',
  description: 'Interactive demo of the Vektrum construction payment governance platform.',
}

export default function DemoLiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Demo banner */}
      <div className="flex h-9 items-center justify-center gap-3 border-b border-vektrum-amber-border bg-vektrum-amber-bg px-4">
        <p className="text-[12px] font-medium text-vektrum-amber">
          Demo Mode — All data is simulated. No real funds, accounts, or deals.
        </p>
        <Link
          href="/auth/signup"
          className="text-[12px] font-semibold text-vektrum-amber hover:underline"
        >
          View live app &rarr;
        </Link>
      </div>



      {/* Main */}
      <main className="flex-1">{children}</main>

      </>
  )
}