import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/about',
          '/careers',
          '/contact',
          '/contractors',
          '/demo',
          '/demo-live',
          '/founders',
          '/funders',
          '/help',
          '/lenders',
          '/partners',
          '/pricing',
          '/privacy',
          '/resources',
          '/security',
          '/terms',
          '/llms.txt',
        ],
        disallow: [
          '/auth/',
          '/dashboard/',
          '/api/',
          '/pitch',
          '/demo-live/admin',
          '/demo-live/audit',
          '/invite/',
          '/forgot-password',
        ],
      },
    ],
    sitemap: 'https://vektrum.io/sitemap.xml',
  }
}
