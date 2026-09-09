import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getCategoryFilterFields, getFilterFacets, searchTrucks } from '@/lib/trucks';
import { buildCustomFieldWhere } from '@/lib/category-fields';
import { getDisplayCurrency } from '@/lib/currency';
import { truckFilterSchema } from '@/lib/validation';
import { TruckCard, TruckCardSkeleton } from '@/components/TruckCard';
import { TruckFilters, SortSelect } from '@/components/TruckFilters';
import { Pagination } from '@/components/ui/Pagination';
import { Breadcrumbs, EmptyState } from '@/components/ui/primitives';
import { TruckIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Used HGVs & commercial vehicles for sale',
  description:
    'Browse our full stock of used HGVs, tractor units, tippers, curtainsiders and rigids. Filter by make, body type, year, mileage and price.',
  alternates: { canonical: '/trucks' },
};

const PAGE_SIZE = 12;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TrucksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // Unknown or malformed query parameters degrade to defaults rather than 500.
  const flat = flatten(params);
  const parsed = truckFilterSchema.safeParse(flat);
  const filters = parsed.success ? parsed.data : truckFilterSchema.parse({});

  // `cf_<key>=<value>` are the admin-defined category filters — dynamic per
  // category, so they live outside the fixed truckFilterSchema.
  const customFieldParams = Object.fromEntries(
    Object.entries(flat).filter(([key]) => key.startsWith('cf_')),
  );

  const [categoryFilterFields, facets, currency, user] = await Promise.all([
    getCategoryFilterFields(filters.category),
    getFilterFacets(),
    getDisplayCurrency(),
    getCurrentUser(),
  ]);

  const customFieldClauses = buildCustomFieldWhere(categoryFilterFields, customFieldParams);

  const { trucks, total, page, pages, limit } = await searchTrucks(filters, {
    limit: PAGE_SIZE,
    customFieldClauses,
  });

  const savedIds = user
    ? new Set(
        (
          await prisma.savedTruck.findMany({
            where: { userId: user.id },
            select: { truckId: true },
          })
        ).map((entry) => entry.truckId),
      )
    : new Set<string>();

  const activeCategory = filters.category
    ? facets.categories.find((category) => category.slug === filters.category)
    : undefined;
  const activeMake = filters.make ? facets.makes.find((make) => make.slug === filters.make) : undefined;

  const heading =
    activeMake && activeCategory
      ? `${activeMake.name} ${activeCategory.name}`
      : activeCategory
        ? `${activeCategory.name} for sale`
        : activeMake
          ? `Used ${activeMake.name} trucks for sale`
          : filters.q
            ? `Search results for “${filters.q}”`
            : 'All stock';

  return (
    <div className="container-page py-8">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Stock', href: '/trucks' },
          ...(activeCategory ? [{ label: activeCategory.name }] : []),
        ]}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">{heading}</h1>
        <p className="mt-1.5 text-sm text-steel-500">
          {total} {total === 1 ? 'vehicle' : 'vehicles'} available
          {filters.q ? ' matching your search' : ''}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <Suspense fallback={<div className="h-10 animate-pulse rounded-lg bg-steel-200 lg:h-96" />}>
          <TruckFilters
            facets={facets}
            currencySymbol={currency.symbol}
            rate={currency.rateToBase}
            categoryFilterFields={categoryFilterFields.map((field) => ({
              key: field.key,
              label: field.label,
              type: field.type,
              options: field.options,
            }))}
          />
        </Suspense>

        <section aria-label="Search results">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-steel-200 pb-4">
            <ActiveFilterPills filters={filters} facets={facets} customFieldParams={customFieldParams} />
            <Suspense fallback={null}>
              <SortSelect />
            </Suspense>
          </div>

          {trucks.length === 0 ? (
            <EmptyState
              icon={<TruckIcon />}
              title="No vehicles match those filters"
              description="Try widening your price or year range, or clear the filters to see everything we have in stock. If you tell us what you are looking for, we will contact you when something suitable arrives."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/trucks" className="btn-secondary">
                    Clear filters
                  </Link>
                  <Link href="/contact" className="btn-primary">
                    Register your requirements
                  </Link>
                </div>
              }
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {trucks.map((truck, index) => (
                  <Suspense key={truck.id} fallback={<TruckCardSkeleton />}>
                    <TruckCard truck={truck} isSaved={savedIds.has(truck.id)} priority={index < 3} />
                  </Suspense>
                ))}
              </div>

              <Pagination
                page={page}
                pages={pages}
                total={total}
                limit={limit}
                searchParams={params}
                basePath="/trucks"
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** Chips summarising what is currently filtered, each removable. */
function ActiveFilterPills({
  filters,
  facets,
  customFieldParams,
}: {
  filters: ReturnType<typeof truckFilterSchema.parse>;
  facets: Awaited<ReturnType<typeof getFilterFacets>>;
  customFieldParams: Record<string, string>;
}) {
  const pills: Array<{ key: string; label: string }> = [];

  if (filters.q) pills.push({ key: 'q', label: `“${filters.q}”` });
  if (filters.make) {
    const make = facets.makes.find((entry) => entry.slug === filters.make);
    pills.push({ key: 'make', label: make?.name ?? filters.make });
  }
  if (filters.category) {
    const category = facets.categories.find((entry) => entry.slug === filters.category);
    pills.push({ key: 'category', label: category?.name ?? filters.category });
  }
  if (filters.emissions) pills.push({ key: 'emissions', label: filters.emissions.replace('_', ' ') });
  if (filters.transmission) pills.push({ key: 'transmission', label: filters.transmission.toLowerCase() });
  if (filters.axleConfig) pills.push({ key: 'axleConfig', label: filters.axleConfig });
  if (filters.maxMileage) {
    pills.push({ key: 'maxMileage', label: `under ${filters.maxMileage.toLocaleString('en-GB')} km` });
  }
  for (const [key, value] of Object.entries(customFieldParams)) {
    pills.push({ key, label: value });
  }

  if (pills.length === 0) {
    return <p className="text-sm text-steel-400">Showing all available stock</p>;
  }

  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      <li className="text-sm text-steel-500">Filtered by:</li>
      {pills.map((pill) => (
        <li key={pill.key}>
          <span className="badge-info capitalize">{pill.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Query strings can repeat a key; the schema expects single values. */
function flatten(params: SearchParams): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    output[key] = Array.isArray(value) ? value[0] ?? '' : value;
  }
  return output;
}
