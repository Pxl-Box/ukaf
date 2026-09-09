import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getBaseCurrency } from '@/lib/currency';
import { getSettings } from '@/lib/settings';
import { AdminHeader } from '@/components/admin/shell';
import { TruckForm, type TruckFormValues } from '../TruckForm';

export const metadata: Metadata = {
  title: 'Add vehicle',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewTruckPage() {
  await requireStaff();

  const [makes, categories, locations, base, settings, stockCount] = await Promise.all([
    prisma.make.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.location.findMany({
      where: { isActive: true },
      select: { id: true, name: true, city: true },
      orderBy: { name: 'asc' },
    }),
    getBaseCurrency(),
    getSettings(),
    prisma.truck.count(),
  ]);

  // Suggest the next sequential stock number, e.g. UK-0042.
  const suggestedStockNumber = `UK-${String(stockCount + 1).padStart(4, '0')}`;

  const initial: TruckFormValues = {
    title: '',
    stockNumber: suggestedStockNumber,
    slug: '',
    makeId: '',
    modelName: '',
    variant: '',
    categoryId: '',
    locationId: '',
    year: String(new Date().getFullYear() - 4),
    mileageKm: '',
    condition: 'USED',
    fuelType: 'DIESEL',
    transmission: 'AUTOMATIC',
    gears: '',
    emissions: 'EURO_6',
    axleConfig: '',
    cabType: '',
    bodyLengthMm: '',
    wheelbaseMm: '',
    grossWeightKg: '',
    payloadKg: '',
    engineCc: '',
    powerBhp: '',
    colour: '',
    previousOwners: '',
    motExpiry: '',
    serviceHistory: '',
    registration: '',
    vin: '',
    costPriceNet: '',
    priceNet: '',
    retailPriceNet: '',
    vatTreatment: 'PLUS_VAT',
    vatRate: String(settings.defaultVatRate),
    priceOnApplication: false,
    reservationFee: (settings.defaultReservationFee / 100).toFixed(2),
    quantity: '1',
    status: 'DRAFT',
    featured: false,
    shortDescription: '',
    description: '',
    features: '',
    metaTitle: '',
    metaDescription: '',
    customFields: {},
  };

  return (
    <div>
      <AdminHeader
        title="Add a vehicle"
        description="Create the listing as a draft, add photographs, then publish when it is ready."
        breadcrumb={{ label: 'Back to vehicles', href: '/admin/trucks' }}
      />

      <TruckForm
        initial={initial}
        makes={makes.map((make) => ({ value: make.id, label: make.name }))}
        categories={categories.map((category) => ({ value: category.id, label: category.name }))}
        locations={locations.map((location) => ({
          value: location.id,
          label: `${location.name} (${location.city})`,
        }))}
        currencySymbol={base.symbol}
      />
    </div>
  );
}
