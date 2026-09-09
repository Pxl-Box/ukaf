import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { publicWhere } from '@/lib/trucks';
import { env } from '@/lib/env';

export const revalidate = 3600;

/** Static routes worth indexing, with a rough priority ordering. */
const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { path: '', priority: 1, changeFrequency: 'daily' },
  { path: '/trucks', priority: 0.9, changeFrequency: 'hourly' },
  { path: '/finance', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/part-exchange', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/sell-your-truck', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/delivery', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/warranty', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/legal/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/cookies', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/returns', priority: 0.3, changeFrequency: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${env.siteUrl}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const [trucks, categories, makes] = await Promise.all([
      prisma.truck.findMany({
        where: { ...publicWhere(), status: { in: ['AVAILABLE', 'RESERVED'] } },
        select: { slug: true, updatedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 5000,
      }),
      prisma.category.findMany({ where: { isActive: true }, select: { slug: true } }),
      prisma.make.findMany({
        where: { trucks: { some: publicWhere() } },
        select: { slug: true },
      }),
    ]);

    entries.push(
      ...trucks.map((truck) => ({
        url: `${env.siteUrl}/trucks/${truck.slug}`,
        lastModified: truck.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      // Faceted listing pages are genuinely useful landing pages for search.
      ...categories.map((category) => ({
        url: `${env.siteUrl}/trucks?category=${category.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
      ...makes.map((make) => ({
        url: `${env.siteUrl}/trucks?make=${make.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      })),
    );
  } catch {
    // Database unavailable at build time — ship the static routes only.
  }

  return entries;
}
