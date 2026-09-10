'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { AdminCard, EmptyRow, TableWrap, Td, Th } from '@/components/admin/shell';
import { Badge } from '@/components/ui/primitives';
import { CheckboxField, FormMessage, SubmitButton, TextField, firstError } from '@/components/forms/fields';
import { PlusIcon, TrashIcon } from '@/components/ui/Icons';

export type ShippingRateRow = {
  id: string;
  zoneId: string;
  minWeightKg: number;
  maxWeightKg: number | null;
  priceNet: number;
  sortOrder: number;
};

export type ShippingZoneRow = {
  id: string;
  name: string;
  slug: string;
  countries: string | null;
  sortOrder: number;
  isActive: boolean;
  rates: ShippingRateRow[];
};

function formatWeightBand(minKg: number, maxKg: number | null): string {
  if (maxKg === null) return `${minKg.toLocaleString()} kg and above`;
  return `${minKg.toLocaleString()}–${maxKg.toLocaleString()} kg`;
}

export function ShippingManager({
  zones,
  baseSymbol,
  baseCode,
}: {
  zones: ShippingZoneRow[];
  baseSymbol: string;
  baseCode: string;
}) {
  const router = useRouter();
  const [editingZone, setEditingZone] = useState<ShippingZoneRow | 'new' | null>(null);
  const [editingRate, setEditingRate] = useState<{ zoneId: string; rate: ShippingRateRow | 'new' } | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const currentZone = editingZone === 'new' ? null : editingZone;
  const currentRate = editingRate?.rate === 'new' ? null : (editingRate?.rate ?? null);

  async function saveZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    const data = { ...Object.fromEntries(new FormData(event.currentTarget).entries()), entity: 'zone' };

    try {
      await apiFetch('/api/admin/shipping', {
        method: editingZone === 'new' ? 'POST' : 'PATCH',
        json: editingZone === 'new' ? data : { ...data, id: currentZone?.id },
      });
      setEditingZone(null);
      setMessage({ tone: 'success', text: 'Zone saved.' });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setMessage({ tone: 'error', text: caught.message });
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setMessage({ tone: 'error', text: 'Could not save the zone.' });
      }
    } finally {
      setPending(false);
    }
  }

  async function removeZone(zone: ShippingZoneRow) {
    const warning =
      zone.rates.length > 0
        ? `Remove ${zone.name}? Its ${zone.rates.length} rate(s) will be removed too.`
        : `Remove ${zone.name}?`;
    if (!window.confirm(warning)) return;

    try {
      await apiFetch('/api/admin/shipping', { method: 'DELETE', json: { entity: 'zone', id: zone.id } });
      setMessage({ tone: 'success', text: `${zone.name} removed.` });
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof ApiClientError ? caught.message : 'Could not remove the zone.',
      });
    }
  }

  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRate) return;
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    const data = { ...Object.fromEntries(new FormData(event.currentTarget).entries()), entity: 'rate' };

    try {
      await apiFetch('/api/admin/shipping', {
        method: editingRate.rate === 'new' ? 'POST' : 'PATCH',
        json: editingRate.rate === 'new' ? data : { ...data, id: currentRate?.id },
      });
      setEditingRate(null);
      setMessage({ tone: 'success', text: 'Rate saved.' });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setMessage({ tone: 'error', text: caught.message });
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setMessage({ tone: 'error', text: 'Could not save the rate.' });
      }
    } finally {
      setPending(false);
    }
  }

  async function removeRate(rate: ShippingRateRow) {
    if (!window.confirm(`Remove the ${formatWeightBand(rate.minWeightKg, rate.maxWeightKg)} band?`)) return;

    try {
      await apiFetch('/api/admin/shipping', { method: 'DELETE', json: { entity: 'rate', id: rate.id } });
      setMessage({ tone: 'success', text: 'Rate removed.' });
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof ApiClientError ? caught.message : 'Could not remove the rate.',
      });
    }
  }

  return (
    <div className="space-y-4">
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      {editingZone ? (
        <AdminCard title={editingZone === 'new' ? 'Add a zone' : `Edit ${currentZone?.name}`}>
          <form onSubmit={saveZone} className="space-y-4" noValidate>
            <TextField
              name="name"
              label="Zone name"
              required
              defaultValue={currentZone?.name ?? ''}
              placeholder="Western Europe"
              error={firstError(fieldErrors, 'name')}
            />
            <TextField
              name="countries"
              label="Countries / regions (optional, shown to staff only)"
              defaultValue={currentZone?.countries ?? ''}
              placeholder="France, Belgium, Netherlands, Germany"
              error={firstError(fieldErrors, 'countries')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="sortOrder"
                label="Sort order"
                inputMode="numeric"
                defaultValue={String(currentZone?.sortOrder ?? 0)}
                error={firstError(fieldErrors, 'sortOrder')}
              />
              <div className="flex items-end pb-2.5">
                <CheckboxField
                  name="isActive"
                  value="true"
                  defaultChecked={currentZone?.isActive ?? true}
                  label="Available for quoting"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingZone(null)} className="btn-secondary">
                Cancel
              </button>
              <SubmitButton pending={pending} pendingLabel="Saving…">
                Save zone
              </SubmitButton>
            </div>
          </form>
        </AdminCard>
      ) : (
        <button type="button" onClick={() => setEditingZone('new')} className="btn-primary btn-sm">
          <PlusIcon /> Add zone
        </button>
      )}

      {editingRate ? (
        <AdminCard title={editingRate.rate === 'new' ? 'Add a rate band' : 'Edit rate band'}>
          <form onSubmit={saveRate} className="space-y-4" noValidate>
            <input type="hidden" name="zoneId" value={editingRate.zoneId} />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                name="minWeightKg"
                label="From weight (kg)"
                required
                inputMode="numeric"
                defaultValue={String(currentRate?.minWeightKg ?? 0)}
                error={firstError(fieldErrors, 'minWeightKg')}
              />
              <TextField
                name="maxWeightKg"
                label="Up to weight (kg)"
                inputMode="numeric"
                defaultValue={currentRate?.maxWeightKg != null ? String(currentRate.maxWeightKg) : ''}
                hint="Leave blank for the open-ended top band."
                error={firstError(fieldErrors, 'maxWeightKg')}
              />
              <TextField
                name="priceNet"
                label={`Price (${baseCode})`}
                required
                inputMode="decimal"
                defaultValue={currentRate ? (currentRate.priceNet / 100).toFixed(2) : ''}
                placeholder="450.00"
                error={firstError(fieldErrors, 'priceNet')}
              />
            </div>
            <TextField
              name="sortOrder"
              label="Sort order"
              inputMode="numeric"
              defaultValue={String(currentRate?.sortOrder ?? 0)}
              error={firstError(fieldErrors, 'sortOrder')}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingRate(null)} className="btn-secondary">
                Cancel
              </button>
              <SubmitButton pending={pending} pendingLabel="Saving…">
                Save rate
              </SubmitButton>
            </div>
          </form>
        </AdminCard>
      ) : null}

      {zones.length === 0 ? (
        <AdminCard>
          <p className="py-6 text-center text-sm text-steel-400">
            No shipping zones yet — add one to start building rate bands.
          </p>
        </AdminCard>
      ) : (
        zones.map((zone) => (
          <AdminCard
            key={zone.id}
            title={zone.name}
            description={zone.countries ?? undefined}
            action={
              <div className="flex items-center gap-1">
                {zone.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Hidden</Badge>}
                <button type="button" onClick={() => setEditingZone(zone)} className="btn-ghost btn-sm">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeZone(zone)}
                  aria-label={`Remove ${zone.name}`}
                  className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                >
                  <TrashIcon />
                </button>
              </div>
            }
            padded={false}
          >
            <TableWrap>
              <thead>
                <tr>
                  <Th>Weight band</Th>
                  <Th align="right">Price</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {zone.rates.length === 0 ? (
                  <EmptyRow colSpan={3} message="No rate bands yet." />
                ) : (
                  zone.rates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-steel-50">
                      <Td>{formatWeightBand(rate.minWeightKg, rate.maxWeightKg)}</Td>
                      <Td align="right" className="tabular-nums">
                        {baseSymbol}
                        {(rate.priceNet / 100).toFixed(2)}
                      </Td>
                      <Td align="right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingRate({ zoneId: zone.id, rate })}
                            className="btn-ghost btn-sm"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRate(rate)}
                            aria-label="Remove rate"
                            className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </TableWrap>
            <div className="border-t border-steel-100 p-3 dark:border-steel-800">
              <button
                type="button"
                onClick={() => setEditingRate({ zoneId: zone.id, rate: 'new' })}
                className="btn-secondary btn-sm"
              >
                <PlusIcon /> Add rate band
              </button>
            </div>
          </AdminCard>
        ))
      )}
    </div>
  );
}
