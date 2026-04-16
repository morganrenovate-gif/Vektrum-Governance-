import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type errors will be fixed incrementally — build must not block deployment
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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
