'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { AdminCard, EmptyRow, TableWrap, Td, Th } from '@/components/admin/shell';
import { Badge } from '@/components/ui/primitives';
import { formatDate } from '@/lib/utils';
import {
  CheckboxField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  firstError,
} from '@/components/forms/fields';
import { PlusIcon, TrashIcon } from '@/components/ui/Icons';

export type DiscountRow = {
  id: string;
  code: string;
  description: string;
  type: string;
  value: number;
  minSubtotal: number;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
};

export function DiscountManager({
  discounts,
  currencySymbol,
}: {
  discounts: DiscountRow[];
  currencySymbol: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<DiscountRow | 'new' | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [type, setType] = useState('FIXED');

  const current = editing === 'new' ? null : editing;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    const data = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      await apiFetch('/api/admin/discounts', {
        method: editing === 'new' ? 'POST' : 'PATCH',
        json: { ...data, ...(current ? { id: current.id } : {}) },
      });
      setEditing(null);
      setMessage({ tone: 'success', text: 'Discount saved.' });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setMessage({ tone: 'error', text: caught.message });
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setMessage({ tone: 'error', text: 'Could not save the discount.' });
      }
    } finally {
      setPending(false);
    }
  }

  async function remove(discount: DiscountRow) {
    if (!window.confirm(`Delete ${discount.code}?`)) return;

    try {
      const result = await apiFetch<{ message?: string }>('/api/admin/discounts', {
        method: 'DELETE',
        json: { id: discount.id },
      });
      setMessage({ tone: 'success', text: result.message ?? `${discount.code} deleted.` });
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof ApiClientError ? caught.message : 'Could not delete the discount.',
      });
    }
  }

  return (
    <div className="space-y-4">
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      {editing ? (
        <AdminCard title={editing === 'new' ? 'New discount code' : `Edit ${current?.code}`}>
          <form onSubmit={save} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="code"
                label="Code"
                required
                defaultValue={current?.code ?? ''}
                placeholder="SPRING500"
                hint="Letters, numbers and hyphens. Case-insensitive for customers."
                error={firstError(fieldErrors, 'code')}
              />
              <TextField
                name="description"
                label="Internal description"
                defaultValue={current?.description ?? ''}
                error={firstError(fieldErrors, 'description')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                name="type"
                label="Type"
                value={current ? undefined : type}
                defaultValue={current?.type ?? undefined}
                onChange={(event) => setType(event.target.value)}
                options={[
                  { value: 'FIXED', label: `Fixed amount (${currencySymbol})` },
                  { value: 'PERCENTAGE', label: 'Percentage (%)' },
                ]}
              />
              <TextField
                name="value"
                label={(current?.type ?? type) === 'PERCENTAGE' ? 'Percentage off' : `Amount off (${currencySymbol})`}
                required
                inputMode="decimal"
                defaultValue={current ? String(current.value) : ''}
                error={firstError(fieldErrors, 'value')}
              />
              <TextField
                name="minSubtotal"
                label={`Minimum spend (${currencySymbol})`}
                inputMode="decimal"
                defaultValue={current ? String(current.minSubtotal) : '0'}
                error={firstError(fieldErrors, 'minSubtotal')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                name="usageLimit"
                label="Usage limit"
                inputMode="numeric"
                defaultValue={current?.usageLimit != null ? String(current.usageLimit) : ''}
                hint="Leave blank for unlimited."
                error={firstError(fieldErrors, 'usageLimit')}
              />
              <TextField
                name="startsAt"
                type="date"
                label="Valid from"
                defaultValue={current?.startsAt ?? ''}
                error={firstError(fieldErrors, 'startsAt')}
              />
              <TextField
                name="expiresAt"
                type="date"
                label="Expires"
                defaultValue={current?.expiresAt ?? ''}
                error={firstError(fieldErrors, 'expiresAt')}
              />
            </div>

            <CheckboxField
              name="isActive"
              value="true"
              defaultChecked={current?.isActive ?? true}
              label="Code is live and can be redeemed"
            />

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
                Cancel
              </button>
              <SubmitButton pending={pending} pendingLabel="Saving…">
                Save discount
              </SubmitButton>
            </div>
          </form>
        </AdminCard>
      ) : (
        <button
          type="button"
          onClick={() => {
            setType('FIXED');
            setEditing('new');
          }}
          className="btn-primary btn-sm"
        >
          <PlusIcon /> Add discount code
        </button>
      )}

      <AdminCard padded={false}>
        <TableWrap>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th align="right">Discount</Th>
              <Th align="right">Min spend</Th>
              <Th align="center">Used</Th>
              <Th>Valid</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {discounts.length === 0 ? (
              <EmptyRow colSpan={7} message="No discount codes yet." />
            ) : (
              discounts.map((discount) => {
                const expired = discount.expiresAt && new Date(discount.expiresAt) < new Date();
                const exhausted = discount.usageLimit !== null && discount.usedCount >= discount.usageLimit;

                return (
                  <tr key={discount.id} className="hover:bg-steel-50">
                    <Td>
                      <span className="font-mono text-sm font-semibold text-steel-900">{discount.code}</span>
                      {discount.description ? (
                        <span className="block max-w-64 truncate text-xs text-steel-400">
                          {discount.description}
                        </span>
                      ) : null}
                    </Td>
                    <Td align="right" className="whitespace-nowrap tabular-nums">
                      {discount.type === 'PERCENTAGE'
                        ? `${discount.value}%`
                        : `${currencySymbol}${discount.value.toLocaleString('en-GB')}`}
                    </Td>
                    <Td align="right" className="whitespace-nowrap tabular-nums text-xs">
                      {discount.minSubtotal > 0
                        ? `${currencySymbol}${discount.minSubtotal.toLocaleString('en-GB')}`
                        : '—'}
                    </Td>
                    <Td align="center" className="tabular-nums text-xs">
                      {discount.usedCount}
                      {discount.usageLimit !== null ? ` / ${discount.usageLimit}` : ''}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-steel-500">
                      {discount.startsAt ? formatDate(discount.startsAt) : 'Now'} →{' '}
                      {discount.expiresAt ? formatDate(discount.expiresAt) : 'No expiry'}
                    </Td>
                    <Td>
                      {!discount.isActive ? (
                        <Badge tone="neutral">Disabled</Badge>
                      ) : expired ? (
                        <Badge tone="warning">Expired</Badge>
                      ) : exhausted ? (
                        <Badge tone="warning">Used up</Badge>
                      ) : (
                        <Badge tone="success">Live</Badge>
                      )}
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => setEditing(discount)} className="btn-ghost btn-sm">
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(discount)}
                          aria-label={`Delete ${discount.code}`}
                          className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableWrap>
      </AdminCard>
    </div>
  );
}
