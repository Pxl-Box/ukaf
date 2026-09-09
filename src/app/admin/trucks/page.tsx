import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getBaseCurrency } from '@/lib/currency';
import { formatMoney } from '@/lib/money';
import { formatDate, formatMileage, humanise, PLACEHOLDER_IMAGE } from '@/lib/utils';
import { Badge } from '@/components/ui/primitives';
import { AdminCard, AdminHeader, EmptyRow, TableWrap, Td, Th } from '@/components/admin/shell';
import { Pagination } from '@/components/ui/Pagination';
import { PlusIcon } from '@/components/ui/Icons';
import { AdminStockFilters } from './AdminStockFilters';
import type { Prisma } from '@prisma/client';

export const metadata: Metadata = {
  title: 'Vehicles',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  AVAILABLE: 'success',
  RESERVED: 'warning',
  SOLD: 'danger',
  DRAFT: 'neutral',
  ARCHIVED: 'neutral',
};

export default async function AdminTrucksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();
  const params = await searchParams;

  const single = (key: string) => {
    const value = params[key];
    return typeof value === 'string' && value ? value : undefined;
  };

  const page = Math.max(1, Number(single('page') ?? '1') || 1);
  const q = single('q');
  const status = single('status');
  const makeId = single('make');
  const categoryId = single('category');

  const where: Prisma.TruckWhereInput = {
    ...(status ? { status: status as Prisma.EnumStockStatusFilter['equals'] } : {}),
    ...(makeId ? { makeId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { stockNumber: { contains: q, mode: 'insensitive' } },
            { modelName: { contains: q, mode: 'insensitive' } },
            { registration: { contains: q, mode: 'insensitive' } },
            { vin: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, trucks, makes, categories, base, counts] = await Promise.all([
    prisma.truck.count({ where }),
    prisma.truck.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        stockNumber: true,
        title: true,
        year: true,
        mileageKm: true,
        priceNet: true,
        costPriceNet: true,
        priceOnApplication: true,
        status: true,
        featured: true,
        isDemoData: true,
        viewCount: true,
        updatedAt: true,
        registration: true,
        make: { select: { name: true } },
        category: { select: { name: true } },
        images: { select: { url: true }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
        _count: { select: { leads: true, savedBy: true } },
      },
    }),
    prisma.make.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: 'asc' } }),
    getBaseCurrency(),
    prisma.truck.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const byStatus = Object.fromEntries(counts.map((entry) => [entry.status, entry._count._all]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <AdminHeader
        title="Vehicles"
        description={`${total} ${total === 1 ? 'vehicle' : 'vehicles'} matching your filters`}
        action={
          <Link href="/admin/trucks/new" className="btn-primary btn-sm">
            <PlusIcon /> Add vehicle
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(['AVAILABLE', 'RESERVED', 'SOLD', 'DRAFT', 'ARCHIVED'] as const).map((entry) => (
          <Link
            key={entry}
            href={status === entry ? '/admin/trucks' : `/admin/trucks?status=${entry}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              status === entry
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-steel-200 bg-white text-steel-600 hover:bg-steel-50'
            }`}
          >
            {humanise(entry)}{' '}
            <span className="tabular-nums text-steel-400">{byStatus[entry] ?? 0}</span>
          </Link>
        ))}
      </div>

      <AdminCard padded={false}>
        <div className="border-b border-steel-200 p-4">
          <AdminStockFilters makes={makes} categories={categories} />
        </div>

        <TableWrap>
          <thead>
            <tr>
              <Th>Vehicle</Th>
              <Th>Stock no.</Th>
              <Th align="right">Price</Th>
              <Th align="right">Margin</Th>
              <Th align="center">Interest</Th>
              <Th>Status</Th>
              <Th>Updated</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {trucks.length === 0 ? (
              <EmptyRow colSpan={8} message="No vehicles match those filters." />
            ) : (
              trucks.map((truck) => {
                const margin =
                  truck.costPriceNet != null ? truck.priceNet - truck.costPriceNet : null;

                return (
                  <tr key={truck.id} className="hover:bg-steel-50">
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="relative h-11 w-14 shrink-0 overflow-hidden rounded bg-steel-100">
                          <Image
                            src={truck.images[0]?.url ?? PLACEHOLDER_IMAGE}
                            alt=""
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/admin/trucks/${truck.id}`}
                              className="block max-w-64 truncate text-sm font-medium text-steel-900 hover:text-brand-700"
                            >
                              {truck.title}
                              {truck.featured ? <span className="ml-1.5 text-accent-500">★</span> : null}
                            </Link>
                            {truck.isDemoData ? (
                              <span
                                title="Example listing created by the demo-data generator, not by staff"
                                className="shrink-0 rounded bg-steel-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-steel-500"
                              >
                                Demo
                              </span>
                            ) : null}
                          </div>
                          <span className="block truncate text-xs text-steel-400">
                            {truck.year} {truck.make.name} · {truck.category.name} ·{' '}
                            {formatMileage(truck.mileageKm)}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-xs">
                      {truck.stockNumber}
                      {truck.registration ? (
                        <span className="block text-steel-400">{truck.registration}</span>
                      ) : null}
                    </Td>
                    <Td align="right" className="whitespace-nowrap tabular-nums">
                      {truck.priceOnApplication ? (
                        <span className="text-steel-400">POA</span>
                      ) : (
                        formatMoney(truck.priceNet, base)
                      )}
                    </Td>
                    <Td align="right" className="whitespace-nowrap tabular-nums text-xs">
                      {margin === null ? (
                        <span className="text-steel-300">—</span>
                      ) : (
                        <span className={margin > 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {formatMoney(margin, base)}
                        </span>
                      )}
                    </Td>
                    <Td align="center" className="whitespace-nowrap text-xs text-steel-500">
                      {truck.viewCount} views · {truck._count.leads} enq · {truck._count.savedBy} saved
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[truck.status] ?? 'neutral'}>{humanise(truck.status)}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-steel-400">
                      {formatDate(truck.updatedAt)}
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/admin/trucks/${truck.id}`} className="btn-ghost btn-sm">
                          Edit
                        </Link>
                        {truck.status !== 'DRAFT' ? (
                          <Link
                            href={`/trucks/${truck.slug}`}
                            target="_blank"
                            className="btn-ghost btn-sm text-steel-500"
                          >
                            View
                          </Link>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableWrap>
      </AdminCard>

      <Pagination
        page={page}
        pages={pages}
        total={total}
        limit={PAGE_SIZE}
        searchParams={params}
        basePath="/admin/trucks"
      />
    </div>
  );
}
