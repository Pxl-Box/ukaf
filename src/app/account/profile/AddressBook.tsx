'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { MapPinIcon, PlusIcon, TrashIcon, EditIcon } from '@/components/ui/Icons';
import {
  CheckboxField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  firstError,
} from '@/components/forms/fields';

export type AddressRecord = {
  id: string;
  type: string;
  isDefault: boolean;
  fullName: string;
  company: string;
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  phone: string;
};

const COUNTRIES = [
  { value: 'GB', label: 'United Kingdom' },
  { value: 'IE', label: 'Ireland' },
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'BE', label: 'Belgium' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'PL', label: 'Poland' },
  { value: 'NO', label: 'Norway' },
  { value: 'US', label: 'United States' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'ZA', label: 'South Africa' },
];

export function AddressBook({ addresses }: { addresses: AddressRecord[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AddressRecord | 'new' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const isNew = editing === 'new';

    try {
      await apiFetch('/api/account/addresses', {
        method: isNew ? 'POST' : 'PATCH',
        json: isNew ? payload : { ...payload, id: (editing as AddressRecord).id },
      });
      setEditing(null);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setError('Could not save the address. Please try again.');
      }
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this address? This cannot be undone.')) return;
    try {
      await apiFetch('/api/account/addresses', { method: 'DELETE', json: { id } });
      router.refresh();
    } catch {
      setError('Could not delete the address.');
    }
  }

  const current = editing === 'new' ? null : editing;

  return (
    <section className="panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Address book</h2>
        {!editing ? (
          <button type="button" onClick={() => setEditing('new')} className="btn-secondary btn-sm">
            <PlusIcon /> Add address
          </button>
        ) : null}
      </div>

      {error && !editing ? <FormMessage tone="error">{error}</FormMessage> : null}

      {editing ? (
        <form onSubmit={save} className="space-y-4 rounded-lg border border-steel-200 bg-steel-50 p-4" noValidate>
          <h3 className="text-sm font-semibold">{editing === 'new' ? 'New address' : 'Edit address'}</h3>

          {error ? <FormMessage tone="error">{error}</FormMessage> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              name="type"
              label="Address type"
              defaultValue={current?.type ?? 'BILLING'}
              options={[
                { value: 'BILLING', label: 'Billing' },
                { value: 'DELIVERY', label: 'Delivery' },
              ]}
            />
            <TextField
              name="fullName"
              label="Full name"
              required
              defaultValue={current?.fullName ?? ''}
              error={firstError(fieldErrors, 'fullName')}
            />
          </div>

          <TextField name="company" label="Company (optional)" defaultValue={current?.company ?? ''} />

          <TextField
            name="line1"
            label="Address line 1"
            required
            defaultValue={current?.line1 ?? ''}
            error={firstError(fieldErrors, 'line1')}
          />
          <TextField name="line2" label="Address line 2 (optional)" defaultValue={current?.line2 ?? ''} />

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              name="city"
              label="Town or city"
              required
              defaultValue={current?.city ?? ''}
              error={firstError(fieldErrors, 'city')}
            />
            <TextField name="county" label="County" defaultValue={current?.county ?? ''} />
            <TextField
              name="postcode"
              label="Postcode"
              required
              defaultValue={current?.postcode ?? ''}
              error={firstError(fieldErrors, 'postcode')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              name="country"
              label="Country"
              defaultValue={current?.country ?? 'GB'}
              options={COUNTRIES}
            />
            <TextField name="phone" type="tel" label="Phone (optional)" defaultValue={current?.phone ?? ''} />
          </div>

          <CheckboxField
            name="isDefault"
            value="true"
            defaultChecked={current?.isDefault ?? false}
            label="Use this as my default address for this type"
          />

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
              Cancel
            </button>
            <SubmitButton pending={pending} pendingLabel="Saving…">
              Save address
            </SubmitButton>
          </div>
        </form>
      ) : addresses.length === 0 ? (
        <EmptyState
          icon={<MapPinIcon />}
          title="No addresses saved"
          description="Add a billing or delivery address to speed up checkout."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="rounded-lg border border-steel-200 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Badge tone={address.type === 'BILLING' ? 'info' : 'neutral'}>
                  {address.type === 'BILLING' ? 'Billing' : 'Delivery'}
                </Badge>
                {address.isDefault ? <Badge tone="success">Default</Badge> : null}
              </div>

              <address className="text-sm not-italic leading-relaxed text-steel-700">
                <span className="font-medium text-steel-900">{address.fullName}</span>
                {address.company ? <br /> : null}
                {address.company}
                <br />
                {address.line1}
                {address.line2 ? <br /> : null}
                {address.line2}
                <br />
                {address.city}
                {address.county ? `, ${address.county}` : ''}
                <br />
                {address.postcode} · {address.country}
              </address>

              <div className="mt-3 flex gap-1">
                <button type="button" onClick={() => setEditing(address)} className="btn-ghost btn-sm">
                  <EditIcon /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(address.id)}
                  className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                >
                  <TrashIcon /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
