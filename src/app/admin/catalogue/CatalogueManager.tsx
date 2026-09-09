'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { AdminCard, EmptyRow, TableWrap, Td, Th } from '@/components/admin/shell';
import { Badge } from '@/components/ui/primitives';
import {
  CheckboxField,
  FormMessage,
  SubmitButton,
  TextAreaField,
  TextField,
  firstError,
} from '@/components/forms/fields';
import { PlusIcon, TrashIcon } from '@/components/ui/Icons';

type MakeRow = { id: string; name: string; slug: string; logoUrl: string; sortOrder: number; count: number };
type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  count: number;
  fieldCount: number;
};
type LocationRow = {
  id: string;
  name: string;
  slug: string;
  line1: string;
  city: string;
  postcode: string;
  country: string;
  phone: string;
  email: string;
  isActive: boolean;
  count: number;
};

type Tab = 'make' | 'category' | 'location';

export function CatalogueManager({
  makes,
  categories,
  locations,
}: {
  makes: MakeRow[];
  categories: CategoryRow[];
  locations: LocationRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('make');
  const [editing, setEditing] = useState<MakeRow | CategoryRow | LocationRow | 'new' | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const current = editing === 'new' ? null : editing;

  function switchTab(next: Tab) {
    setTab(next);
    setEditing(null);
    setMessage(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    const data = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      await apiFetch('/api/admin/catalogue', {
        method: editing === 'new' ? 'POST' : 'PATCH',
        json: { ...data, entity: tab, ...(current ? { id: current.id } : {}) },
      });
      setEditing(null);
      setMessage({ tone: 'success', text: 'Saved.' });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setMessage({ tone: 'error', text: caught.message });
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setMessage({ tone: 'error', text: 'Could not save.' });
      }
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string, name: string, count: number) {
    if (count > 0 && tab !== 'location') {
      window.alert(`${name} is used by ${count} vehicle(s). Reassign them before deleting it.`);
      return;
    }
    if (!window.confirm(`Delete ${name}?`)) return;

    try {
      const result = await apiFetch<{ deactivated: boolean; message?: string }>('/api/admin/catalogue', {
        method: 'DELETE',
        json: { entity: tab, id },
      });
      setMessage({ tone: 'success', text: result.message ?? `${name} deleted.` });
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof ApiClientError ? caught.message : 'Could not delete.',
      });
    }
  }

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: 'make', label: 'Makes', count: makes.length },
    { key: 'category', label: 'Body types', count: categories.length },
    { key: 'location', label: 'Depots', count: locations.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => switchTab(entry.key)}
            aria-current={tab === entry.key}
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === entry.key
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-steel-200 bg-white text-steel-600 hover:bg-steel-50'
            }`}
          >
            {entry.label} <span className="tabular-nums text-steel-400">{entry.count}</span>
          </button>
        ))}
      </div>

      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      {editing ? (
        <AdminCard title={editing === 'new' ? `Add a ${labelFor(tab)}` : `Edit ${labelFor(tab)}`}>
          <form onSubmit={save} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="name"
                label="Name"
                required
                defaultValue={(current as { name?: string })?.name ?? ''}
                error={firstError(fieldErrors, 'name')}
              />
              <TextField
                name="sortOrder"
                label="Sort order"
                inputMode="numeric"
                defaultValue={String((current as { sortOrder?: number })?.sortOrder ?? 0)}
                hint="Lower numbers appear first."
                error={firstError(fieldErrors, 'sortOrder')}
              />
            </div>

            {tab === 'make' ? (
              <TextField
                name="logoUrl"
                label="Logo URL (optional)"
                defaultValue={(current as MakeRow | null)?.logoUrl ?? ''}
                error={firstError(fieldErrors, 'logoUrl')}
              />
            ) : null}

            {tab === 'category' ? (
              <>
                <TextAreaField
                  name="description"
                  label="Description"
                  rows={3}
                  defaultValue={(current as CategoryRow | null)?.description ?? ''}
                  hint="Shown on the homepage tiles and in the navigation menu."
                  error={firstError(fieldErrors, 'description')}
                />
                <TextField
                  name="imageUrl"
                  label="Image URL"
                  defaultValue={(current as CategoryRow | null)?.imageUrl ?? ''}
                  error={firstError(fieldErrors, 'imageUrl')}
                />
                <CheckboxField
                  name="isActive"
                  value="true"
                  defaultChecked={(current as CategoryRow | null)?.isActive ?? true}
                  label="Show this category on the site"
                />
              </>
            ) : null}

            {tab === 'location' ? (
              <>
                <TextField
                  name="line1"
                  label="Address"
                  defaultValue={(current as LocationRow | null)?.line1 ?? ''}
                  error={firstError(fieldErrors, 'line1')}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField
                    name="city"
                    label="Town or city"
                    required
                    defaultValue={(current as LocationRow | null)?.city ?? ''}
                    error={firstError(fieldErrors, 'city')}
                  />
                  <TextField
                    name="postcode"
                    label="Postcode"
                    defaultValue={(current as LocationRow | null)?.postcode ?? ''}
                    error={firstError(fieldErrors, 'postcode')}
                  />
                  <TextField
                    name="country"
                    label="Country code"
                    maxLength={2}
                    defaultValue={(current as LocationRow | null)?.country ?? 'GB'}
                    error={firstError(fieldErrors, 'country')}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    name="phone"
                    type="tel"
                    label="Phone"
                    defaultValue={(current as LocationRow | null)?.phone ?? ''}
                    error={firstError(fieldErrors, 'phone')}
                  />
                  <TextField
                    name="email"
                    type="email"
                    label="Email"
                    defaultValue={(current as LocationRow | null)?.email ?? ''}
                    error={firstError(fieldErrors, 'email')}
                  />
                </div>
                <CheckboxField
                  name="isActive"
                  value="true"
                  defaultChecked={(current as LocationRow | null)?.isActive ?? true}
                  label="Depot is open and selectable"
                />
              </>
            ) : null}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
                Cancel
              </button>
              <SubmitButton pending={pending} pendingLabel="Saving…">
                Save
              </SubmitButton>
            </div>
          </form>
        </AdminCard>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className="btn-primary btn-sm">
          <PlusIcon /> Add {labelFor(tab)}
        </button>
      )}

      <AdminCard padded={false}>
        <TableWrap>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Slug</Th>
              {tab === 'location' ? <Th>Location</Th> : null}
              <Th align="center">Vehicles</Th>
              {tab !== 'make' ? <Th>Status</Th> : null}
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {tab === 'make' ? (
              makes.length === 0 ? (
                <EmptyRow colSpan={4} message="No makes yet." />
              ) : (
                makes.map((make) => (
                  <tr key={make.id} className="hover:bg-steel-50">
                    <Td className="font-medium text-steel-900">{make.name}</Td>
                    <Td className="font-mono text-xs text-steel-400">{make.slug}</Td>
                    <Td align="center" className="tabular-nums">
                      {make.count}
                    </Td>
                    <Td align="right">
                      <RowActions
                        onEdit={() => setEditing(make)}
                        onDelete={() => remove(make.id, make.name, make.count)}
                        name={make.name}
                      />
                    </Td>
                  </tr>
                ))
              )
            ) : tab === 'category' ? (
              categories.length === 0 ? (
                <EmptyRow colSpan={5} message="No body types yet." />
              ) : (
                categories.map((category) => (
                  <tr key={category.id} className="hover:bg-steel-50">
                    <Td>
                      <span className="font-medium text-steel-900">{category.name}</span>
                      {category.description ? (
                        <span className="block max-w-96 truncate text-xs text-steel-400">
                          {category.description}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="font-mono text-xs text-steel-400">{category.slug}</Td>
                    <Td align="center" className="tabular-nums">
                      {category.count}
                    </Td>
                    <Td>
                      {category.isActive ? <Badge tone="success">Visible</Badge> : <Badge tone="neutral">Hidden</Badge>}
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/admin/catalogue/${category.id}/fields`} className="btn-ghost btn-sm">
                          Fields{category.fieldCount > 0 ? ` (${category.fieldCount})` : ''}
                        </Link>
                        <RowActions
                          onEdit={() => setEditing(category)}
                          onDelete={() => remove(category.id, category.name, category.count)}
                          name={category.name}
                        />
                      </div>
                    </Td>
                  </tr>
                ))
              )
            ) : locations.length === 0 ? (
              <EmptyRow colSpan={6} message="No depots yet." />
            ) : (
              locations.map((location) => (
                <tr key={location.id} className="hover:bg-steel-50">
                  <Td className="font-medium text-steel-900">{location.name}</Td>
                  <Td className="font-mono text-xs text-steel-400">{location.slug}</Td>
                  <Td className="text-xs">
                    {location.city}
                    {location.postcode ? `, ${location.postcode}` : ''}
                  </Td>
                  <Td align="center" className="tabular-nums">
                    {location.count}
                  </Td>
                  <Td>
                    {location.isActive ? <Badge tone="success">Open</Badge> : <Badge tone="neutral">Closed</Badge>}
                  </Td>
                  <Td align="right">
                    <RowActions
                      onEdit={() => setEditing(location)}
                      onDelete={() => remove(location.id, location.name, location.count)}
                      name={location.name}
                    />
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      </AdminCard>
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
  name,
}: {
  onEdit: () => void;
  onDelete: () => void;
  name: string;
}) {
  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={onEdit} className="btn-ghost btn-sm">
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${name}`}
        className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function labelFor(tab: Tab): string {
  return tab === 'make' ? 'make' : tab === 'category' ? 'body type' : 'depot';
}
