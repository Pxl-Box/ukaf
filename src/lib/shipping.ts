import { prisma } from './db';

/**
 * Shipping cost calculator.
 *
 * A rate applies to a zone + a weight band; the band whose [min, max) range
 * contains the vehicle's gross weight determines the price. `maxWeightKg`
 * null means "and above" — the open-ended top band.
 */

export async function getActiveShippingZones() {
  return prisma.shippingZone.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { rates: { orderBy: { minWeightKg: 'asc' } } },
  });
}

export type ShippingQuote = {
  zoneId: string;
  zoneName: string;
  rateId: string;
  priceNet: number;
  minWeightKg: number;
  maxWeightKg: number | null;
};

/**
 * Finds the rate covering a given weight within a zone. Returns null when the
 * zone has no band covering that weight (e.g. every band has an upper bound
 * lower than the vehicle's weight, or the zone has no rates at all).
 */
export async function quoteShipping(zoneId: string, grossWeightKg: number): Promise<ShippingQuote | null> {
  const zone = await prisma.shippingZone.findUnique({
    where: { id: zoneId },
    include: { rates: { orderBy: { minWeightKg: 'asc' } } },
  });
  if (!zone) return null;

  const rate = zone.rates.find(
    (candidate) =>
      grossWeightKg >= candidate.minWeightKg && (candidate.maxWeightKg === null || grossWeightKg < candidate.maxWeightKg),
  );
  if (!rate) return null;

  return {
    zoneId: zone.id,
    zoneName: zone.name,
    rateId: rate.id,
    priceNet: rate.priceNet,
    minWeightKg: rate.minWeightKg,
    maxWeightKg: rate.maxWeightKg,
  };
}
