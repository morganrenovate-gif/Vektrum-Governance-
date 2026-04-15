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
      <body className="flex min-h-screen flex-col bg-[#FAFBFC] font-sans text-[#0A0F1C] antialiased">
        {/* Navigation */}
        <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
            <nav className="flex h-16 items-center justify-between">
              <Link
                href="/"
                className="flex items-center gap-2.5 group"
                aria-label="Vektrum home"
              >
                {/* Logo mark */}
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A0F1C]">
                  <span className="text-sm font-bold text-white tracking-tight">V</span>
                </div>
                <span className="text-[15px] font-semibold tracking-[-0.02em] text-[#0A0F1C] group-hover:text-gray-600 transition-colors">
                  Vektrum
                </span>
              </Link>

              <div className="flex items-center gap-1">
                <Link
                  href="/dashboard"
                  className="rounded-lg px-3 py-2 text-[13px] font-medium text-gray-500 hover:text-[#0A0F1C] hover:bg-gray-100/70 transition-all"
                >
                  Dashboard
                </Link>
                <Link
                  href="/auth/login"
                  className="rounded-lg px-3 py-2 text-[13px] font-medium text-gray-500 hover:text-[#0A0F1C] hover:bg-gray-100/70 transition-all"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className="ml-2 rounded-lg bg-[#0A0F1C] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1E293B] transition-all shadow-sm"
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
        <footer className="border-t border-gray-200/80 bg-white">
          <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
              {/* Brand */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A0F1C]">
                    <span className="text-xs font-bold text-white">V</span>
                  </div>
                  <span className="text-sm font-semibold tracking-[-0.02em] text-[#0A0F1C]">
                    Vektrum
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-gray-400 max-w-xs">
                  Construction payment governance. Funds release only when work is verified.
                </p>
              </div>

              {/* Links */}
              <div className="flex gap-16">
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                    Platform
                  </span>
                  <Link href="/auth/signup" className="text-[13px] text-gray-500 hover:text-[#0A0F1C] transition-colors">
                    Get started
                  </Link>
                  <Link href="/auth/login" className="text-[13px] text-gray-500 hover:text-[#0A0F1C] transition-colors">
                    Sign in
                  </Link>
                  <Link href="/dashboard" className="text-[13px] text-gray-500 hover:text-[#0A0F1C] transition-colors">
                    Dashboard
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-6 border-t border-gray-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] text-gray-400">
                &copy; {new Date().getFullYear()} Vektrum. All rights reserved.
              </p>
              <p className="text-[12px] text-gray-300">
                Vektrum governs disbursement. Vektrum never holds funds.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
