import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { hasRole, requireStaff } from '@/lib/auth';
import { getBaseCurrency } from '@/lib/currency';
import { formatMoney } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/utils';
import { AdminCard, AdminHeader } from '@/components/admin/shell';
import { TruckForm, type TruckFormValues } from '../TruckForm';

export const metadata: Metadata = {
  title: 'Edit vehicle',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** Formats a minor-unit amount as a plain number for a form input. */
const asInput = (minor: number | null | undefined) =>
  minor === null || minor === undefined ? '' : (minor / 100).toFixed(2);

export default async function EditTruckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff();

  const [truck, makes, categories, locations, base] = await Promise.all([
    prisma.truck.findUnique({
      where: { id },
      include: {
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        priceHistory: { orderBy: { createdAt: 'desc' }, take: 5 },
        _count: { select: { leads: true, savedBy: true, orderItems: true } },
      },
    }),
    prisma.make.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.location.findMany({
      where: { isActive: true },
      select: { id: true, name: true, city: true },
      orderBy: { name: 'asc' },
    }),
    getBaseCurrency(),
  ]);

  if (!truck) notFound();

  const initial: TruckFormValues = {
    id: truck.id,
    title: truck.title,
    stockNumber: truck.stockNumber,
    slug: truck.slug,
    makeId: truck.makeId,
    modelName: truck.modelName,
    variant: truck.variant ?? '',
    categoryId: truck.categoryId,
    locationId: truck.locationId ?? '',
    year: String(truck.year),
    mileageKm: truck.mileageKm != null ? String(truck.mileageKm) : '',
    condition: truck.condition,
    fuelType: truck.fuelType,
    transmission: truck.transmission,
    gears: truck.gears != null ? String(truck.gears) : '',
    emissions: truck.emissions,
    axleConfig: truck.axleConfig ?? '',
    cabType: truck.cabType ?? '',
    bodyLengthMm: truck.bodyLengthMm != null ? String(truck.bodyLengthMm) : '',
    wheelbaseMm: truck.wheelbaseMm != null ? String(truck.wheelbaseMm) : '',
    grossWeightKg: truck.grossWeightKg != null ? String(truck.grossWeightKg) : '',
    payloadKg: truck.payloadKg != null ? String(truck.payloadKg) : '',
    engineCc: truck.engineCc != null ? String(truck.engineCc) : '',
    powerBhp: truck.powerBhp != null ? String(truck.powerBhp) : '',
    colour: truck.colour ?? '',
    previousOwners: truck.previousOwners != null ? String(truck.previousOwners) : '',
    motExpiry: truck.motExpiry ? truck.motExpiry.toISOString().slice(0, 10) : '',
    serviceHistory: truck.serviceHistory ?? '',
    registration: truck.registration ?? '',
    vin: truck.vin ?? '',
    costPriceNet: asInput(truck.costPriceNet),
    priceNet: asInput(truck.priceNet),
    retailPriceNet: asInput(truck.retailPriceNet),
    vatTreatment: truck.vatTreatment,
    vatRate: String(truck.vatRate),
    priceOnApplication: truck.priceOnApplication,
    reservationFee: asInput(truck.reservationFee),
    quantity: String(truck.quantity),
    status: truck.status,
    featured: truck.featured,
    shortDescription: truck.shortDescription ?? '',
    description: truck.description ?? '',
    features: truck.features.join('\n'),
    metaTitle: truck.metaTitle ?? '',
    metaDescription: truck.metaDescription ?? '',
    customFields: (truck.customFields as Record<string, unknown>) ?? {},
  };

  return (
    <div>
      <AdminHeader
        title={truck.title}
        description={`Stock ${truck.stockNumber} · created ${formatDate(truck.createdAt)} · updated ${formatDateTime(truck.updatedAt)}`}
        breadcrumb={{ label: 'Back to vehicles', href: '/admin/trucks' }}
        action={
          truck.status !== 'DRAFT' ? (
            <Link href={`/trucks/${truck.slug}`} target="_blank" className="btn-secondary btn-sm">
              View on site
            </Link>
          ) : null
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Views', value: truck.viewCount },
          { label: 'Enquiries', value: truck._count.leads },
          { label: 'Saved by', value: truck._count.savedBy },
          { label: 'On orders', value: truck._count.orderItems },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl border border-steel-200 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-steel-500">{metric.label}</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums">{metric.value}</p>
          </div>
        ))}
      </div>

      <TruckForm
        initial={initial}
        makes={makes.map((make) => ({ value: make.id, label: make.name }))}
        categories={categories.map((category) => ({ value: category.id, label: category.name }))}
        locations={locations.map((location) => ({
          value: location.id,
          label: `${location.name} (${location.city})`,
        }))}
        currencySymbol={base.symbol}
        images={truck.images.map((image) => ({
          id: image.id,
          url: image.url,
          alt: image.alt,
          isPrimary: image.isPrimary,
        }))}
        canDelete={hasRole(user, 'MANAGER')}
      />

      {truck.priceHistory.length > 0 ? (
        <AdminCard title="Price history" className="mt-4">
          <ul className="divide-y divide-steel-100 text-sm">
            {truck.priceHistory.map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-3 py-2.5">
                <span className="text-steel-700">
                  {formatMoney(entry.oldPriceNet, base)} → {formatMoney(entry.newPriceNet, base)}
                  <span
                    className={
                      entry.newPriceNet < entry.oldPriceNet
                        ? 'ml-2 text-xs font-medium text-emerald-600'
                        : 'ml-2 text-xs font-medium text-red-600'
                    }
                  >
                    {entry.newPriceNet < entry.oldPriceNet ? '↓' : '↑'}{' '}
                    {formatMoney(Math.abs(entry.newPriceNet - entry.oldPriceNet), base)}
                  </span>
                </span>
                <span className="text-xs text-steel-400">{formatDateTime(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        </AdminCard>
      ) : null}
    </div>
  );
}
