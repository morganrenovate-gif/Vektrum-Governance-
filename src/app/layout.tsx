import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vektrum — Construction Payment Governance",
  description:
    "Protected milestone-based payments for construction projects. Release funds only when work is verified and approved.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col bg-white text-slate-900 antialiased">
        {/* Navbar */}
        <header className="sticky top-0 z-50 border-b border-slate-800 bg-vektrum-navy">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex h-14 items-center justify-between">
              {/* Wordmark */}
              <Link
                href="/"
                className="flex items-center gap-2 text-white hover:text-blue-300 transition-colors"
                aria-label="Vektrum home"
              >
                <span className="text-lg font-semibold tracking-tight">
                  Vektrum
                </span>
              </Link>

              {/* Nav links */}
              <div className="flex items-center gap-1 sm:gap-2">
                <Link
                  href="/dashboard"
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/auth/login"
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="ml-1 rounded-md bg-vektrum-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Get Started
                </Link>
              </div>
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-slate-50 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-slate-500">
                Vektrum — Construction Payment Governance
              </p>
              <p className="text-xs text-slate-400">
                &copy; {new Date().getFullYear()} Vektrum. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
