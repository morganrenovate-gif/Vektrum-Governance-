/**
 * Marketing Layout
 *
 * The (marketing) route group is the public, cacheable surface of the site.
 * This layout MUST remain free of any auth-state-reading code so that the
 * pages it wraps can be rendered statically (or via ISR).
 *
 * Hard rule — this file must NOT import:
 *   - `@/lib/supabase/server`         (taints with cookies())
 *   - `next/headers`                   (cookies / headers are dynamic)
 *   - `@supabase/ssr`                  (server client, same taint)
 *   - any helper that calls those     (no `auth.getUser()` reachable)
 *
 * Enforced by tests/marketing-layout-purity.test.ts.
 *
 * The auth-aware UserMenu / NotificationBell / Dashboard link live in
 * src/app/(app)/layout.tsx — that group keeps Supabase getUser() per request.
 *
 * Logged-in users hitting `/` are redirected to `/dashboard` by middleware
 * (see src/middleware.ts), so we do not need to render an auth-aware
 * variant of the homepage hero.
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BOOK_CALL_URL, BOOK_CALL_EXTERNAL } from '@/lib/book-call'
import { MobileNav } from '@/components/nav/mobile-nav'
import { VektrumWordmark } from '@/components/ui/vektrum-logo'
import { SiteFooter } from '@/components/nav/site-footer'
import { EngagementCta } from '@/components/marketing/engagement-cta'

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Public navigation — no auth state, identical for every visitor */}
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#070D18]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <nav className="flex h-15 items-center justify-between" style={{ height: '60px' }}>
            <Link
              href="/"
              className="flex items-center group"
              aria-label="Vektrum home"
            >
              <VektrumWordmark
                markSize={26}
                className="group-hover:opacity-75 transition-opacity"
              />
            </Link>

            {/* Desktop nav — hidden on mobile */}
            <div className="hidden sm:flex items-center gap-0.5">
              <Link
                href="/demo"
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
              >
                How it works
              </Link>
              <Link
                href="/funders"
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
              >
                Funders
              </Link>
              <Link
                href="/contractors"
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
              >
                Contractors
              </Link>
              <Link
                href="/pricing"
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
              >
                Pricing
              </Link>
              <Link
                href="/demo-live"
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
              >
                Demo
              </Link>
              <div className="mx-2 h-4 w-px bg-white/[0.1]" aria-hidden="true" />
              <Link
                href="/auth/login"
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
              >
                Sign in
              </Link>
              <Link
                href={BOOK_CALL_URL}
                {...(BOOK_CALL_EXTERNAL ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="group ml-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-vektrum-blue px-4 py-2 text-[13px] font-semibold text-white hover:bg-vektrum-blue-hover transition-all shadow-md shadow-vektrum-blue/20"
              >
                Book a call
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>

            {/* Mobile hamburger — shown only on mobile.
                isLoggedIn=false because the (marketing) tree is rendered
                statically and never reads server-side auth state. The
                MobileNav component itself is a client component that
                reads auth on the client if needed for the logged-in
                drawer; on this layout we always show the public drawer. */}
            <MobileNav isLoggedIn={false} userName={null} userEmail={null} userRole={null} />
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1">{children}</main>

      <SiteFooter />

      {/* Post-engagement sticky CTA — appears only after scroll/time trigger */}
      <EngagementCta />
    </>
  )
}
