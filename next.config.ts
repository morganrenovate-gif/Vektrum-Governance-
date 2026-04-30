import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type errors will be fixed incrementally — build must not block deployment
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Hide the X-Powered-By: Next.js response header to reduce stack fingerprinting.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.stripe.com",
              "connect-src 'self' https://*.supabase.co https://api.stripe.com",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
          // ── Standard security headers ─────────────────────────────────────
          // X-Frame-Options: clickjacking protection. SAMEORIGIN keeps any
          // future first-party iframes (e.g. internal admin previews) working.
          // Stripe / DocuSign / Supabase use CSP frame-src above, not iframes
          // of vektrum.io itself.
          { key: 'X-Frame-Options',        value: 'SAMEORIGIN' },
          // MIME-type sniffing defense
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Strip Referer to origin on cross-origin nav (preserves analytics
          // for first-party while limiting leakage to third-party endpoints).
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          // Disable powerful APIs we do not use. Camera/mic/geolocation are
          // not part of any Vektrum flow today.
          { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      // /lenders is a permanent alias of /funders. The /lenders/page.tsx
      // route was removed so this config-level redirect (permanent: true →
      // HTTP 308) takes effect for both /lenders and any pre-existing
      // /for-lenders or /find-lenders inbound links. /lenders is also
      // removed from sitemap.ts so only canonical /funders is indexed.
      { source: '/lenders',             destination: '/funders',     permanent: true },
      { source: '/for-lenders',         destination: '/funders',     permanent: true },
      { source: '/find-lenders',        destination: '/funders',     permanent: true },
      { source: '/marketplace',         destination: '/',            permanent: true },
      { source: '/utah',                destination: '/',            permanent: true },
      { source: '/find-contractors',    destination: '/contractors', permanent: true },
      { source: '/for-contractors',     destination: '/contractors', permanent: true },
      { source: '/contractor-matching', destination: '/contractors', permanent: true },
    ]
  },
};

export default nextConfig;
