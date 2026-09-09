'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { SearchIcon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/primitives';

export function AdminCustomerSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    startTransition(() => router.push(params.toString() ? `${pathname}?${params}` : pathname));
  }

  return (
    <form onSubmit={onSubmit} role="search" className="flex items-center gap-2">
      <div className="relative flex-1">
        <label htmlFor="customer-search" className="sr-only">
          Search customers
        </label>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel-400" />
        <input
          id="customer-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, company or phone"
          className="input py-2 pl-9 text-sm"
        />
      </div>

      <button type="submit" className="btn-secondary btn-sm">
        Search
      </button>

      {searchParams.get('q') ? (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            startTransition(() => router.push(pathname));
          }}
          className="btn-ghost btn-sm"
        >
          Clear
        </button>
      ) : null}

      {pending ? <Spinner className="text-steel-400" /> : null}
    </form>
  );
}
