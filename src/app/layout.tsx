import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { ArrowRight } from "lucide-react"
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://vektrum.io/#organization",
        "name": "Vektrum",
        "url": "https://vektrum.io",
        "logo": "https://vektrum.io/logo.png",
        "description": "Vektrum is a construction payment governance platform providing controlled draw disbursements, AI compliance review, and immutable audit trails for funders and contractors.",
        "contactPoint": {
          "@type": "ContactPoint",
          "email": "operations@vektrum.io",
          "contactType": "sales"
        },
        "sameAs": []
      },
      {
        "@type": "WebSite",
        "@id": "https://vektrum.io/#website",
        "url": "https://vektrum.io",
        "name": "Vektrum",
        "publisher": {
          "@id": "https://vektrum.io/#organization"
        },
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://vektrum.io/help?q={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      }
    ]
  }

  return (
    <html lang="en" className={`${inter.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}>
      <head>
         <script async src="..."></script>
         <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-SZ5V40216Y');
        `}} />
      </head>
      <body className="flex min-h-screen flex-col bg-vektrum-bg font-sans text-white antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Navigation */}
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
                {user ? (
                  // ── Logged-in nav ──────────────────────────────────────────
                  <>
                    <Link
                      href="/dashboard"
                      className="rounded-lg px-3 py-2 text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
                    >
                      Dashboard
                    </Link>
                    <div className="ml-3 pl-3 border-l border-white/[0.08]">
                      <UserMenu name={userName} email={userEmail} role={userRole} />
                    </div>
                  </>
                ) : (
                  // ── Logged-out nav ─────────────────────────────────────────
                  <>
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
                      href="https://cal.com/vektrum"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg px-3 py-2 text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
                    >
                      Book a call
                    </Link>
                    <div className="mx-2 h-4 w-px bg-white/[0.1]" aria-hidden="true" />
                    <Link
                      href="/auth/login"
                      className="rounded-lg px-3 py-2 text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="group ml-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-vektrum-blue px-4 py-2 text-[13px] font-semibold text-white hover:bg-vektrum-blue-hover transition-all shadow-md shadow-vektrum-blue/20"
                    >
                      Get Started
                      <ArrowRight
                        size={14}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
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
        <Analytics />

        {/* Footer */}
        <footer className="border-t border-white/[0.08] bg-surface-2">
          <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
              {/* Brand */}
              <div className="flex flex-col gap-3">
                <VektrumWordmark markSize={24} showTagline />
                <p className="text-[13px] leading-relaxed text-white/75 max-w-xs">
                  Construction payment governance. Funds release only when work is verified.
                </p>

              </div>

              {/* Links */}
              <div className="flex gap-8 sm:gap-16">
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/65">
                    Platform
                  </span>
                  <Link href="/auth/signup" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                    Get started
                  </Link>
                  <Link href="/auth/login" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                    Sign in
                  </Link>
                  <Link href="/dashboard" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                    Dashboard
                  </Link>
                  <Link href="/pricing" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                    Pricing
                  </Link>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/65">
                    For Funders &amp; Contractors
                  </span>
                  <Link href="/funders" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                    Funders
                  </Link>
                  <Link href="/contractors" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                    Contractors
                  </Link>
                  <Link
                    href="/founders"
                    className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
                  >
                    Founders
                  </Link>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/65">
                    Company
                  </span>
                  <Link href="/about" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                    About
                  </Link>
                  <Link href="/careers" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                    Careers
                  </Link>
                  <Link href="/help" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                    Help
                  </Link>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/65">
                    Legal
                  </span>
                  <Link href="/terms" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                    Terms of Service
                  </Link>
                  <Link href="/privacy" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                    Privacy Policy
                  </Link>
                  <Link href="/security" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                    Security
                  </Link>
                  <Link href="/contact" className="text-[13px] text-white/75 hover:text-white focus-visible:text-white transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue">
                    Contact
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-6 border-t border-white/[0.05] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] text-white/75">
                &copy; {new Date().getFullYear()} Vektrum. All rights reserved.
              </p>
              <p className="text-[11px] text-white/65">
                Funds are held in Stripe Connect managed accounts, not by Vektrum.
              </p>
              <p className="mt-1 text-[11px] text-white/60 leading-relaxed">
                Vektrum is not a bank, lender, or money transmitter. Platform security reviewed annually. Data encrypted in transit and at rest.
              </p>
              <div className="flex flex-col gap-1 sm:items-end">
                <p className="text-[12px] text-white/65">
                  Vektrum governs disbursement. Vektrum never holds funds.
                </p>
                {/* Removed footer attribution */}
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
