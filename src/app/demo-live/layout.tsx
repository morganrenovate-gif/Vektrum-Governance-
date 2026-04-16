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

            {/* Mobile nav — simplified for demo */}
            <div className="flex sm:hidden items-center gap-2">
              <Link
                href="/auth/login"
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-vektrum-muted"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="rounded-lg bg-vektrum-blue px-3 py-2 text-[13px] font-medium text-white"
              >
                Get started
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-vektrum-border bg-vektrum-surface">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-3">
              <VektrumWordmark markSize={24} showTagline />
              <p className="text-[13px] leading-relaxed text-vektrum-muted max-w-xs">
                Construction payment governance. Funds release only when work is verified.
              </p>
            </div>
            <div className="flex gap-8 sm:gap-16">
              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-vektrum-faint">
                  Platform
                </span>
                <Link href="/auth/signup" className="text-[13px] text-vektrum-muted hover:text-vektrum-text transition-colors">
                  Get started
                </Link>
                <Link href="/pricing" className="text-[13px] text-vektrum-muted hover:text-vektrum-text transition-colors">
                  Pricing
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-vektrum-faint">
                  Company
                </span>
                <Link href="/about" className="text-[13px] text-vektrum-muted hover:text-vektrum-text transition-colors">
                  About
                </Link>
                <Link href="/help" className="text-[13px] text-vektrum-muted hover:text-vektrum-text transition-colors">
                  Help
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-vektrum-faint">
                  Legal
                </span>
                <Link href="/terms" className="text-[13px] text-vektrum-muted hover:text-vektrum-text transition-colors">
                  Terms
                </Link>
                <Link href="/privacy" className="text-[13px] text-vektrum-muted hover:text-vektrum-text transition-colors">
                  Privacy
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-vektrum-border-subtle flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-vektrum-muted">
              &copy; {new Date().getFullYear()} Vektrum. All rights reserved.
            </p>
            <p className="text-[11px] text-vektrum-faint">
              Funds are held in Stripe Connect managed accounts, not by Vektrum.
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}
