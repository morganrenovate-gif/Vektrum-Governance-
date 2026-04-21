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

      {/* Navigation — logged-out state always */}
      <header className="sticky top-0 z-50 border-b border-vektrum-border/80 bg-vektrum-surface/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <nav className="flex h-16 items-center justify-between">
            <Link
              href="/demo-live"
              className="flex items-center group"
              aria-label="Demo home"
            >
              <VektrumWordmark
                markSize={28}
                className="group-hover:opacity-80 transition-opacity"
              />
            </Link>

            <div className="hidden sm:flex items-center gap-1">
              <Link
                href="/lenders"
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-vektrum-muted hover:text-vektrum-text hover:bg-vektrum-surface-alt transition-all"
              >
                Lenders
              </Link>
              <Link
                href="/about"
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-vektrum-muted hover:text-vektrum-text hover:bg-vektrum-surface-alt transition-all"
              >
                About
              </Link>
              <Link
                href="/pricing"
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-vektrum-muted hover:text-vektrum-text hover:bg-vektrum-surface-alt transition-all"
              >
                Pricing
              </Link>
              <Link
                href="/auth/login"
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-vektrum-muted hover:text-vektrum-text hover:bg-vektrum-surface-alt transition-all"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="ml-2 rounded-lg bg-vektrum-blue px-4 py-2 text-[13px] font-medium text-white hover:bg-vektrum-blue-hover transition-all shadow-sm"
              >
                Get started
              </Link>
            </div>


          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">{children}</main>

      </>