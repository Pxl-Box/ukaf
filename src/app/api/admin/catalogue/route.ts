import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, guard, handler, isResponse, notFound, ok, parseJson, requireApiRole } from '@/lib/api';
import { categorySchema, locationSchema, makeSchema } from '@/lib/validation';
import { uniqueSlug } from '@/lib/utils';
import { recordAudit } from '@/lib/audit';

/**
 * Reference data: makes, body-type categories and depots.
 *
 * All three share one endpoint discriminated on `entity`, because they are
 * small CRUD surfaces managed from a single admin screen.
 */

const entitySchema = z.enum(['make', 'category', 'location']);

export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const body = await request.json().catch(() => ({}));
  const entity = entitySchema.parse((body as { entity?: string }).entity);

  if (entity === 'make') {
    const input = makeSchema.parse(body);
    const slug = await uniqueSlug(input.name, async (candidate) =>
      Boolean(await prisma.make.findUnique({ where: { slug: candidate }, select: { id: true } })),
    );

    const make = await prisma.make.create({
      data: {
        name: input.name,
        slug,
        logoUrl: input.logoUrl || null,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    await recordAudit({ action: 'settings.updated', actor: user, entity: 'Make', entityId: make.id, summary: `Added make ${make.name}` });
    return ok({ make });
  }

  if (entity === 'category') {
    const input = categorySchema.parse(body);
    const slug = await uniqueSlug(input.name, async (candidate) =>
      Boolean(await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } })),
    );

    const category = await prisma.category.create({
      data: {
        name: input.name,
        slug,
        description: input.description || null,
        imageUrl: input.imageUrl || null,
        icon: input.icon || null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive,
      },
    });

    await recordAudit({ action: 'settings.updated', actor: user, entity: 'Category', entityId: category.id, summary: `Added category ${category.name}` });
    return ok({ category });
  }

  const input = locationSchema.parse(body);
  const slug = await uniqueSlug(input.name, async (candidate) =>
    Boolean(await prisma.location.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );

  const location = await prisma.location.create({
    data: {
      name: input.name,
      slug,
      line1: input.line1 || null,
      city: input.city,
      postcode: input.postcode || null,
      country: input.country,
      phone: input.phone || null,
      email: input.email || null,
      isActive: input.isActive,
    },
  });

  await recordAudit({ action: 'settings.updated', actor: user, entity: 'Location', entityId: location.id, summary: `Added depot ${location.name}` });
  return ok({ location });
});

export const PATCH = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const body = await request.json().catch(() => ({}));
  const { entity, id } = z
    .object({ entity: entitySchema, id: z.string().min(1) })
    .parse(body);

  if (entity === 'make') {
    const input = makeSchema.parse(body);
    const make = await prisma.make.update({
      where: { id },
      data: { name: input.name, logoUrl: input.logoUrl || null, sortOrder: input.sortOrder ?? 0 },
    });
    return ok({ make });
  }

  if (entity === 'category') {
    const input = categorySchema.parse(body);
    const category = await prisma.category.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description || null,
        imageUrl: input.imageUrl || null,
        icon: input.icon || null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive,
      },
    });
    return ok({ category });
  }

  const input = locationSchema.parse(body);
  const location = await prisma.location.update({
    where: { id },
    data: {
      name: input.name,
      line1: input.line1 || null,
      city: input.city,
      postcode: input.postcode || null,
      country: input.country,
      phone: input.phone || null,
      email: input.email || null,
      isActive: input.isActive,
    },
  });
  return ok({ location });
});

export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const { entity, id } = await parseJson(
    request,
    z.object({ entity: entitySchema, id: z.string().min(1) }),
  );

  // Reference data in use by stock must not disappear underneath it.
  if (entity === 'make') {
    const make = await prisma.make.findUnique({
      where: { id },
      select: { name: true, _count: { select: { trucks: true } } },
    });
    if (!make) return notFound('Make');
    if (make._count.trucks > 0) {
      return fail(
        `${make.name} is used by ${make._count.trucks} vehicle(s). Reassign them before deleting it.`,
        409,
        { code: 'IN_USE' },
      );
    }
    await prisma.make.delete({ where: { id } });
  } else if (entity === 'category') {
    const category = await prisma.category.findUnique({
      where: { id },
      select: { name: true, _count: { select: { trucks: true } } },
    });
    if (!category) return notFound('Category');
    if (category._count.trucks > 0) {
      return fail(
        `${category.name} is used by ${category._count.trucks} vehicle(s). Reassign them before deleting it.`,
        409,
        { code: 'IN_USE' },
      );
    }
    await prisma.category.delete({ where: { id } });
  } else {
    const location = await prisma.location.findUnique({
      where: { id },
      select: { name: true, _count: { select: { trucks: true } } },
    });
    if (!location) return notFound('Depot');
    if (location._count.trucks > 0) {
      // Vehicles keep a nullable location, so deactivating is the safe move.
      await prisma.location.update({ where: { id }, data: { isActive: false } });
      return ok({ deleted: false, deactivated: true, message: 'Depot deactivated (still linked to stock).' });
    }
    await prisma.location.delete({ where: { id } });
  }

  await recordAudit({
    action: 'settings.updated',
    actor: user,
    entity: entity === 'make' ? 'Make' : entity === 'category' ? 'Category' : 'Location',
    entityId: id,
    summary: `Deleted ${entity}`,
  });

  return ok({ deleted: true, deactivated: false });
});
