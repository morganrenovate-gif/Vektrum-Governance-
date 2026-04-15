import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { MobileNav } from "@/components/nav/mobile-nav";
import { VektrumWordmark } from "@/components/ui/vektrum-logo";
import { UserMenu } from "@/components/nav/user-menu";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Display typeface — Instrument Sans for headings
// Paired with Inter for body copy. Gives Vektrum typographic authority
// matching Mercury, Carta, and Stripe's premium SaaS aesthetic.
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vektrum — Construction Payment Governance",
  description:
    "Protected milestone payments for construction. Funds release only when work is verified.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Detect auth state server-side — zero client round-trip
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Pull display name from user metadata
  const userName = user?.user_metadata?.full_name ?? null
  const userEmail = user?.email ?? null

  // Fetch role from profiles for admin-gated nav items
  // Only query when user is authenticated — avoids unnecessary DB call for anon visitors
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
    <html lang="en" className={`${inter.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}>
      <body className="flex min-h-screen flex-col bg-vektrum-bg font-sans text-vektrum-text antialiased">
        {/* Navigation */}
        <header className="sticky top-0 z-50 border-b border-vektrum-border/80 bg-vektrum-surface/90 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
            <nav className="flex h-16 items-center justify-between">
              <Link
                href="/"
                className="flex items-center group"
                aria-label="Vektrum home"
              >
                <VektrumWordmark
                  markSize={28}
                  className="group-hover:opacity-80 transition-opacity"
                />
              </Link>

              {/* Desktop nav — hidden on mobile */}
              <div className="hidden sm:flex items-center gap-1">
                {user ? (
                  // ── Logged-in nav ──────────────────────────────────────────
                  <>
                    <Link
                      href="/dashboard"
                      className="rounded-lg px-3 py-2 text-[13px] font-medium text-vektrum-muted hover:text-vektrum-text hover:bg-vektrum-surface-alt transition-all"
                    >
                      Dashboard
                    </Link>
                    <div className="ml-2">
                      <UserMenu name={userName} email={userEmail} role={userRole} />
                    </div>
                  </>
                ) : (
                  // ── Logged-out nav ─────────────────────────────────────────
                  <>
                    <Link
                      href="/pricing"
                      className="rounded-lg px-3 py-2 text-[13px] font-medium text-vektrum-muted hover:text-vektrum-text hover:bg-vektrum-surface-alt transition-all"
                    >
                      Pricing
                    </Link>
                    <Link
                      href="/dashboard"
                      className="rounded-lg px-3 py-2 text-[13px] font-medium text-vektrum-muted hover:text-vektrum-text hover:bg-vektrum-surface-alt transition-all"
                    >
                      Dashboard
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
                  </>
                )}
              </div>

              {/* Mobile hamburger — shown only on mobile */}
              <MobileNav isLoggedIn={!!user} userName={userName} userEmail={userEmail} userRole={userRole} />
            </nav>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-vektrum-border bg-vektrum-surface">
          <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
              {/* Brand */}
              <div className="flex flex-col gap-3">
                <VektrumWordmark markSize={24} showTagline />
                <p className="text-[13px] leading-relaxed text-vektrum-muted max-w-xs">
                  Construction payment governance. Funds release only when work is verified.
                </p>

              </div>

              {/* Links */}
              <div className="flex gap-8 sm:gap-16">
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-vektrum-faint">
                    Platform
                  </span>
                  <Link href="/auth/signup" className="text-[13px] text-vektrum-muted hover:text-vektrum-text transition-colors">
                    Get started
                  </Link>
                  <Link href="/auth/login" className="text-[13px] text-vektrum-muted hover:text-vektrum-text transition-colors">
                    Sign in
                  </Link>
                  <Link href="/dashboard" className="text-[13px] text-vektrum-muted hover:text-vektrum-text transition-colors">
                    Dashboard
                  </Link>
                  <Link href="/pricing" className="text-[13px] text-vektrum-muted hover:text-vektrum-text transition-colors">
                    Pricing
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-6 border-t border-vektrum-border-subtle flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] text-vektrum-muted">
                &copy; {new Date().getFullYear()} Vektrum. All rights reserved.
              </p>
              <div className="flex flex-col gap-1 sm:items-end">
                <p className="text-[12px] text-vektrum-faint">
                  Vektrum governs disbursement. Vektrum never holds funds.
                </p>
                <a
                  href="https://perplexity.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-vektrum-faint hover:text-vektrum-muted transition-colors"
                >
                  Competitive intelligence powered by Perplexity
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
