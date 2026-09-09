'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { FormMessage } from '@/components/forms/fields';
import { Spinner } from '@/components/ui/primitives';

type Status = {
  truckCount: number;
  leadCount: number;
  testimonialCount: number;
};

type GenerateResult = {
  trucksCreated: number;
  leadsCreated: number;
  testimonialsCreated: number;
};

type ClearResult = {
  trucksDeleted: number;
  trucksKeptWithOrders: string[];
  leadsDeleted: number;
  testimonialsDeleted: number;
};

/**
 * Switches the 24 example vehicles (and their demo enquiries/testimonials) on
 * or off. Anything created by hand — a real listing, a real enquiry — has no
 * `isDemoData` flag and is never touched by this, in either direction.
 */
export function DemoDataToggle({ initialStatus }: { initialStatus: Status }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const hasDemoData = status.truckCount > 0;

  async function turnOn() {
    setPending(true);
    setMessage(null);
    try {
      const result = await apiFetch<GenerateResult>('/api/admin/demo-data', { method: 'POST' });
      setStatus((current) => ({
        truckCount: current.truckCount + result.trucksCreated,
        leadCount: current.leadCount + result.leadsCreated,
        testimonialCount: current.testimonialCount + result.testimonialsCreated,
      }));
      setMessage({
        tone: 'success',
        text:
          result.trucksCreated > 0
            ? `Added ${result.trucksCreated} example vehicles, ${result.leadsCreated} example enquiries and ${result.testimonialsCreated} testimonials.`
            : 'Example data is already on.',
      });
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof ApiClientError ? caught.message : 'Could not add example data.',
      });
    } finally {
      setPending(false);
    }
  }

  async function turnOff() {
    const confirmed = window.confirm(
      `Remove all ${status.truckCount} example vehicles and their example enquiries/testimonials?\n\n` +
        'Anything a member of staff has created by hand — including real vehicle listings — is not affected. ' +
        'This cannot be undone, though switching example data back on regenerates an equivalent set.',
    );
    if (!confirmed) return;

    setPending(true);
    setMessage(null);
    try {
      const result = await apiFetch<ClearResult>('/api/admin/demo-data', { method: 'DELETE' });
      setStatus({
        truckCount: result.trucksKeptWithOrders.length,
        leadCount: 0,
        testimonialCount: 0,
      });

      const kept =
        result.trucksKeptWithOrders.length > 0
          ? ` ${result.trucksKeptWithOrders.length} example vehicle(s) already have real orders against them, so ${result.trucksKeptWithOrders.length === 1 ? 'it was' : 'they were'} kept as ordinary listings instead of deleted: ${result.trucksKeptWithOrders.join(', ')}.`
          : '';

      setMessage({
        tone: 'success',
        text: `Removed ${result.trucksDeleted} example vehicles, ${result.leadsDeleted} example enquiries and ${result.testimonialsDeleted} testimonials.${kept}`,
      });
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof ApiClientError ? caught.message : 'Could not remove example data.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <div className="flex items-center justify-between gap-4 rounded-lg border border-steel-200 p-4">
        <div>
          <p className="text-sm font-medium text-steel-900">
            {hasDemoData ? 'Example data is on' : 'Example data is off'}
          </p>
          <p className="mt-0.5 text-xs text-steel-500">
            {hasDemoData
              ? [
                  `${status.truckCount} example vehicle${status.truckCount === 1 ? '' : 's'}`,
                  status.leadCount > 0 ? `${status.leadCount} example enquiries` : null,
                  status.testimonialCount > 0 ? `${status.testimonialCount} example testimonials` : null,
                ]
                  .filter(Boolean)
                  .join(', ')
              : 'Only the vehicles staff have listed are shown — nothing to remove.'}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={hasDemoData}
          disabled={pending}
          onClick={hasDemoData ? turnOff : turnOn}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
            hasDemoData ? 'bg-brand-600' : 'bg-steel-300'
          } disabled:opacity-60`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              hasDemoData ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
          {pending ? (
            <span className="absolute inset-0 grid place-items-center">
              <Spinner className="text-white" />
            </span>
          ) : null}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-steel-500">
        Example vehicles are marked internally so they can be told apart from real listings — look for the{' '}
        <span className="rounded bg-steel-100 px-1.5 py-0.5 font-medium text-steel-600">Demo</span> badge on the{' '}
        stock list. Turning this off only ever removes rows flagged that way; a vehicle created from{' '}
        <span className="font-medium">Add vehicle</span> is never touched, however this switch is set.
      </p>
    </div>
  );
}
