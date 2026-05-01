/**
 * Root Layout — thin shell only.
 *
 * After the marketing-cache-architecture refactor, this layout intentionally
 * does NO auth work. Header, footer, and auth-state lookup live in the
 * route-group layouts:
 *
 *   - src/app/(marketing)/layout.tsx  → public chrome, no auth (cacheable)
 *   - src/app/(app)/layout.tsx        → auth-aware chrome, Supabase getUser
 *
 * Hard rule: this file must NOT import:
 *   - `@/lib/supabase/server`
 *   - `next/headers`
 *   - `@supabase/ssr`
 *   - any helper that calls cookies() / headers() / auth.getUser()
 *
 * Enforced by tests/root-layout-purity.test.ts.
 */

import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { MetaPixelScript } from "@/components/analytics/MetaPixelScript";
import { MetaPixelPageView } from "@/components/analytics/MetaPixelPageView";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Display typeface — Instrument Sans for headings.
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
  metadataBase: new URL('https://vektrum.io'),
  title: {
    default: "Vektrum — Construction Payment Governance",
    template: "%s | Vektrum",
  },
  description:
    "Conditional authorization infrastructure for construction disbursements. A 10-condition release gate, AI-assisted draw review, and an append-only, hash-chained, tamper-evident audit trail. Funds release only when all conditions are verified.",
  openGraph: {
    type: 'website',
    siteName: 'Vektrum',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Vektrum — Conditional Authorization Infrastructure for Construction Disbursements',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@vektrum',
    creator: '@vektrum',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://vektrum.io',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://vektrum.io/#organization",
      "name": "Vektrum",
      "url": "https://vektrum.io",
      "logo": "https://vektrum.io/logo.png",
      "description": "Vektrum is a construction disbursement governance platform providing authorization infrastructure for construction draw releases — 10-condition release gate, AI-assisted draw review preconditions, and append-only, hash-chained, tamper-evident audit trails for funders and contractors.",
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "operations@vektrum.io",
        "contactType": "sales",
      },
      "sameAs": [],
    },
    {
      "@type": "WebSite",
      "@id": "https://vektrum.io/#website",
      "url": "https://vektrum.io",
      "name": "Vektrum",
      "publisher": {
        "@id": "https://vektrum.io/#organization",
      },
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://vektrum.io/help?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        {/* ── Skip link ── allows keyboard/screen-reader users to bypass nav ──── */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:flex focus:items-center focus:rounded-lg focus:bg-vektrum-blue focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/*
          Header / footer / auth-aware chrome live in the route-group
          layouts ((marketing) and (app)). For non-grouped routes
          (/auth/*, /invite/*, /forgot-password, /pitch), pages render
          their own self-contained chrome. This shell intentionally
          does not impose nav, so those routes stay flexible.
        */}
        {children}
        <Analytics />
        {/* Meta Pixel — fires only when NEXT_PUBLIC_META_PIXEL_ID is set */}
        <MetaPixelScript />
        <MetaPixelPageView />
      </body>
    </html>
  );
}
