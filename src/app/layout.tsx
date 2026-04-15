import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
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

              <div className="flex items-center gap-1">
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
                {/* Primary CTA — brand cobalt blue on hover, dark canvas at rest */}
                <Link
                  href="/auth/signup"
                  className="ml-2 rounded-lg bg-vektrum-canvas px-4 py-2 text-[13px] font-medium text-vektrum-canvas-text hover:bg-vektrum-blue transition-all shadow-sm"
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
              <div className="flex gap-16">
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
                </div>
              </div>
            </div>

            <div className="mt-12 pt-6 border-t border-vektrum-border-subtle flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] text-vektrum-muted">
                &copy; {new Date().getFullYear()} Vektrum. All rights reserved.
              </p>
              <p className="text-[12px] text-vektrum-faint">
                Vektrum governs disbursement. Vektrum never holds funds.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
