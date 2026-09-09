import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { fail, guard, handler, isResponse, notFound, ok, parseJson, requireApiRole } from '@/lib/api';
import { categoryFieldSchema, categoryFieldUpdateSchema } from '@/lib/category-fields';
import { recordAudit } from '@/lib/audit';

/** Renames or drops one key in a Truck's `customFields` JSON, on every truck in a category. */
async function migrateCustomFieldKey(
  categoryId: string,
  oldKey: string,
  newKey: string | null,
): Promise<void> {
  const trucks = await prisma.truck.findMany({
    where: { categoryId },
    select: { id: true, customFields: true },
  });

  for (const truck of trucks) {
    const values = (truck.customFields ?? {}) as Record<string, unknown>;
    if (!(oldKey in values)) continue;

    const next: Record<string, unknown> = { ...values };
    const value = next[oldKey];
    delete next[oldKey];
    if (newKey) next[newKey] = value;

    await prisma.truck.update({
      where: { id: truck.id },
      data: { customFields: next as Prisma.InputJsonValue },
    });
  }
}

/**
 * CRUD for a category's custom field definitions — the schema behind
 * "Cars" having doors and boot space instead of axle configuration.
 *
 * Deliberately not exposed to the public: `GET` here is admin-only. The
 * public site and the admin truck form both read field definitions through
 * server components / other server-side code that queries Prisma directly,
 * not through this endpoint — this one exists for managing the schema.
 */

export const GET = handler(async (request: Request) => {
  const user = await requireApiRole('SALES');
  if (isResponse(user)) return user;

  const categoryId = new URL(request.url).searchParams.get('categoryId');
  if (!categoryId) return fail('categoryId is required.', 400);

  const fields = await prisma.categoryField.findMany({
    where: { categoryId },
    orderBy: { sortOrder: 'asc' },
  });

  return ok({ fields });
});

export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const input = await parseJson(request, categoryFieldSchema);

  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true, name: true },
  });
  if (!category) return notFound('Category');

  const existing = await prisma.categoryField.findUnique({
    where: { categoryId_key: { categoryId: input.categoryId, key: input.key } },
    select: { id: true },
  });
  if (existing) {
    return fail('A field with that key already exists on this category.', 409, {
      fieldErrors: { key: ['A field with that key already exists on this category.'] },
    });
  }

  const field = await prisma.categoryField.create({
    data: {
      categoryId: input.categoryId,
      key: input.key,
      label: input.label,
      type: input.type,
      unit: input.unit,
      options: input.options,
      required: input.required,
      showOnDetail: input.showOnDetail,
      showInFilters: input.showInFilters,
      helpText: input.helpText,
      sortOrder: input.sortOrder,
    },
  });

  await recordAudit({
    action: 'settings.updated',
    actor: user,
    entity: 'CategoryField',
    entityId: field.id,
    summary: `Added field "${field.label}" to ${category.name}`,
  });

  return ok({ field });
});

export const PATCH = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const input = await parseJson(request, categoryFieldUpdateSchema);

  const existing = await prisma.categoryField.findUnique({ where: { id: input.id } });
  if (!existing) return notFound('Field');

  if (input.key !== existing.key) {
    const clash = await prisma.categoryField.findUnique({
      where: { categoryId_key: { categoryId: input.categoryId, key: input.key } },
      select: { id: true },
    });
    if (clash) {
      return fail('A field with that key already exists on this category.', 409, {
        fieldErrors: { key: ['A field with that key already exists on this category.'] },
      });
    }
  }

  const field = await prisma.categoryField.update({
    where: { id: existing.id },
    data: {
      key: input.key,
      label: input.label,
      type: input.type,
      unit: input.unit,
      options: input.options,
      required: input.required,
      showOnDetail: input.showOnDetail,
      showInFilters: input.showInFilters,
      helpText: input.helpText,
      sortOrder: input.sortOrder,
    },
  });

  // A renamed key orphans any stored values under the old key — clean those
  // up on affected listings rather than leaving dead data behind silently.
  if (input.key !== existing.key) {
    await migrateCustomFieldKey(input.categoryId, existing.key, input.key);
  }

  await recordAudit({
    action: 'settings.updated',
    actor: user,
    entity: 'CategoryField',
    entityId: field.id,
    summary: `Updated field "${field.label}"`,
  });

  return ok({ field });
});

export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const { id } = await parseJson(request, z.object({ id: z.string().min(1) }));

  const field = await prisma.categoryField.findUnique({
    where: { id },
    select: { id: true, key: true, label: true, categoryId: true },
  });
  if (!field) return notFound('Field');

  // Strip the stored values for this field from every listing in the
  // category, so deleting a field doesn't leave orphaned JSON keys behind.
  await migrateCustomFieldKey(field.categoryId, field.key, null);

  await prisma.categoryField.delete({ where: { id } });

  await recordAudit({
    action: 'settings.updated',
    actor: user,
    entity: 'CategoryField',
    entityId: id,
    summary: `Deleted field "${field.label}"`,
  });

  return ok({ deleted: true });
});
