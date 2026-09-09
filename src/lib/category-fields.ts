import type { CategoryField, CategoryFieldType, Prisma } from '@prisma/client';
import { z } from 'zod';

/**
 * Admin-defined per-category listing fields.
 *
 * A category's fields are the schema for what a listing in it looks like —
 * "Cars" might define doors and boot space, "Tractor Units" might not define
 * anything custom at all and rely purely on the built-in HGV spec columns on
 * `Truck` (axle config, GVW, cab type…). Values live in `Truck.customFields`,
 * a JSON object keyed by `CategoryField.key`; this module is the one place
 * that reads or writes that column, so its shape stays consistent everywhere
 * it's touched — the admin form, the public spec table, and the filters.
 */

export type CustomFieldValue = string | number | boolean | string[] | null;
export type CustomFieldValues = Record<string, CustomFieldValue>;

/** The field types a visitor can actually filter stock by. */
export const FILTERABLE_TYPES: readonly CategoryFieldType[] = ['BOOLEAN', 'SELECT', 'MULTISELECT'];

export function isFilterableType(type: CategoryFieldType): boolean {
  return FILTERABLE_TYPES.includes(type);
}

// ---------------------------------------------------------------------------
// Admin CRUD validation
// ---------------------------------------------------------------------------

const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

/**
 * The plain object schema, kept separate from `categoryFieldSchema` below so
 * routes that need an `id` (PATCH) can `.extend()` it — `.extend` only
 * exists on a `ZodObject`, not on the `.refine()`-wrapped version.
 */
export const categoryFieldObjectSchema = z
  .object({
    categoryId: z.string().min(1),
    key: z
      .string()
      .trim()
      .min(1, 'Enter a field key.')
      .max(60)
      .regex(KEY_PATTERN, 'Use a camelCase key starting with a lowercase letter, e.g. bootSpaceLitres.'),
    label: z.string().trim().min(1, 'Enter a label.').max(80),
    type: z.enum(['TEXT', 'TEXTAREA', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTISELECT']),
    unit: z
      .string()
      .trim()
      .max(20)
      .optional()
      .or(z.literal(''))
      .transform((value) => value || undefined),
    /** Newline-separated in the admin form; one option per line. */
    options: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((value) => {
        if (!value) return [];
        const list = Array.isArray(value) ? value : value.split('\n');
        return list.map((entry) => entry.trim()).filter(Boolean).slice(0, 50);
      }),
    required: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((value) => value === true || value === 'true' || value === 'on'),
    showOnDetail: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((value) => value === true || value === 'true' || value === 'on'),
    showInFilters: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((value) => value === true || value === 'true' || value === 'on'),
    helpText: z
      .string()
      .trim()
      .max(200)
      .optional()
      .or(z.literal(''))
      .transform((value) => value || undefined),
    sortOrder: z
      .union([z.string(), z.number()])
      .optional()
      .transform((value) => (value === undefined || value === '' ? 0 : Number(value)))
      .refine((value) => Number.isFinite(value), { message: 'Enter a whole number.' }),
  });

/**
 * A select-type field needs at least one option to choose from. Repeated on
 * both schemas below rather than factored into a generic helper — a generic
 * constrained to `{ type, options }` collapses Zod's inferred output back to
 * the constraint shape, which loses every other field's type.
 */
export const categoryFieldSchema = categoryFieldObjectSchema
  .refine((data) => data.type !== 'SELECT' || data.options.length > 0, {
    message: 'A select field needs at least one option.',
    path: ['options'],
  })
  .refine((data) => data.type !== 'MULTISELECT' || data.options.length > 0, {
    message: 'A multi-select field needs at least one option.',
    path: ['options'],
  });

/** Same validation as `categoryFieldSchema`, plus the `id` a PATCH needs. */
export const categoryFieldUpdateSchema = categoryFieldObjectSchema
  .extend({ id: z.string().min(1) })
  .refine((data) => data.type !== 'SELECT' || data.options.length > 0, {
    message: 'A select field needs at least one option.',
    path: ['options'],
  })
  .refine((data) => data.type !== 'MULTISELECT' || data.options.length > 0, {
    message: 'A multi-select field needs at least one option.',
    path: ['options'],
  });

export type CategoryFieldInput = z.infer<typeof categoryFieldSchema>;

// ---------------------------------------------------------------------------
// Listing-time coercion (admin truck form → Truck.customFields)
// ---------------------------------------------------------------------------

export type CoerceResult =
  | { ok: true; values: CustomFieldValues }
  | { ok: false; errors: Record<string, string> };

/**
 * Turns raw form input (everything arrives as a string, or an array of
 * strings for a multiselect) into the typed values `Truck.customFields`
 * stores, validating each against its field definition — required-ness,
 * numeric parsing, and that a select's value is actually one of its options.
 *
 * Fields that don't belong to the category (or don't appear in `fields` at
 * all) are dropped rather than stored — this is what keeps `customFields`
 * from accumulating stale keys after a listing's category is changed or a
 * field is renamed.
 */
export function coerceCustomFieldValues(
  fields: Pick<CategoryField, 'key' | 'label' | 'type' | 'required' | 'options'>[],
  raw: Record<string, unknown>,
): CoerceResult {
  const values: CustomFieldValues = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const input = raw[field.key];
    const isEmpty =
      input === undefined ||
      input === null ||
      input === '' ||
      (Array.isArray(input) && input.length === 0);

    if (isEmpty) {
      if (field.required) errors[field.key] = `${field.label} is required.`;
      continue;
    }

    switch (field.type) {
      case 'NUMBER': {
        const parsed = Number(String(input).replace(/,/g, ''));
        if (!Number.isFinite(parsed)) {
          errors[field.key] = `${field.label} must be a number.`;
          break;
        }
        values[field.key] = parsed;
        break;
      }
      case 'BOOLEAN': {
        values[field.key] = input === true || input === 'true' || input === 'on';
        break;
      }
      case 'SELECT': {
        const choice = String(input);
        if (!field.options.includes(choice)) {
          errors[field.key] = `Choose a valid option for ${field.label}.`;
          break;
        }
        values[field.key] = choice;
        break;
      }
      case 'MULTISELECT': {
        const choices = (Array.isArray(input) ? input : [input]).map(String);
        const invalid = choices.filter((choice) => !field.options.includes(choice));
        if (invalid.length > 0) {
          errors[field.key] = `Choose valid options for ${field.label}.`;
          break;
        }
        values[field.key] = choices;
        break;
      }
      case 'TEXTAREA':
      case 'TEXT':
      default: {
        const text = String(input).trim().slice(0, field.type === 'TEXTAREA' ? 4000 : 200);
        if (text) values[field.key] = text;
        break;
      }
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, values };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export type FormattedCustomField = {
  key: string;
  label: string;
  unit: string | null;
  display: string;
};

/** Renders stored values against their field definitions for the spec table. */
export function formatCustomFieldsForDisplay(
  fields: Pick<CategoryField, 'key' | 'label' | 'type' | 'unit' | 'showOnDetail' | 'sortOrder'>[],
  values: unknown,
): FormattedCustomField[] {
  const record = isRecord(values) ? values : {};

  return fields
    .filter((field) => field.showOnDetail)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((field) => {
      const raw = record[field.key];
      const display = formatValue(field.type, raw);
      return display === null
        ? null
        : { key: field.key, label: field.label, unit: field.unit, display };
    })
    .filter((entry): entry is FormattedCustomField => entry !== null);
}

function formatValue(type: CategoryFieldType, raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;

  switch (type) {
    case 'BOOLEAN':
      return raw ? 'Yes' : 'No';
    case 'MULTISELECT':
      return Array.isArray(raw) && raw.length > 0 ? raw.join(', ') : null;
    case 'NUMBER':
      return typeof raw === 'number' ? raw.toLocaleString('en-GB') : String(raw);
    default:
      return String(raw);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/**
 * Builds Prisma JSON-path where clauses for the `cf_<key>=<value>` query
 * parameters the public stock filter sidebar sends once a category is
 * selected. Only BOOLEAN, SELECT and MULTISELECT fields are filterable —
 * see `isFilterableType`.
 */
export function buildCustomFieldWhere(
  fields: Pick<CategoryField, 'key' | 'type'>[],
  params: Record<string, string>,
): Prisma.TruckWhereInput[] {
  const clauses: Prisma.TruckWhereInput[] = [];
  const byKey = new Map(fields.map((field) => [field.key, field]));

  for (const [param, rawValue] of Object.entries(params)) {
    if (!param.startsWith('cf_') || !rawValue) continue;
    const key = param.slice(3);
    const field = byKey.get(key);
    if (!field || !isFilterableType(field.type)) continue;

    if (field.type === 'BOOLEAN') {
      clauses.push({ customFields: { path: [key], equals: rawValue === 'true' } });
    } else if (field.type === 'MULTISELECT') {
      clauses.push({ customFields: { path: [key], array_contains: rawValue } });
    } else {
      clauses.push({ customFields: { path: [key], equals: rawValue } });
    }
  }

  return clauses;
}
