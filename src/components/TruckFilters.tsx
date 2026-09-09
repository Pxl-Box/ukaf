'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { FilterFacets } from '@/lib/trucks';
import { cn } from '@/lib/utils';
import { CloseIcon, FilterIcon } from './ui/Icons';
import { Spinner } from './ui/primitives';

/**
 * Faceted filter panel.
 *
 * State lives entirely in the URL, so every filtered view is shareable,
 * bookmarkable and server-rendered. The component only writes to the query
 * string and lets the server component re-fetch.
 */

export type CategoryFilterField = {
  key: string;
  label: string;
  /** 'BOOLEAN' | 'SELECT' | 'MULTISELECT' — the only filterable field types. */
  type: string;
  options: string[];
};

type Props = {
  facets: FilterFacets;
  currencySymbol: string;
  /** Display-currency units per base unit, for converting the price bounds. */
  rate: number;
  /**
   * The selected category's admin-defined filter fields — e.g. "Cars" might
   * add a "Transmission style" filter here. Empty until a category with such
   * fields is selected.
   */
  categoryFilterFields?: CategoryFilterField[];
};

const CONDITIONS = [
  { value: 'USED', label: 'Used' },
  { value: 'NEW', label: 'New' },
  { value: 'EX_DEMO', label: 'Ex-demo' },
];

const FUEL_TYPES = [
  { value: 'DIESEL', label: 'Diesel' },
  { value: 'ELECTRIC', label: 'Electric' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'CNG', label: 'CNG' },
  { value: 'LNG', label: 'LNG' },
  { value: 'HYDROGEN', label: 'Hydrogen' },
];

const TRANSMISSIONS = [
  { value: 'AUTOMATIC', label: 'Automatic' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'SEMI_AUTOMATIC', label: 'Semi-automatic' },
];

const EMISSIONS = [
  { value: 'EURO_6', label: 'Euro 6' },
  { value: 'EURO_5', label: 'Euro 5' },
  { value: 'EURO_4', label: 'Euro 4' },
  { value: 'EURO_3', label: 'Euro 3' },
  { value: 'ZERO_EMISSION', label: 'Zero emission' },
];

export function TruckFilters({ facets, currencySymbol, rate, categoryFilterFields = [] }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Price inputs are held locally so typing does not fire a request per keystroke.
  const toDisplay = (baseMinor: string | null) => {
    if (!baseMinor) return '';
    const value = (Number(baseMinor) / 10 ** 2) * rate;
    return Number.isFinite(value) ? String(Math.round(value)) : '';
  };
  const toBase = (display: string) => {
    if (!display.trim()) return '';
    const value = (Number(display.replace(/[^0-9.]/g, '')) / rate) * 100;
    return Number.isFinite(value) ? String(Math.round(value)) : '';
  };

  const [minPrice, setMinPrice] = useState(() => toDisplay(searchParams.get('minPrice')));
  const [maxPrice, setMaxPrice] = useState(() => toDisplay(searchParams.get('maxPrice')));

  useEffect(() => {
    setMinPrice(toDisplay(searchParams.get('minPrice')));
    setMaxPrice(toDisplay(searchParams.get('maxPrice')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  function apply(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    // Any filter change resets to the first page.
    params.delete('page');

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function toggle(key: string, value: string) {
    apply({ [key]: searchParams.get(key) === value ? null : value });
  }

  const activeCount = [
    'make', 'category', 'condition', 'fuelType', 'transmission', 'emissions', 'axleConfig', 'location',
    'minPrice', 'maxPrice', 'minYear', 'maxYear', 'maxMileage', 'q',
    ...categoryFilterFields.map((field) => `cf_${field.key}`),
  ].filter((key) => searchParams.get(key)).length;

  const panel = (
    <div className="space-y-6">
      {activeCount > 0 ? (
        <button
          type="button"
          onClick={() => startTransition(() => router.push(pathname, { scroll: false }))}
          className="btn-secondary btn-sm w-full"
        >
          <CloseIcon /> Clear all filters ({activeCount})
        </button>
      ) : null}

      <FilterGroup title="Body type">
        <ul className="space-y-1">
          {facets.categories.map((category) => (
            <li key={category.slug}>
              <FilterOption
                checked={searchParams.get('category') === category.slug}
                onChange={() => toggle('category', category.slug)}
                label={category.name}
                count={category._count.trucks}
              />
            </li>
          ))}
        </ul>
      </FilterGroup>

      <FilterGroup title="Make">
        <ul className="max-h-56 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
          {facets.makes.map((make) => (
            <li key={make.slug}>
              <FilterOption
                checked={searchParams.get('make') === make.slug}
                onChange={() => toggle('make', make.slug)}
                label={make.name}
                count={make._count.trucks}
              />
            </li>
          ))}
        </ul>
      </FilterGroup>

      <FilterGroup title={`Price (${currencySymbol})`}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            onBlur={() => apply({ minPrice: toBase(minPrice) })}
            onKeyDown={(event) => event.key === 'Enter' && apply({ minPrice: toBase(minPrice) })}
            placeholder="Min"
            aria-label="Minimum price"
            className="input py-2 text-sm"
          />
          <span className="text-steel-400">–</span>
          <input
            type="text"
            inputMode="numeric"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            onBlur={() => apply({ maxPrice: toBase(maxPrice) })}
            onKeyDown={(event) => event.key === 'Enter' && apply({ maxPrice: toBase(maxPrice) })}
            placeholder="Max"
            aria-label="Maximum price"
            className="input py-2 text-sm"
          />
        </div>
        <p className="hint">Prices shown exclude VAT where applicable.</p>
      </FilterGroup>

      <FilterGroup title="Year">
        <div className="flex items-center gap-2">
          <select
            value={searchParams.get('minYear') ?? ''}
            onChange={(event) => apply({ minYear: event.target.value })}
            aria-label="Earliest year"
            className="select py-2 text-sm"
          >
            <option value="">From</option>
            {yearRange(facets.yearMin, facets.yearMax).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <span className="text-steel-400">–</span>
          <select
            value={searchParams.get('maxYear') ?? ''}
            onChange={(event) => apply({ maxYear: event.target.value })}
            aria-label="Latest year"
            className="select py-2 text-sm"
          >
            <option value="">To</option>
            {yearRange(facets.yearMin, facets.yearMax).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </FilterGroup>

      <FilterGroup title="Maximum mileage">
        <select
          value={searchParams.get('maxMileage') ?? ''}
          onChange={(event) => apply({ maxMileage: event.target.value })}
          aria-label="Maximum mileage"
          className="select py-2 text-sm"
        >
          <option value="">Any mileage</option>
          {[100_000, 250_000, 400_000, 600_000, 800_000, 1_000_000].map((km) => (
            <option key={km} value={km}>
              Under {km.toLocaleString('en-GB')} km
            </option>
          ))}
        </select>
      </FilterGroup>

      {facets.axleConfigs.length > 0 ? (
        <FilterGroup title="Axle configuration">
          <div className="flex flex-wrap gap-1.5">
            {facets.axleConfigs.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => toggle('axleConfig', entry.value)}
                aria-pressed={searchParams.get('axleConfig') === entry.value}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                  searchParams.get('axleConfig') === entry.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-steel-300 text-steel-600 hover:bg-steel-50',
                )}
              >
                {entry.value}
              </button>
            ))}
          </div>
        </FilterGroup>
      ) : null}

      <FilterGroup title="Emissions">
        <ul className="space-y-1">
          {EMISSIONS.map((option) => (
            <li key={option.value}>
              <FilterOption
                checked={searchParams.get('emissions') === option.value}
                onChange={() => toggle('emissions', option.value)}
                label={option.label}
              />
            </li>
          ))}
        </ul>
      </FilterGroup>

      <FilterGroup title="Gearbox">
        <ul className="space-y-1">
          {TRANSMISSIONS.map((option) => (
            <li key={option.value}>
              <FilterOption
                checked={searchParams.get('transmission') === option.value}
                onChange={() => toggle('transmission', option.value)}
                label={option.label}
              />
            </li>
          ))}
        </ul>
      </FilterGroup>

      <FilterGroup title="Fuel">
        <ul className="space-y-1">
          {FUEL_TYPES.map((option) => (
            <li key={option.value}>
              <FilterOption
                checked={searchParams.get('fuelType') === option.value}
                onChange={() => toggle('fuelType', option.value)}
                label={option.label}
              />
            </li>
          ))}
        </ul>
      </FilterGroup>

      <FilterGroup title="Condition">
        <ul className="space-y-1">
          {CONDITIONS.map((option) => (
            <li key={option.value}>
              <FilterOption
                checked={searchParams.get('condition') === option.value}
                onChange={() => toggle('condition', option.value)}
                label={option.label}
              />
            </li>
          ))}
        </ul>
      </FilterGroup>

      {facets.locations.length > 1 ? (
        <FilterGroup title="Location">
          <ul className="space-y-1">
            {facets.locations.map((location) => (
              <li key={location.slug}>
                <FilterOption
                  checked={searchParams.get('location') === location.slug}
                  onChange={() => toggle('location', location.slug)}
                  label={`${location.name} (${location.city})`}
                />
              </li>
            ))}
          </ul>
        </FilterGroup>
      ) : null}

      {categoryFilterFields.length > 0 ? (
        <>
          <div className="border-t border-steel-200 pt-1" aria-hidden="true" />
          {categoryFilterFields.map((field) => {
            const paramKey = `cf_${field.key}`;
            const current = searchParams.get(paramKey);

            if (field.type === 'BOOLEAN') {
              return (
                <FilterGroup key={field.key} title={field.label}>
                  <FilterOption
                    checked={current === 'true'}
                    onChange={() => apply({ [paramKey]: current === 'true' ? null : 'true' })}
                    label="Yes"
                  />
                </FilterGroup>
              );
            }

            return (
              <FilterGroup key={field.key} title={field.label}>
                <ul className="space-y-1">
                  {field.options.map((option) => (
                    <li key={option}>
                      <FilterOption
                        checked={current === option}
                        onChange={() => apply({ [paramKey]: current === option ? null : option })}
                        label={option}
                      />
                    </li>
                  ))}
                </ul>
              </FilterGroup>
            );
          })}
        </>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="btn-secondary w-full lg:hidden"
        aria-expanded={mobileOpen}
      >
        <FilterIcon />
        Filters
        {activeCount > 0 ? (
          <span className="ml-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      {/* Desktop sidebar */}
      <aside className="sticky top-28 hidden max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 lg:block scrollbar-thin">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-steel-900">Filter stock</h2>
          {pending ? <Spinner className="text-steel-400" /> : null}
        </div>
        {panel}
      </aside>

      {/* Mobile slide-over */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-[65] lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-steel-950/50"
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(21rem,90vw)] flex-col bg-white">
            <div className="flex items-center justify-between border-b border-steel-200 px-4 py-3">
              <h2 className="text-sm font-semibold">Filter stock</h2>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close filters"
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-steel-100"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{panel}</div>
            <div className="border-t border-steel-200 p-4">
              <button type="button" onClick={() => setMobileOpen(false)} className="btn-primary w-full">
                Show results
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-steel-200 pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-steel-500">{title}</legend>
      {children}
    </fieldset>
  );
}

function FilterOption({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count?: number;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded px-1 py-1 text-sm text-steel-700 hover:bg-steel-50">
      <input type="checkbox" checked={checked} onChange={onChange} className="checkbox" />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined ? <span className="text-xs tabular-nums text-steel-400">{count}</span> : null}
    </label>
  );
}

function yearRange(min: number, max: number): number[] {
  const years: number[] = [];
  for (let year = max; year >= min; year -= 1) years.push(year);
  return years;
}

/** Sort control rendered above the results grid. */
export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="whitespace-nowrap text-sm text-steel-500">
        Sort
      </label>
      <select
        id="sort"
        value={searchParams.get('sort') ?? 'newest'}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          if (event.target.value === 'newest') params.delete('sort');
          else params.set('sort', event.target.value);
          params.delete('page');
          router.push(`${pathname}?${params.toString()}`, { scroll: false });
        }}
        className="select w-auto py-2 text-sm"
      >
        <option value="newest">Newest first</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
        <option value="year-desc">Year: newest</option>
        <option value="year-asc">Year: oldest</option>
        <option value="mileage-asc">Mileage: lowest</option>
        <option value="popular">Most viewed</option>
      </select>
    </div>
  );
}
