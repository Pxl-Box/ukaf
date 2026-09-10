'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AdminCard } from '@/components/admin/shell';
import { SelectField } from '@/components/forms/fields';

type QuoteRate = { minWeightKg: number; maxWeightKg: number | null; priceNet: number };
type QuoteZone = { id: string; name: string; rates: QuoteRate[] };

function formatMoney(minor: number, symbol: string): string {
  return `${symbol}${(minor / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Fast quoting panel: vehicle price + a matching shipping rate = total, so
 * staff can answer "how much to ship this to X" the moment an enquiry comes
 * in, without re-keying anything.
 */
export function ShippingQuotePanel({
  vehiclePriceNet,
  grossWeightKg,
  zones,
  currencySymbol,
}: {
  vehiclePriceNet: number;
  grossWeightKg: number | null;
  zones: QuoteZone[];
  currencySymbol: string;
}) {
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? '');

  const zone = zones.find((z) => z.id === zoneId) ?? null;

  const rate = useMemo(() => {
    if (!zone || grossWeightKg === null) return null;
    return (
      zone.rates.find(
        (candidate) =>
          grossWeightKg >= candidate.minWeightKg &&
          (candidate.maxWeightKg === null || grossWeightKg < candidate.maxWeightKg),
      ) ?? null
    );
  }, [zone, grossWeightKg]);

  if (zones.length === 0) {
    return (
      <AdminCard title="Shipping quote">
        <p className="text-sm text-steel-500">
          No shipping zones are set up yet.{' '}
          <Link href="/admin/shipping" className="text-brand-600 hover:underline">
            Add one
          </Link>{' '}
          to quote shipping alongside the vehicle price.
        </p>
      </AdminCard>
    );
  }

  return (
    <AdminCard title="Shipping quote">
      <SelectField
        name="zone"
        label="Destination"
        value={zoneId}
        onChange={(event) => setZoneId(event.target.value)}
        options={zones.map((z) => ({ value: z.id, label: z.name }))}
      />

      <dl className="mt-4 space-y-2 border-t border-steel-100 pt-3 text-sm dark:border-steel-800">
        <div className="flex justify-between">
          <dt className="text-steel-500 dark:text-steel-400">Vehicle price</dt>
          <dd className="font-medium tabular-nums text-steel-900 dark:text-steel-100">
            {formatMoney(vehiclePriceNet, currencySymbol)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-steel-500 dark:text-steel-400">
            Shipping{grossWeightKg !== null ? ` (${grossWeightKg.toLocaleString()} kg)` : ''}
          </dt>
          <dd className="font-medium tabular-nums text-steel-900 dark:text-steel-100">
            {grossWeightKg === null
              ? 'No weight recorded'
              : rate
                ? formatMoney(rate.priceNet, currencySymbol)
                : 'No band covers this weight'}
          </dd>
        </div>
        <div className="flex justify-between border-t border-steel-100 pt-2 text-base font-semibold dark:border-steel-800">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatMoney(vehiclePriceNet + (rate?.priceNet ?? 0), currencySymbol)}</dd>
        </div>
      </dl>

      {grossWeightKg === null ? (
        <p className="mt-3 text-xs text-steel-400">
          This vehicle has no gross weight recorded, so shipping can&rsquo;t be matched automatically — set it on the
          vehicle&rsquo;s listing, or quote shipping manually.
        </p>
      ) : !rate ? (
        <p className="mt-3 text-xs text-steel-400">
          No rate band in this zone covers {grossWeightKg.toLocaleString()} kg —{' '}
          <Link href="/admin/shipping" className="text-brand-600 hover:underline">
            add one
          </Link>
          .
        </p>
      ) : null}
    </AdminCard>
  );
}
