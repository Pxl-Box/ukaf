import { z } from 'zod';
import { prisma } from '@/lib/db';
import { guard, handler, isResponse, notFound, ok, parseJson, requireApiRole } from '@/lib/api';
import { shippingRateSchema, shippingZoneSchema } from '@/lib/validation';
import { uniqueSlug } from '@/lib/utils';
import { recordAudit } from '@/lib/audit';

/**
 * Shipping calculator reference data: zones and their weight-banded rates.
 * One endpoint discriminated on `entity`, matching the catalogue route's
 * pattern for small admin CRUD surfaces.
 */

const entitySchema = z.enum(['zone', 'rate']);

export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const body = await request.json().catch(() => ({}));
  const entity = entitySchema.parse((body as { entity?: string }).entity);

  if (entity === 'zone') {
    const input = shippingZoneSchema.parse(body);
    const slug = await uniqueSlug(input.name, async (candidate) =>
      Boolean(await prisma.shippingZone.findUnique({ where: { slug: candidate }, select: { id: true } })),
    );

    const zone = await prisma.shippingZone.create({
      data: {
        name: input.name,
        slug,
        countries: input.countries || null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive,
      },
    });

    await recordAudit({
      action: 'settings.updated',
      actor: user,
      entity: 'ShippingZone',
      entityId: zone.id,
      summary: `Added shipping zone ${zone.name}`,
    });
    return ok({ zone });
  }

  const input = shippingRateSchema.parse(body);
  const zone = await prisma.shippingZone.findUnique({ where: { id: input.zoneId }, select: { id: true, name: true } });
  if (!zone) return notFound('Zone');

  const rate = await prisma.shippingRate.create({
    data: {
      zoneId: input.zoneId,
      minWeightKg: input.minWeightKg,
      maxWeightKg: input.maxWeightKg,
      priceNet: input.priceNet,
      sortOrder: input.sortOrder ?? 0,
    },
  });

  await recordAudit({
    action: 'settings.updated',
    actor: user,
    entity: 'ShippingRate',
    entityId: rate.id,
    summary: `Added shipping rate to ${zone.name}`,
  });
  return ok({ rate });
});

export const PATCH = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const body = await request.json().catch(() => ({}));
  const { entity, id } = z.object({ entity: entitySchema, id: z.string().min(1) }).parse(body);

  if (entity === 'zone') {
    const input = shippingZoneSchema.parse(body);
    const zone = await prisma.shippingZone.update({
      where: { id },
      data: {
        name: input.name,
        countries: input.countries || null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive,
      },
    });
    return ok({ zone });
  }

  const input = shippingRateSchema.parse(body);
  const rate = await prisma.shippingRate.update({
    where: { id },
    data: {
      zoneId: input.zoneId,
      minWeightKg: input.minWeightKg,
      maxWeightKg: input.maxWeightKg,
      priceNet: input.priceNet,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return ok({ rate });
});

export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const { entity, id } = await parseJson(request, z.object({ entity: entitySchema, id: z.string().min(1) }));

  if (entity === 'zone') {
    const zone = await prisma.shippingZone.findUnique({ where: { id }, select: { name: true } });
    if (!zone) return notFound('Zone');
    // Cascades to its rates — a zone with no rates left is not useful to keep.
    await prisma.shippingZone.delete({ where: { id } });
    await recordAudit({
      action: 'settings.updated',
      actor: user,
      entity: 'ShippingZone',
      entityId: id,
      summary: `Deleted shipping zone ${zone.name}`,
    });
    return ok({ deleted: true });
  }

  const rate = await prisma.shippingRate.findUnique({ where: { id }, select: { id: true } });
  if (!rate) return notFound('Rate');
  await prisma.shippingRate.delete({ where: { id } });
  await recordAudit({
    action: 'settings.updated',
    actor: user,
    entity: 'ShippingRate',
    entityId: id,
    summary: 'Deleted shipping rate',
  });
  return ok({ deleted: true });
});

