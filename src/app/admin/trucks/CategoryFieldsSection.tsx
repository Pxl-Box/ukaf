'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import {
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
  firstError,
} from '@/components/forms/fields';
import { Spinner } from '@/components/ui/primitives';
import { AdminCard } from '@/components/admin/shell';

type FieldDef = {
  id: string;
  key: string;
  label: string;
  type: string;
  unit: string | null;
  options: string[];
  required: boolean;
  helpText: string | null;
};

/**
 * Renders the selected category's admin-defined fields beneath the standard
 * vehicle form — the "Cars have doors and boot space instead of axle
 * configuration" part. Refetches whenever `categoryId` changes.
 *
 * Values are submitted as `custom__<key>` form fields; `TruckForm` collects
 * those back into a `customFields` object before posting, so this component
 * stays a plain, uncontrolled section of the surrounding <form> rather than
 * needing to lift state up.
 */
export function CategoryFieldsSection({
  categoryId,
  initialValues,
  fieldErrors,
}: {
  categoryId: string;
  initialValues: Record<string, unknown>;
  fieldErrors: Record<string, string[]>;
}) {
  const [fields, setFields] = useState<FieldDef[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!categoryId) {
      setFields(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch<{ fields: FieldDef[] }>(`/api/admin/category-fields?categoryId=${categoryId}`)
      .then((result) => {
        if (!cancelled) setFields(result.fields);
      })
      .catch(() => {
        if (!cancelled) setFields([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  if (!categoryId) return null;
  if (loading && fields === null) {
    return (
      <AdminCard title="Category-specific details">
        <div className="flex items-center gap-2 py-4 text-sm text-steel-500">
          <Spinner /> Loading fields for this body type…
        </div>
      </AdminCard>
    );
  }
  if (!fields || fields.length === 0) return null;

  return (
    <AdminCard
      title="Category-specific details"
      description="Defined for this body type in Makes & categories → Fields."
    >
      <div className="space-y-4">
        {fields.map((field) => {
          const name = `custom__${field.key}`;
          const value = initialValues[field.key];
          const error = firstError(fieldErrors, field.key);
          const label = field.unit ? `${field.label} (${field.unit})` : field.label;

          if (field.type === 'BOOLEAN') {
            return (
              <CheckboxField
                key={field.id}
                name={name}
                value="true"
                defaultChecked={value === true}
                label={label}
                hint={field.helpText ?? undefined}
                error={error}
              />
            );
          }

          if (field.type === 'SELECT') {
            return (
              <SelectField
                key={field.id}
                name={name}
                label={label}
                required={field.required}
                defaultValue={typeof value === 'string' ? value : ''}
                placeholder="Select…"
                options={field.options.map((option) => ({ value: option, label: option }))}
                hint={field.helpText ?? undefined}
                error={error}
              />
            );
          }

          if (field.type === 'MULTISELECT') {
            const selected = Array.isArray(value) ? value.map(String) : [];
            return (
              <fieldset key={field.id} className="rounded-lg border border-steel-200 p-3.5">
                <legend className="px-1 text-sm font-medium text-steel-800">
                  {label}
                  {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
                </legend>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                  {field.options.map((option) => (
                    <label key={option} className="flex items-center gap-1.5 text-sm text-steel-700">
                      <input
                        type="checkbox"
                        name={name}
                        value={option}
                        defaultChecked={selected.includes(option)}
                        className="checkbox"
                      />
                      {option}
                    </label>
                  ))}
                </div>
                {field.helpText ? <p className="hint">{field.helpText}</p> : null}
                {error ? <p className="field-error">{error}</p> : null}
              </fieldset>
            );
          }

          if (field.type === 'TEXTAREA') {
            return (
              <TextAreaField
                key={field.id}
                name={name}
                label={label}
                required={field.required}
                rows={3}
                defaultValue={typeof value === 'string' ? value : ''}
                hint={field.helpText ?? undefined}
                error={error}
              />
            );
          }

          return (
            <TextField
              key={field.id}
              name={name}
              label={label}
              required={field.required}
              inputMode={field.type === 'NUMBER' ? 'decimal' : undefined}
              defaultValue={value === null || value === undefined ? '' : String(value)}
              hint={field.helpText ?? undefined}
              error={error}
            />
          );
        })}
      </div>
    </AdminCard>
  );
}
