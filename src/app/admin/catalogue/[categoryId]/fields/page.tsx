import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { AdminHeader } from '@/components/admin/shell';
import { Alert } from '@/components/ui/primitives';
import { CategoryFieldManager } from './CategoryFieldManager';

export const metadata: Metadata = {
  title: 'Category fields',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CategoryFieldsPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  await requireRole('MANAGER', '/admin/catalogue');
  const { categoryId } = await params;

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { fields: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!category) notFound();

  return (
    <div>
      <AdminHeader
        title={`${category.name} — fields`}
        description="The extra details a listing in this category asks for, beyond the standard price, year, mileage and description."
        breadcrumb={{ label: 'Back to makes & categories', href: '/admin/catalogue' }}
      />

      <Alert tone="info" className="mb-4">
        These appear as extra inputs on the vehicle form whenever <strong>{category.name}</strong> is selected as the
        body type, and — where you turn on <strong>Show on detail page</strong> — as extra rows in that
        vehicle&rsquo;s specification table on the public site. Fields marked <strong>Show in filters</strong> also
        become filter controls on the stock listing whenever a visitor filters by this category.
      </Alert>

      <CategoryFieldManager
        categoryId={category.id}
        categoryName={category.name}
        fields={category.fields.map((field) => ({
          id: field.id,
          key: field.key,
          label: field.label,
          type: field.type,
          unit: field.unit ?? '',
          options: field.options,
          required: field.required,
          showOnDetail: field.showOnDetail,
          showInFilters: field.showInFilters,
          helpText: field.helpText ?? '',
          sortOrder: field.sortOrder,
        }))}
      />
    </div>
  );
}
