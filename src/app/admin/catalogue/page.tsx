import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { AdminHeader } from '@/components/admin/shell';
import { CatalogueManager } from './CatalogueManager';

export const metadata: Metadata = {
  title: 'Makes & categories',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminCataloguePage() {
  await requireRole('MANAGER', '/admin/catalogue');

  const [makes, categories, locations] = await Promise.all([
    prisma.make.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        sortOrder: true,
        _count: { select: { trucks: true } },
      },
    }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        icon: true,
        sortOrder: true,
        isActive: true,
        _count: { select: { trucks: true, fields: true } },
      },
    }),
    prisma.location.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        line1: true,
        city: true,
        postcode: true,
        country: true,
        phone: true,
        email: true,
        isActive: true,
        _count: { select: { trucks: true } },
      },
    }),
  ]);

  return (
    <div>
      <AdminHeader
        title="Makes, categories & depots"
        description="The reference data behind every listing. Anything in use by stock cannot be deleted until it is reassigned."
      />

      <CatalogueManager
        makes={makes.map((make) => ({
          id: make.id,
          name: make.name,
          slug: make.slug,
          logoUrl: make.logoUrl ?? '',
          sortOrder: make.sortOrder,
          count: make._count.trucks,
        }))}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description ?? '',
          imageUrl: category.imageUrl ?? '',
          icon: category.icon ?? '',
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          count: category._count.trucks,
          fieldCount: category._count.fields,
        }))}
        locations={locations.map((location) => ({
          id: location.id,
          name: location.name,
          slug: location.slug,
          line1: location.line1 ?? '',
          city: location.city,
          postcode: location.postcode ?? '',
          country: location.country,
          phone: location.phone ?? '',
          email: location.email ?? '',
          isActive: location.isActive,
          count: location._count.trucks,
        }))}
      />
    </div>
  );
}
