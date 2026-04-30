/**
 * App Layout (authenticated dashboard tree)
 *
 * The (app) route group wraps everything that needs auth-aware chrome —
 * dashboard pages, account-specific surfaces, the auth-aware UserMenu and
 * NotificationBell. This layout intentionally calls Supabase's
 * `auth.getUser()` per request so the rendered nav reflects the current
 * session.
 *
 * Routes under this group are dynamic (cookies-tainted) — that is correct
 * and intended. The cacheable surface is (marketing); the dynamic surface
 * is (app). Static analysis tests enforce that they stay separated.
 *
 * Public marketing pages render under src/app/(marketing)/layout.tsx,
 * which has no auth fetch and is eligible for static / ISR caching.
 */

import Link from 'next/link'
import { MobileNav } from '@/components/nav/mobile-nav'
import { VektrumWordmark } from '@/components/ui/vektrum-logo'
import { UserMenu } from '@/components/nav/user-menu'
import { NotificationBell } from '@/components/nav/notification-bell'
import { SiteFooter } from '@/components/nav/site-footer'
import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth-aware nav — read session server-side so first paint is correct.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const userName = user?.user_metadata?.full_name ?? null
  const userEmail = user?.email ?? null

  // Fetch role from profiles for admin-gated nav items. Only query when a
  // user is authenticated — anonymous visitors should never reach this
  // layout (auth middleware redirects to /auth/login first), but we guard
  // defensively in case middleware is bypassed in dev.
  let userRole: string | null = null
  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profileRow } = await (supabase as any)
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    userRole = (profileRow as { role: string } | null)?.role ?? null
  }

  return (
    <>
      {/* Auth-aware navigation */}
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#070D18]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <nav className="flex h-15 items-center justify-between" style={{ height: '60px' }}>
            <Link
              href={user ? '/dashboard' : '/'}
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
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="rounded-lg px-3 py-2 text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
                  >
                    Dashboard
                  </Link>
                  <div className="ml-3 pl-3 border-l border-white/[0.08] flex items-center gap-1">
                    <NotificationBell />
                    <UserMenu name={userName} email={userEmail} role={userRole} />
                  </div>
                </>
              ) : (
                // Defensive fallback: if an unauthenticated request somehow
                // lands on this layout, give them a Sign-in link instead of
                // a blank header.
                <Link
                  href="/auth/login"
                  className="rounded-lg px-3 py-2 text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
                >
                  Sign in
                </Link>
              )}
            </div>

            {/* Mobile hamburger — shown only on mobile */}
            <MobileNav
              isLoggedIn={!!user}
              userName={userName}
              userEmail={userEmail}
              userRole={userRole}
            />
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1">{children}</main>

      <SiteFooter />
    </>
  )
}
