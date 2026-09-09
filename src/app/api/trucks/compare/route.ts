import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { publicWhere } from '@/lib/trucks';
import { getDisplayCurrency } from '@/lib/currency';
import { convertFromBase, formatMoney, VAT_LABELS } from '@/lib/money';
import { formatDate, formatMileage, formatNumber, formatWeight, humanise } from '@/lib/utils';

const MAX_COMPARE = 4;

/**
 * Returns display-ready rows for the comparison table. Formatting happens here
 * so currency conversion and locale rules stay on the server.
 */
export const GET = handler(async (request: Request) => {
  const raw = new URL(request.url).searchParams.get('ids') ?? '';
  const ids = raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARE);

  if (ids.length === 0) return ok({ trucks: [] });

  const [currency, records] = await Promise.all([
    getDisplayCurrency(),
    prisma.truck.findMany({
      where: { id: { in: ids }, ...publicWhere() },
      select: {
        id: true,
        slug: true,
        title: true,
        stockNumber: true,
        year: true,
        mileageKm: true,
        priceNet: true,
        priceOnApplication: true,
        vatTreatment: true,
        status: true,
        condition: true,
        fuelType: true,
        transmission: true,
        gears: true,
        emissions: true,
        axleConfig: true,
        grossWeightKg: true,
        payloadKg: true,
        powerBhp: true,
        engineCc: true,
        cabType: true,
        wheelbaseMm: true,
        colour: true,
        motExpiry: true,
        make: { select: { name: true } },
        category: { select: { name: true } },
        location: { select: { name: true, city: true } },
        images: {
          select: { url: true },
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
        },
      },
    }),
  ]);

  // Preserve the order the visitor added them in.
  const byId = new Map(records.map((record) => [record.id, record]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof records;

  return ok({
    trucks: ordered.map((truck) => ({
      id: truck.id,
      slug: truck.slug,
      title: truck.title,
      stockNumber: truck.stockNumber,
      year: truck.year,
      mileage: formatMileage(truck.mileageKm),
      priceFormatted: truck.priceOnApplication
        ? 'POA'
        : formatMoney(convertFromBase(truck.priceNet, currency), currency),
      vatLabel: VAT_LABELS[truck.vatTreatment],
      status: humanise(truck.status),
      make: truck.make.name,
      category: truck.category.name,
      condition: humanise(truck.condition),
      fuel: humanise(truck.fuelType),
      transmission: `${humanise(truck.transmission)}${truck.gears ? ` (${truck.gears})` : ''}`,
      emissions: truck.emissions === 'ZERO_EMISSION' ? 'Zero emission' : truck.emissions.replace('_', ' '),
      axleConfig: truck.axleConfig ?? '—',
      grossWeight: formatWeight(truck.grossWeightKg),
      payload: formatWeight(truck.payloadKg),
      power: truck.powerBhp ? `${truck.powerBhp} bhp` : '—',
      engine: truck.engineCc ? `${formatNumber(truck.engineCc)} cc` : '—',
      cabType: truck.cabType ?? '—',
      wheelbase: truck.wheelbaseMm ? `${formatNumber(truck.wheelbaseMm)} mm` : '—',
      colour: truck.colour ?? '—',
      motExpiry: truck.motExpiry ? formatDate(truck.motExpiry) : '—',
      location: truck.location ? `${truck.location.name}, ${truck.location.city}` : '—',
      imageUrl: truck.images[0]?.url ?? null,
    })),
  });
});
