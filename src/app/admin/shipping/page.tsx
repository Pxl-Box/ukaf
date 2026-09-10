import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { getBaseCurrency } from '@/lib/currency';
import { AdminHeader } from '@/components/admin/shell';
import { Alert } from '@/components/ui/primitives';
import { ShippingManager } from './ShippingManager';

export const metadata: Metadata = {
  title: 'Shipping calculator',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminShippingPage() {
  await requireRole('MANAGER', '/admin/shipping');

  const [zones, base] = await Promise.all([
    prisma.shippingZone.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { rates: { orderBy: { minWeightKg: 'asc' } } },
    }),
    getBaseCurrency(),
  ]);

  return (
    <div>
      <AdminHeader
        title="Shipping calculator"
        description="Destination zones and weight-banded rates, used to give a fast shipping estimate alongside a vehicle's price."
      />

      <Alert tone="info" className="mb-4">
        A quote is looked up by matching a vehicle&rsquo;s gross weight to a band within the chosen zone. A vehicle with
        no weight recorded, or a weight that falls outside every band in a zone, has no automatic quote — add a band
        that covers it (an open-ended top band with no upper weight covers everything above it).
      </Alert>

      <ShippingManager
        zones={zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          slug: zone.slug,
          countries: zone.countries,
          sortOrder: zone.sortOrder,
          isActive: zone.isActive,
          rates: zone.rates.map((rate) => ({
            id: rate.id,
            zoneId: rate.zoneId,
            minWeightKg: rate.minWeightKg,
            maxWeightKg: rate.maxWeightKg,
            priceNet: rate.priceNet,
            sortOrder: rate.sortOrder,
          })),
        }))}
        baseSymbol={base.symbol}
        baseCode={base.code}
      />
    </div>
  );
}
