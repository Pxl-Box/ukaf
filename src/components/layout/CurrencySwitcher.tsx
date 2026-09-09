'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { apiFetch } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { Spinner } from '../ui/primitives';

type Option = { code: string; symbol: string; name: string };

/**
 * Currency selector.
 *
 * Posting to the server (rather than writing the cookie here) keeps the
 * choice on the signed-in user's profile too, and `router.refresh()` re-renders
 * every server-formatted price in place.
 */
export function CurrencySwitcher({
  currencies,
  current,
  className,
}: {
  currencies: Option[];
  current: string;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();

  if (currencies.length < 2) return null;

  async function change(code: string) {
    const previous = value;
    setValue(code);
    try {
      await apiFetch('/api/currency', { method: 'POST', json: { code } });
      startTransition(() => router.refresh());
    } catch {
      setValue(previous);
    }
  }

  return (
    <div className={cn('relative', className)}>
      <label htmlFor="currency-switcher" className="sr-only">
        Display prices in
      </label>
      <select
        id="currency-switcher"
        value={value}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
        className="h-9 cursor-pointer appearance-none rounded-lg border border-white/20 bg-white/10 py-0 pl-2.5 pr-7 text-xs font-semibold text-white outline-none transition-colors hover:bg-white/20 focus:ring-2 focus:ring-white/50 disabled:opacity-60"
      >
        {currencies.map((currency) => (
          <option key={currency.code} value={currency.code} className="text-steel-900">
            {currency.symbol} {currency.code}
          </option>
        ))}
      </select>

      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/70">
        {pending ? (
          <Spinner className="text-xs" />
        ) : (
          <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </div>
  );
}
