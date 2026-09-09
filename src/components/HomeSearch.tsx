'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { SearchIcon } from './ui/Icons';

/** Prominent hero search that hands off to the filtered stock listing. */
export function HomeSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/trucks?q=${encodeURIComponent(trimmed)}` : '/trucks');
  }

  return (
    <form onSubmit={onSubmit} role="search" className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <label htmlFor="hero-search" className="sr-only">
          Search stock by make, model or stock number
        </label>
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-steel-400" />
        <input
          id="hero-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “DAF XF 480” or “6x2 tipper”"
          className="h-14 w-full rounded-xl border border-white/15 bg-white/10 pl-12 pr-4 text-base text-white backdrop-blur placeholder:text-steel-400 focus:border-brand-400 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-brand-400/50"
        />
      </div>
      <button type="submit" className="btn-primary h-14 shrink-0 px-7 text-base">
        Search stock
      </button>
    </form>
  );
}
