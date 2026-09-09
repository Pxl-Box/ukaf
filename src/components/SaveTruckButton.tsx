'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { HeartIcon } from './ui/Icons';

/**
 * Wishlist toggle. Optimistic, with a rollback on failure; unauthenticated
 * visitors are sent to sign in and returned to where they were.
 */
export function SaveTruckButton({
  truckId,
  initialSaved,
  title,
  variant = 'icon',
  className,
}: {
  truckId: string;
  initialSaved: boolean;
  title: string;
  variant?: 'icon' | 'full';
  className?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !saved;
    setSaved(next);
    setError(null);

    try {
      await apiFetch('/api/saved', {
        method: next ? 'POST' : 'DELETE',
        json: { truckId },
      });
      startTransition(() => router.refresh());
    } catch (caught) {
      setSaved(!next);
      if (caught instanceof ApiClientError && caught.status === 401) {
        const next = `${window.location.pathname}${window.location.search}`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Could not update your saved vehicles.');
    }
  }

  const label = saved ? `Remove ${title} from saved vehicles` : `Save ${title} for later`;

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        title={error ?? undefined}
        className={cn('btn-secondary w-full', saved && 'border-red-200 bg-red-50 text-red-700', className)}
      >
        <HeartIcon filled={saved} className={saved ? 'text-red-500' : ''} />
        {saved ? 'Saved' : 'Save this vehicle'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={label}
      aria-pressed={saved}
      title={error ?? label}
      className={cn(
        'relative z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-steel-600 shadow-sm backdrop-blur transition-colors hover:text-red-600',
        saved && 'text-red-600',
        className,
      )}
    >
      <HeartIcon filled={saved} className="text-base" />
    </button>
  );
}
