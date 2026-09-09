'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { AdminCard, EmptyRow, TableWrap, Td, Th } from '@/components/admin/shell';
import { Badge } from '@/components/ui/primitives';
import {
  CheckboxField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
  firstError,
} from '@/components/forms/fields';
import { PlusIcon, TrashIcon } from '@/components/ui/Icons';

export type FieldRow = {
  id: string;
  key: string;
  label: string;
  type: string;
  unit: string;
  options: string[];
  required: boolean;
  showOnDetail: boolean;
  showInFilters: boolean;
  helpText: string;
  sortOrder: number;
};

const TYPE_LABELS: Record<string, string> = {
  TEXT: 'Text',
  TEXTAREA: 'Long text',
  NUMBER: 'Number',
  BOOLEAN: 'Yes / No',
  SELECT: 'Single choice',
  MULTISELECT: 'Multiple choice',
};

const NEEDS_OPTIONS = new Set(['SELECT', 'MULTISELECT']);
const IS_FILTERABLE = new Set(['BOOLEAN', 'SELECT', 'MULTISELECT']);

/** camelCase-ify a label into a sensible default key, e.g. "Boot space" -> "bootSpace". */
function suggestKey(label: string): string {
  const words = label
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  return words
    .map((word, index) =>
      index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join('');
}

export function CategoryFieldManager({
  categoryId,
  categoryName,
  fields,
}: {
  categoryId: string;
  categoryName: string;
  fields: FieldRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<FieldRow | 'new' | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [type, setType] = useState('TEXT');
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);

  const current = editing === 'new' ? null : editing;

  function startNew() {
    setType('TEXT');
    setLabel('');
    setKey('');
    setKeyTouched(false);
    setEditing('new');
  }

  function startEdit(field: FieldRow) {
    setType(field.type);
    setLabel(field.label);
    setKey(field.key);
    setKeyTouched(true);
    setEditing(field);
  }

  function onLabelChange(value: string) {
    setLabel(value);
    if (!keyTouched) setKey(suggestKey(value));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    const data = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      await apiFetch('/api/admin/category-fields', {
        method: editing === 'new' ? 'POST' : 'PATCH',
        json: { ...data, categoryId, ...(current ? { id: current.id } : {}) },
      });
      setEditing(null);
      setMessage({ tone: 'success', text: 'Field saved.' });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setMessage({ tone: 'error', text: caught.message });
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setMessage({ tone: 'error', text: 'Could not save the field.' });
      }
    } finally {
      setPending(false);
    }
  }

  async function remove(field: FieldRow) {
    if (
      !window.confirm(
        `Delete "${field.label}"? Any values already stored for it on ${categoryName} listings will be removed too.`,
      )
    ) {
      return;
    }

    try {
      await apiFetch('/api/admin/category-fields', { method: 'DELETE', json: { id: field.id } });
      setMessage({ tone: 'success', text: `"${field.label}" deleted.` });
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof ApiClientError ? caught.message : 'Could not delete the field.',
      });
    }
  }

  return (
    <div className="space-y-4">
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      {editing ? (
        <AdminCard title={editing === 'new' ? 'New field' : `Edit "${current?.label}"`}>
          <form onSubmit={save} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="label"
                label="Label"
                required
                value={label}
                onChange={(event) => onLabelChange(event.target.value)}
                placeholder="Boot space"
                hint="What staff and, if shown on the detail page, customers see."
                error={firstError(fieldErrors, 'label')}
              />
              <TextField
                name="key"
                label="Key"
                required
                value={key}
                onChange={(event) => {
                  setKey(event.target.value);
                  setKeyTouched(true);
                }}
                placeholder="bootSpace"
                hint="Used internally to store the value. camelCase, no spaces."
                error={firstError(fieldErrors, 'key')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                name="type"
                label="Field type"
                value={type}
                onChange={(event) => setType(event.target.value)}
                options={Object.entries(TYPE_LABELS).map(([value, optionLabel]) => ({
                  value,
                  label: optionLabel,
                }))}
              />
              <TextField
                name="unit"
                label="Unit (optional)"
                defaultValue={current?.unit}
                placeholder="L, kg, bhp…"
                hint="Shown after the value on the detail page."
                error={firstError(fieldErrors, 'unit')}
              />
            </div>

            {NEEDS_OPTIONS.has(type) ? (
              <TextAreaField
                name="options"
                label="Options"
                required
                rows={4}
                defaultValue={current?.options.join('\n')}
                hint="One option per line."
                error={firstError(fieldErrors, 'options')}
              />
            ) : null}

            <TextField
              name="helpText"
              label="Help text (optional)"
              defaultValue={current?.helpText}
              hint="Shown under the input on the vehicle form."
              error={firstError(fieldErrors, 'helpText')}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                name="sortOrder"
                label="Sort order"
                inputMode="numeric"
                defaultValue={String(current?.sortOrder ?? fields.length)}
                error={firstError(fieldErrors, 'sortOrder')}
              />
            </div>

            <div className="space-y-3 rounded-lg border border-steel-200 bg-steel-50 p-4">
              <CheckboxField
                name="required"
                value="true"
                defaultChecked={current?.required ?? false}
                label="Required when creating a listing in this category"
              />
              <CheckboxField
                name="showOnDetail"
                value="true"
                defaultChecked={current?.showOnDetail ?? true}
                label="Show as a row in the vehicle's specification table on the public site"
              />
              <CheckboxField
                name="showInFilters"
                value="true"
                disabled={!IS_FILTERABLE.has(type)}
                defaultChecked={current?.showInFilters ?? false}
                label="Show as a filter on the public stock listing"
                hint={
                  IS_FILTERABLE.has(type)
                    ? undefined
                    : 'Only Yes/No, single choice and multiple choice fields can be used as filters.'
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
                Cancel
              </button>
              <SubmitButton pending={pending} pendingLabel="Saving…">
                Save field
              </SubmitButton>
            </div>
          </form>
        </AdminCard>
      ) : (
        <button type="button" onClick={startNew} className="btn-primary btn-sm">
          <PlusIcon /> Add field
        </button>
      )}

      <AdminCard padded={false}>
        <TableWrap>
          <thead>
            <tr>
              <Th>Field</Th>
              <Th>Type</Th>
              <Th align="center">Required</Th>
              <Th align="center">On detail page</Th>
              <Th align="center">Filterable</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 ? (
              <EmptyRow
                colSpan={6}
                message={`No custom fields yet for ${categoryName} — it uses only the standard vehicle details.`}
              />
            ) : (
              fields.map((field) => (
                <tr key={field.id} className="hover:bg-steel-50">
                  <Td>
                    <span className="font-medium text-steel-900">{field.label}</span>
                    <span className="block font-mono text-xs text-steel-400">
                      {field.key}
                      {field.unit ? ` · ${field.unit}` : ''}
                    </span>
                  </Td>
                  <Td className="text-xs">{TYPE_LABELS[field.type] ?? field.type}</Td>
                  <Td align="center">{field.required ? <Badge tone="warning">Required</Badge> : '—'}</Td>
                  <Td align="center">
                    {field.showOnDetail ? <Badge tone="success">Shown</Badge> : <Badge tone="neutral">Hidden</Badge>}
                  </Td>
                  <Td align="center">
                    {field.showInFilters ? <Badge tone="info">Filter</Badge> : '—'}
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => startEdit(field)} className="btn-ghost btn-sm">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(field)}
                        aria-label={`Delete ${field.label}`}
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
      </AdminCard>
    </div>
  );
}
