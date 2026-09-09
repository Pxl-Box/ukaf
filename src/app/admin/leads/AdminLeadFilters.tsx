'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { SearchIcon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/primitives';

export function AdminLeadFilters({
  staff,
}: {
  staff: Array<{ id: string; firstName: string; lastName: string }>;
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
        <label htmlFor="admin-lead-search" className="sr-only">
          Search enquiries
        </label>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel-400" />
        <input
          id="admin-lead-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, company, phone or reference"
          className="input py-2 pl-9 text-sm"
        />
      </form>

      <select
        aria-label="Filter by owner"
        value={searchParams.get('owner') ?? ''}
        onChange={(event) => apply({ owner: event.target.value || null })}
        className="select w-auto py-2 text-sm"
      >
        <option value="">All owners</option>
        <option value="unassigned">Unassigned</option>
        {staff.map((member) => (
          <option key={member.id} value={member.id}>
            {member.firstName} {member.lastName}
          </option>
        ))}
      </select>

      {searchParams.toString() ? (
        <button
          type="button"
          onClick={() => startTransition(() => router.push(pathname))}
          className="btn-ghost btn-sm"
        >
          Clear
        </button>
      ) : null}

      {pending ? <Spinner className="text-steel-400" /> : null}
    </div>
  );
}
