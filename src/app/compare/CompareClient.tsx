'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, readCompare, writeCompare } from '@/lib/client-api';
import { cn, PLACEHOLDER_IMAGE } from '@/lib/utils';
import { CloseIcon, CompareIcon } from '@/components/ui/Icons';
import { EmptyState, Spinner } from '@/components/ui/primitives';

type CompareTruck = {
  id: string;
  slug: string;
  title: string;
  stockNumber: string;
  year: number;
  mileage: string;
  priceFormatted: string;
  vatLabel: string;
  status: string;
  make: string;
  category: string;
  condition: string;
  fuel: string;
  transmission: string;
  emissions: string;
  axleConfig: string;
  grossWeight: string;
  payload: string;
  power: string;
  engine: string;
  cabType: string;
  wheelbase: string;
  colour: string;
  motExpiry: string;
  location: string;
  imageUrl: string | null;
};

/** Rows are ordered by how often buyers actually use them to decide. */
const ROWS: Array<{ key: keyof CompareTruck; label: string }> = [
  { key: 'priceFormatted', label: 'Price' },
  { key: 'vatLabel', label: 'VAT' },
  { key: 'year', label: 'Year' },
  { key: 'mileage', label: 'Mileage' },
  { key: 'make', label: 'Make' },
  { key: 'category', label: 'Body type' },
  { key: 'axleConfig', label: 'Axle config' },
  { key: 'grossWeight', label: 'Gross weight' },
  { key: 'payload', label: 'Payload' },
  { key: 'power', label: 'Power' },
  { key: 'engine', label: 'Engine' },
  { key: 'transmission', label: 'Gearbox' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'emissions', label: 'Emissions' },
  { key: 'cabType', label: 'Cab' },
  { key: 'wheelbase', label: 'Wheelbase' },
  { key: 'colour', label: 'Colour' },
  { key: 'motExpiry', label: 'MOT expiry' },
  { key: 'condition', label: 'Condition' },
  { key: 'location', label: 'Location' },
  { key: 'status', label: 'Availability' },
];

export function CompareClient() {
  const [ids, setIds] = useState<string[]>([]);
  const [trucks, setTrucks] = useState<CompareTruck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIds(readCompare());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (ids.length === 0) {
        setTrucks([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await apiFetch<{ trucks: CompareTruck[] }>(
          `/api/trucks/compare?ids=${encodeURIComponent(ids.join(','))}`,
        );
        if (!cancelled) {
          setTrucks(data.trucks);
          // Drop any ids that no longer resolve (sold and archived, say).
          const found = new Set(data.trucks.map((truck) => truck.id));
          const pruned = ids.filter((id) => found.has(id));
          if (pruned.length !== ids.length) writeCompare(pruned);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load your comparison.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  function remove(id: string) {
    const next = ids.filter((entry) => entry !== id);
    setIds(next);
    writeCompare(next);
  }

  function clearAll() {
    setIds([]);
    writeCompare([]);
  }

  if (loading) {
    return (
      <div className="mt-10 flex items-center justify-center gap-2 py-16 text-steel-500">
        <Spinner /> Loading comparison…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-10">
        <EmptyState title="Could not load your comparison" description={error} />
      </div>
    );
  }

  if (trucks.length === 0) {
    return (
      <div className="mt-10">
        <EmptyState
          icon={<CompareIcon />}
          title="Nothing to compare yet"
          description="Add up to four vehicles from any listing using the “Add to compare” button, then return here to see them side by side."
          action={
            <Link href="/trucks" className="btn-primary">
              Browse stock
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={clearAll} className="btn-ghost btn-sm">
          <CloseIcon /> Clear comparison
        </button>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <caption className="sr-only">Vehicle comparison</caption>
          <thead>
            <tr>
              <th scope="col" className="w-36 border-b border-steel-200 p-3 text-left align-bottom">
                <span className="sr-only">Specification</span>
              </th>
              {trucks.map((truck) => (
                <th key={truck.id} scope="col" className="border-b border-steel-200 p-3 align-bottom">
                  <div className="relative w-full min-w-44">
                    <button
                      type="button"
                      onClick={() => remove(truck.id)}
                      aria-label={`Remove ${truck.title} from comparison`}
                      className="absolute -right-1 -top-1 z-10 grid h-7 w-7 place-items-center rounded-full bg-white text-steel-500 shadow-sm hover:text-red-600"
                    >
                      <CloseIcon className="text-sm" />
                    </button>

                    <Link href={`/trucks/${truck.slug}`} className="block">
                      <span className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-steel-100">
                        <Image
                          src={truck.imageUrl ?? PLACEHOLDER_IMAGE}
                          alt=""
                          fill
                          sizes="220px"
                          className="object-cover"
                        />
                      </span>
                      <span className="mt-2 block text-left text-sm font-semibold leading-snug text-steel-900 hover:text-brand-700">
                        {truck.title}
                      </span>
                      <span className="mt-0.5 block text-left text-xs font-normal text-steel-400">
                        Stock {truck.stockNumber}
                      </span>
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {ROWS.map((row, index) => {
              const values = trucks.map((truck) => String(truck[row.key] ?? '—'));
              // Highlight rows where the vehicles actually differ.
              const differs = new Set(values).size > 1 && trucks.length > 1;

              return (
                <tr key={row.key} className={cn(index % 2 === 0 ? 'bg-white' : 'bg-steel-50/60')}>
                  <th
                    scope="row"
                    className="border-b border-steel-100 p-3 text-left text-xs font-medium uppercase tracking-wide text-steel-500"
                  >
                    {row.label}
                  </th>
                  {values.map((value, position) => (
                    <td
                      key={`${row.key}-${trucks[position].id}`}
                      className={cn(
                        'border-b border-steel-100 p-3 align-top',
                        differs ? 'font-medium text-steel-900' : 'text-steel-600',
                      )}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              );
            })}

            <tr>
              <td className="p-3" />
              {trucks.map((truck) => (
                <td key={`cta-${truck.id}`} className="p-3">
                  <Link href={`/trucks/${truck.slug}`} className="btn-primary btn-sm w-full">
                    View details
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
