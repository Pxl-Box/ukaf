'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { CartIcon, CheckIcon } from './ui/Icons';
import { Spinner } from './ui/primitives';

/**
 * Adds a vehicle to the basket as a reservation and sends the visitor to
 * checkout. Reservation, not purchase, is the default: these are high-value
 * items that are normally inspected before the balance is paid.
 */
export function ReserveButton({
  truckId,
  disabled,
  depositLabel,
  purchaseType = 'RESERVATION',
  label,
  className = 'btn-primary btn-lg w-full',
}: {
  truckId: string;
  disabled?: boolean;
  depositLabel: string;
  purchaseType?: 'RESERVATION' | 'FULL_PURCHASE';
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'pending' | 'added'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function reserve() {
    setState('pending');
    setError(null);

    try {
      await apiFetch('/api/cart', { method: 'POST', json: { truckId, purchaseType } });
      setState('added');
      router.push('/checkout');
      router.refresh();
    } catch (caught) {
      setState('idle');
      setError(caught instanceof Error ? caught.message : 'Could not reserve this vehicle.');
    }
  }

  if (disabled) {
    return (
      <button type="button" disabled className={className}>
        Not available
      </button>
    );
  }

  return (
    <div>
      <button type="button" onClick={reserve} disabled={state !== 'idle'} className={className}>
        {state === 'pending' ? (
          <>
            <Spinner /> Reserving…
          </>
        ) : state === 'added' ? (
          <>
            <CheckIcon /> Added — redirecting
          </>
        ) : (
          <>
            <CartIcon />
            {label ?? `Reserve for ${depositLabel}`}
          </>
        )}
      </button>

      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
