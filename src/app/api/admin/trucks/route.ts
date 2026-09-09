import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  fail,
  guard,
  handler,
  isResponse,
  notFound,
  ok,
  parseJson,
  requireApiRole,
} from '@/lib/api';
import { truckSchema } from '@/lib/validation';
import { uniqueSlug } from '@/lib/utils';
import { diffRecords, recordAudit } from '@/lib/audit';
import { coerceCustomFieldValues } from '@/lib/category-fields';

/**
 * Stock CRUD.
 *
 * SALES may create and edit stock; deleting is restricted to MANAGER and
 * above, and anything that has ever been ordered is archived rather than
 * deleted so order history stays intact.
 */

function toDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Validates the submitted `customFields` against the chosen category's field
 * definitions and returns the coerced values, or a 422 Response describing
 * which fields failed — same "throw a Response" pattern as the rest of this
 * handler, so a call site just does `if (isResponse(result)) return result;`.
 */
async function resolveCustomFields(
  categoryId: string,
  raw: Record<string, unknown>,
): Promise<Record<string, unknown> | Response> {
  const fields = await prisma.categoryField.findMany({ where: { categoryId } });
  if (fields.length === 0) return {};

  const result = coerceCustomFieldValues(fields, raw);
  if (!result.ok) {
    return fail('Please check the highlighted fields.', 422, {
      code: 'VALIDATION_ERROR',
      fieldErrors: Object.fromEntries(Object.entries(result.errors).map(([key, message]) => [key, [message]])),
    });
  }
  return result.values;
}

export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('SALES');
  if (isResponse(user)) return user;

  const input = await parseJson(request, truckSchema);

  const duplicate = await prisma.truck.findUnique({
    where: { stockNumber: input.stockNumber },
    select: { id: true },
  });
  if (duplicate) {
    return fail('That stock number is already in use.', 409, {
      code: 'DUPLICATE_STOCK_NUMBER',
      fieldErrors: { stockNumber: ['That stock number is already in use.'] },
    });
  }

  const customFields = await resolveCustomFields(input.categoryId, input.customFields);
  if (isResponse(customFields)) return customFields;

  const slug = await uniqueSlug(input.slug || input.title, async (candidate) =>
    Boolean(await prisma.truck.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );

  const truck = await prisma.truck.create({
    data: {
      ...mapTruckInput(input),
      customFields: customFields as Prisma.InputJsonValue,
      slug,
      createdById: user.id,
      publishedAt: input.status === 'DRAFT' ? null : new Date(),
    },
    select: { id: true, slug: true, stockNumber: true, title: true },
  });

  await recordAudit({
    action: 'truck.created',
    actor: user,
    entity: 'Truck',
    entityId: truck.id,
    summary: `Created ${truck.stockNumber} — ${truck.title}`,
  });

  return ok({ truck });
});

export const PATCH = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('SALES');
  if (isResponse(user)) return user;

  const input = await parseJson(request, truckSchema.extend({ id: z.string().min(1) }));

  const existing = await prisma.truck.findUnique({ where: { id: input.id } });
  if (!existing) return notFound('Vehicle');

  if (input.stockNumber !== existing.stockNumber) {
    const clash = await prisma.truck.findUnique({
      where: { stockNumber: input.stockNumber },
      select: { id: true },
    });
    if (clash) {
      return fail('That stock number is already in use.', 409, {
        fieldErrors: { stockNumber: ['That stock number is already in use.'] },
      });
    }
  }

  // Slug changes break existing links, so only regenerate when asked.
  let slug = existing.slug;
  if (input.slug && input.slug !== existing.slug) {
    slug = await uniqueSlug(input.slug, async (candidate) =>
      Boolean(
        await prisma.truck.findFirst({
          where: { slug: candidate, id: { not: existing.id } },
          select: { id: true },
        }),
      ),
    );
  }

  const customFields = await resolveCustomFields(input.categoryId, input.customFields);
  if (isResponse(customFields)) return customFields;

  const data = mapTruckInput(input);

  const truck = await prisma.truck.update({
    where: { id: existing.id },
    data: {
      ...data,
      customFields: customFields as Prisma.InputJsonValue,
      slug,
      // Publishing for the first time stamps publishedAt; unpublishing clears it.
      publishedAt:
        input.status === 'DRAFT' ? null : (existing.publishedAt ?? new Date()),
      soldAt: input.status === 'SOLD' ? (existing.soldAt ?? new Date()) : null,
    },
  });

  // Price movements are tracked separately so the team can see the history.
  if (existing.priceNet !== truck.priceNet) {
    await prisma.priceHistory.create({
      data: {
        truckId: truck.id,
        oldPriceNet: existing.priceNet,
        newPriceNet: truck.priceNet,
        changedById: user.id,
      },
    });

    await recordAudit({
      action: 'truck.price_changed',
      actor: user,
      entity: 'Truck',
      entityId: truck.id,
      summary: `${truck.stockNumber}: ${(existing.priceNet / 100).toFixed(2)} → ${(truck.priceNet / 100).toFixed(2)}`,
    });
  }

  if (existing.status !== truck.status) {
    await recordAudit({
      action: 'truck.status_changed',
      actor: user,
      entity: 'Truck',
      entityId: truck.id,
      summary: `${truck.stockNumber}: ${existing.status} → ${truck.status}`,
    });
  }

  await recordAudit({
    action: 'truck.updated',
    actor: user,
    entity: 'Truck',
    entityId: truck.id,
    summary: `Updated ${truck.stockNumber}`,
    metadata: diffRecords(existing, truck),
  });

  return ok({ truck: { id: truck.id, slug: truck.slug, stockNumber: truck.stockNumber } });
});

export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const { id } = await parseJson(request, z.object({ id: z.string().min(1) }));

  const truck = await prisma.truck.findUnique({
    where: { id },
    select: {
      id: true,
      stockNumber: true,
      title: true,
      _count: { select: { orderItems: true } },
    },
  });
  if (!truck) return notFound('Vehicle');

  // Never destroy a vehicle that appears on an invoice.
  if (truck._count.orderItems > 0) {
    await prisma.truck.update({ where: { id }, data: { status: 'ARCHIVED', publishedAt: null } });

    await recordAudit({
      action: 'truck.status_changed',
      actor: user,
      entity: 'Truck',
      entityId: id,
      summary: `Archived ${truck.stockNumber} (has order history, not deleted)`,
    });

    return ok({ deleted: false, archived: true, message: 'This vehicle has order history, so it was archived instead of deleted.' });
  }

  await prisma.truck.delete({ where: { id } });

  await recordAudit({
    action: 'truck.deleted',
    actor: user,
    entity: 'Truck',
    entityId: id,
    summary: `Deleted ${truck.stockNumber} — ${truck.title}`,
  });

  return ok({ deleted: true, archived: false });
});

/** Shared field mapping between create and update. */
function mapTruckInput(input: z.output<typeof truckSchema>) {
  return {
    title: input.title,
    stockNumber: input.stockNumber,
    makeId: input.makeId,
    modelId: input.modelId || null,
    modelName: input.modelName,
    variant: input.variant || null,
    categoryId: input.categoryId,
    locationId: input.locationId || null,
    year: input.year,
    mileageKm: input.mileageKm,
    condition: input.condition,
    fuelType: input.fuelType,
    transmission: input.transmission,
    gears: input.gears,
    emissions: input.emissions,
    axleConfig: input.axleConfig || null,
    cabType: input.cabType || null,
    bodyLengthMm: input.bodyLengthMm,
    wheelbaseMm: input.wheelbaseMm,
    grossWeightKg: input.grossWeightKg,
    payloadKg: input.payloadKg,
    engineCc: input.engineCc,
    powerBhp: input.powerBhp,
    colour: input.colour || null,
    previousOwners: input.previousOwners,
    motExpiry: toDate(input.motExpiry),
    serviceHistory: input.serviceHistory || null,
    registration: input.registration || null,
    vin: input.vin || null,
    costPriceNet: input.costPriceNet,
    priceNet: input.priceNet,
    retailPriceNet: input.retailPriceNet,
    vatTreatment: input.vatTreatment,
    vatRate: input.vatRate,
    priceOnApplication: input.priceOnApplication,
    reservationFee: input.reservationFee,
    quantity: input.quantity,
    status: input.status,
    featured: input.featured,
    shortDescription: input.shortDescription || null,
    description: input.description || null,
    features: input.features,
    metaTitle: input.metaTitle || null,
    metaDescription: input.metaDescription || null,
  };
}

