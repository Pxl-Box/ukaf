'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { COMPARE_LIMIT, readCompare, writeCompare } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { CheckIcon, CompareIcon } from './ui/Icons';

/**
 * Adds or removes a vehicle from the comparison tray.
 *
 * The list lives in localStorage — it is a per-browser convenience, not data
 * we need on the server, so it works for signed-out visitors and requires no
 * consent beyond the strictly necessary category.
 */
export function CompareToggle({ truckId, className }: { truckId: string; className?: string }) {
  const [ids, setIds] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIds(readCompare());
    setMounted(true);

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<string[]>).detail;
      if (Array.isArray(detail)) setIds(detail);
    };
    window.addEventListener('ukaf:compare-changed', onChange);
    return () => window.removeEventListener('ukaf:compare-changed', onChange);
  }, []);

  const selected = ids.includes(truckId);
  const full = ids.length >= COMPARE_LIMIT && !selected;

  function toggle() {
    const next = selected ? ids.filter((id) => id !== truckId) : [...ids, truckId].slice(0, COMPARE_LIMIT);
    setIds(next);
    writeCompare(next);
  }

  // Render a stable placeholder until localStorage has been read, so the
  // server and client markup match.
  if (!mounted) {
    return (
      <span className={cn('btn-ghost w-full justify-center opacity-60', className)}>
        <CompareIcon /> Add to compare
      </span>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        disabled={full}
        aria-pressed={selected}
        className={cn('btn-ghost w-full justify-center', selected && 'text-brand-700')}
      >
        {selected ? <CheckIcon /> : <CompareIcon />}
        {full ? `Compare list full (${COMPARE_LIMIT})` : selected ? 'In comparison' : 'Add to compare'}
      </button>

      {ids.length > 1 ? (
        <Link href="/compare" className="mt-1 block text-center text-xs font-medium text-brand-600 hover:underline">
          Compare {ids.length} vehicles
        </Link>
      ) : null}
    </div>
  );
}
