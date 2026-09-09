'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { SearchIcon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/primitives';

/** Search and dropdown filters for the admin stock list. */
export function AdminStockFilters({
  makes,
  categories,
}: {
  makes: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  function apply(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply({ q: query.trim() || null });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={onSubmit} role="search" className="relative min-w-56 flex-1">
        <label htmlFor="admin-stock-search" className="sr-only">
          Search stock
        </label>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel-400" />
        <input
          id="admin-stock-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, stock no., registration or VIN"
          className="input py-2 pl-9 text-sm"
        />
      </form>

      <select
        aria-label="Filter by make"
        value={searchParams.get('make') ?? ''}
        onChange={(event) => apply({ make: event.target.value || null })}
        className="select w-auto py-2 text-sm"
      >
        <option value="">All makes</option>
        {makes.map((make) => (
          <option key={make.id} value={make.id}>
            {make.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by category"
        value={searchParams.get('category') ?? ''}
        onChange={(event) => apply({ category: event.target.value || null })}
        className="select w-auto py-2 text-sm"
      >
        <option value="">All body types</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      {searchParams.toString() ? (
        <button type="button" onClick={() => startTransition(() => router.push(pathname))} className="btn-ghost btn-sm">
          Clear
        </button>
      ) : null}

      {pending ? <Spinner className="text-steel-400" /> : null}
    </div>
  );
}
