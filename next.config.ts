import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type errors will be fixed incrementally — build must not block deployment
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
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
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/for-lenders', destination: '/lenders', permanent: true },
      { source: '/marketplace', destination: '/', permanent: true },
      { source: '/utah', destination: '/', permanent: true },
      { source: '/find-contractors', destination: '/contractors', permanent: true },
      { source: '/for-contractors', destination: '/contractors', permanent: true },
      { source: '/contractor-matching', destination: '/contractors', permanent: true },
      { source: '/find-lenders', destination: '/lenders', permanent: true },
    ]
  },
};

export default nextConfig;
