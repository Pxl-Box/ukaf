import type { MetadataRoute } from 'next';
import { env, isProduction } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  // Never let a staging deployment get indexed.
  if (!isProduction) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/account',
          '/api/',
          '/checkout',
          '/cart',
          '/login',
          '/register',
          '/reset-password',
          '/forgot-password',
          '/verify-email',
          '/compare',
          '/newsletter',
          '/403',
          // Crawling every filter permutation wastes budget; the sitemap lists
          // the combinations worth indexing.
          '/trucks?*minPrice=',
          '/trucks?*maxPrice=',
          '/trucks?*sort=',
          '/trucks?*page=',
        ],
      },
      // Aggressive scrapers that add nothing.
      { userAgent: 'SemrushBot', disallow: '/' },
      { userAgent: 'AhrefsBot', disallow: '/' },
      { userAgent: 'MJ12bot', disallow: '/' },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
