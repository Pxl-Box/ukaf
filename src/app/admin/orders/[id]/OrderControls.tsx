'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { FormMessage, SelectField, SubmitButton, TextAreaField } from '@/components/forms/fields';
import { Spinner } from '@/components/ui/primitives';

export function OrderControls({
  orderId,
  status,
  internalNotes,
  refundable,
  totalFormatted,
}: {
  orderId: string;
  status: string;
  internalNotes: string;
  refundable: boolean;
  totalFormatted: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const data = new FormData(event.currentTarget);

    try {
      await apiFetch('/api/admin/orders', {
        method: 'PATCH',
        json: {
          id: orderId,
          status: data.get('status'),
          internalNotes: data.get('internalNotes'),
        },
      });
      setMessage({ tone: 'success', text: 'Order updated.' });
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof ApiClientError ? caught.message : 'Could not update the order.',
      });
    } finally {
      setPending(false);
    }
  }

  async function refund() {
    const confirmed = window.confirm(
      `Refund ${totalFormatted} in full to the customer's original payment method?\n\n` +
        'This cannot be undone. If the order was a reservation, the vehicle goes back on sale once Stripe confirms.',
    );
    if (!confirmed) return;

    setRefunding(true);
    setMessage(null);

    try {
      const result = await apiFetch<{ message: string }>('/api/admin/orders', {
        method: 'POST',
        json: { id: orderId, action: 'refund' },
      });
      setMessage({ tone: 'success', text: result.message });
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof ApiClientError ? caught.message : 'The refund could not be started.',
      });
    } finally {
      setRefunding(false);
    }
  }

  return (
    <div className="space-y-4">
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <SelectField
          name="status"
          label="Status"
          defaultValue={status}
          options={[
            { value: 'PENDING', label: 'Pending' },
            { value: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
            { value: 'PAID', label: 'Paid' },
            { value: 'IN_PREPARATION', label: 'In preparation' },
            { value: 'READY_FOR_COLLECTION', label: 'Ready for collection' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'CANCELLED', label: 'Cancelled' },
            { value: 'REFUNDED', label: 'Refunded' },
          ]}
          hint="Changing the status is logged against the order."
        />

        <TextAreaField
          name="internalNotes"
          label="Internal notes"
          rows={5}
          defaultValue={internalNotes}
          hint="Staff only — never shown to the customer."
        />

        <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full">
          Save changes
        </SubmitButton>
      </form>

      {refundable ? (
        <div className="border-t border-steel-200 pt-4">
          <button
            type="button"
            onClick={refund}
            disabled={refunding}
            className="btn-secondary w-full border-red-200 text-red-700 hover:bg-red-50"
          >
            {refunding ? (
              <>
                <Spinner /> Submitting refund…
              </>
            ) : (
              `Refund ${totalFormatted} in full`
            )}
          </button>
          <p className="mt-2 text-xs leading-relaxed text-steel-500">
            Refunds are processed by Stripe. The order updates automatically once Stripe confirms.
          </p>
        </div>
      ) : null}
    </div>
  );
}
