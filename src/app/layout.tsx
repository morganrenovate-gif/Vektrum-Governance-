import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { MobileNav } from "@/components/nav/mobile-nav";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}>
      <body className="flex min-h-screen flex-col bg-vektrum-bg font-sans text-vektrum-text antialiased">
        {/* Navigation */}
        <header className="sticky top-0 z-50 border-b border-vektrum-border/80 bg-vektrum-surface/90 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
            <nav className="flex h-16 items-center justify-between">
              <Link
                href="/"
                className="flex items-center gap-2.5 group"
                aria-label="Vektrum home"
              >
                {/* Logo mark — matches logo's near-black canvas */}
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vektrum-canvas">
                  <span className="text-sm font-bold text-vektrum-canvas-text tracking-tight">V</span>
                </div>
                <span className="text-[15px] font-semibold tracking-[-0.02em] text-vektrum-text group-hover:text-vektrum-muted transition-colors">
                  Vektrum
                </span>
              </Link>

              {/* Desktop nav — hidden on mobile */}
              <div className="hidden sm:flex items-center gap-1">
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
                {/* Primary CTA — brand cobalt blue */}
                <Link
                  href="/auth/signup"
                  className="ml-2 rounded-lg bg-vektrum-blue px-4 py-2 text-[13px] font-medium text-white hover:bg-vektrum-blue-hover transition-all shadow-sm"
                >
                  Get started
                </Link>
              </div>

              {/* Mobile hamburger — shown only on mobile */}
              <MobileNav />
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
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-vektrum-canvas">
                    <span className="text-xs font-bold text-vektrum-canvas-text">V</span>
                  </div>
                  <span className="text-sm font-semibold tracking-[-0.02em] text-vektrum-text">
                    Vektrum
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-vektrum-muted max-w-xs">
                  Construction payment governance. Funds release only when work is verified.
                </p>
                <p className="text-[11px] font-medium uppercase tracking-widest text-vektrum-faint">
                  Trust. Built In.
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
