'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { AdminCard, EmptyRow, TableWrap, Td, Th } from '@/components/admin/shell';
import { Badge, Spinner } from '@/components/ui/primitives';
import {
  CheckboxField,
  FormMessage,
  SubmitButton,
  TextField,
  firstError,
} from '@/components/forms/fields';
import { PlusIcon, TrashIcon } from '@/components/ui/Icons';

export type CurrencyRow = {
  code: string;
  name: string;
  symbol: string;
  rateToBase: number;
  decimals: number;
  roundTo: number;
  isBase: boolean;
  isActive: boolean;
  sortOrder: number;
  orderCount: number;
  updatedAt: string;
};

export function CurrencyManager({
  currencies,
  baseCode,
  providerConfigured,
}: {
  currencies: CurrencyRow[];
  baseCode: string;
  providerConfigured: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CurrencyRow | 'new' | null>(null);
  const [pending, setPending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const current = editing === 'new' ? null : editing;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    const data = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      await apiFetch('/api/admin/currencies', {
        method: editing === 'new' ? 'POST' : 'PATCH',
        json: data,
      });
      setEditing(null);
      setMessage({ tone: 'success', text: 'Currency saved.' });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setMessage({ tone: 'error', text: caught.message });
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setMessage({ tone: 'error', text: 'Could not save the currency.' });
      }
    } finally {
      setPending(false);
    }
  }

  async function remove(currency: CurrencyRow) {
    const warning =
      currency.orderCount > 0
        ? `${currency.code} is used by ${currency.orderCount} order(s), so it will be deactivated rather than deleted. Continue?`
        : `Remove ${currency.code}? Customers will no longer be able to view prices in it.`;
    if (!window.confirm(warning)) return;

    try {
      const result = await apiFetch<{ deactivated: boolean; message?: string }>(
        '/api/admin/currencies',
        { method: 'DELETE', json: { code: currency.code } },
      );
      setMessage({
        tone: 'success',
        text: result.message ?? `${currency.code} removed.`,
      });
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof ApiClientError ? caught.message : 'Could not remove the currency.',
      });
    }
  }

  async function refreshRates() {
    setRefreshing(true);
    setMessage(null);

    try {
      const result = await apiFetch<{ updated: number; skipped: string[] }>('/api/admin/currencies', {
        method: 'PUT',
      });
      setMessage({
        tone: 'success',
        text: `Updated ${result.updated} rate${result.updated === 1 ? '' : 's'}${
          result.skipped.length > 0 ? `. Skipped: ${result.skipped.join(', ')}.` : '.'
        }`,
      });
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof ApiClientError ? caught.message : 'Could not refresh rates.',
      });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-4">
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      {editing ? (
        <AdminCard
          title={editing === 'new' ? 'Add a currency' : `Edit ${current?.code}`}
          description="Rates are expressed as units of this currency per 1 unit of the base currency."
        >
          <form onSubmit={save} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                name="code"
                label="ISO code"
                required
                maxLength={3}
                defaultValue={current?.code ?? ''}
                readOnly={Boolean(current)}
                disabled={Boolean(current)}
                placeholder="EUR"
                hint={current ? 'Codes cannot be changed.' : 'Three letters, e.g. EUR.'}
                error={firstError(fieldErrors, 'code')}
              />
              <TextField
                name="name"
                label="Name"
                required
                defaultValue={current?.name ?? ''}
                placeholder="Euro"
                error={firstError(fieldErrors, 'name')}
              />
              <TextField
                name="symbol"
                label="Symbol"
                required
                maxLength={6}
                defaultValue={current?.symbol ?? ''}
                placeholder="€"
                error={firstError(fieldErrors, 'symbol')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <TextField
                name="rateToBase"
                label={`Rate per 1 ${baseCode}`}
                required
                inputMode="decimal"
                defaultValue={current ? String(current.rateToBase) : ''}
                readOnly={current?.isBase}
                disabled={current?.isBase}
                hint={current?.isBase ? 'The base currency is always 1.' : 'e.g. 1.17'}
                error={firstError(fieldErrors, 'rateToBase')}
              />
              <TextField
                name="decimals"
                label="Decimal places"
                inputMode="numeric"
                defaultValue={String(current?.decimals ?? 2)}
                hint="0 for JPY-style currencies."
                error={firstError(fieldErrors, 'decimals')}
              />
              <TextField
                name="roundTo"
                label="Round to nearest"
                inputMode="numeric"
                defaultValue={String(current?.roundTo ?? 1)}
                hint="In minor units. 100 rounds to whole units."
                error={firstError(fieldErrors, 'roundTo')}
              />
              <TextField
                name="sortOrder"
                label="Sort order"
                inputMode="numeric"
                defaultValue={String(current?.sortOrder ?? 0)}
                error={firstError(fieldErrors, 'sortOrder')}
              />
            </div>

            <CheckboxField
              name="isActive"
              value="true"
              defaultChecked={current?.isActive ?? true}
              label="Available for customers to choose"
            />

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
                Cancel
              </button>
              <SubmitButton pending={pending} pendingLabel="Saving…">
                Save currency
              </SubmitButton>
            </div>
          </form>
        </AdminCard>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing('new')} className="btn-primary btn-sm">
            <PlusIcon /> Add currency
          </button>

          <button
            type="button"
            onClick={refreshRates}
            disabled={refreshing || !providerConfigured}
            title={providerConfigured ? undefined : 'Set FX_API_URL to enable automatic refresh'}
            className="btn-secondary btn-sm"
          >
            {refreshing ? <Spinner /> : null}
            Refresh rates from provider
          </button>

          {!providerConfigured ? (
            <span className="self-center text-xs text-steel-400">
              Automatic refresh is off — set <code className="font-mono">FX_API_URL</code> to enable it.
            </span>
          ) : null}
        </div>
      )}

      <AdminCard padded={false}>
        <TableWrap>
          <thead>
            <tr>
              <Th>Currency</Th>
              <Th align="right">Rate per 1 {baseCode}</Th>
              <Th align="center">Decimals</Th>
              <Th align="center">Rounding</Th>
              <Th align="center">Orders</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {currencies.length === 0 ? (
              <EmptyRow colSpan={7} message="No currencies configured." />
            ) : (
              currencies.map((currency) => (
                <tr key={currency.code} className="hover:bg-steel-50">
                  <Td>
                    <span className="font-medium text-steel-900">
                      {currency.symbol} {currency.code}
                    </span>
                    <span className="block text-xs text-steel-400">{currency.name}</span>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {currency.isBase ? (
                      <span className="text-steel-400">1.000000 (base)</span>
                    ) : (
                      currency.rateToBase.toFixed(6)
                    )}
                  </Td>
                  <Td align="center" className="tabular-nums">
                    {currency.decimals}
                  </Td>
                  <Td align="center" className="tabular-nums text-xs">
                    {currency.roundTo > 1 ? `${currency.roundTo} minor units` : 'Exact'}
                  </Td>
                  <Td align="center" className="tabular-nums">
                    {currency.orderCount}
                  </Td>
                  <Td>
                    {currency.isBase ? (
                      <Badge tone="info">Base</Badge>
                    ) : currency.isActive ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="neutral">Hidden</Badge>
                    )}
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setEditing(currency)} className="btn-ghost btn-sm">
                        Edit
                      </button>
                      {!currency.isBase ? (
                        <button
                          type="button"
                          onClick={() => remove(currency)}
                          aria-label={`Remove ${currency.code}`}
                          className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                        >
                          <TrashIcon />
                        </button>
                      ) : null}
                    </div>
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
