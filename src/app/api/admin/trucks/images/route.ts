import { z } from 'zod';
import { prisma } from '@/lib/db';
import { guard, handler, isResponse, notFound, ok, parseJson, requireApiRole } from '@/lib/api';
import { truckImageSchema } from '@/lib/validation';
import { recordAudit } from '@/lib/audit';

/** Attaches an image URL to a vehicle. */
export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('SALES');
  if (isResponse(user)) return user;

  const input = await parseJson(request, truckImageSchema);

  const truck = await prisma.truck.findUnique({
    where: { id: input.truckId },
    select: { id: true, stockNumber: true, _count: { select: { images: true } } },
  });
  if (!truck) return notFound('Vehicle');

  const isFirst = truck._count.images === 0;
  const makePrimary = input.isPrimary || isFirst;

  if (makePrimary) {
    await prisma.truckImage.updateMany({
      where: { truckId: truck.id },
      data: { isPrimary: false },
    });
  }

  const image = await prisma.truckImage.create({
    data: {
      truckId: truck.id,
      url: input.url,
      alt: input.alt || null,
      isPrimary: makePrimary,
      sortOrder: truck._count.images,
    },
  });

  await recordAudit({
    action: 'truck.image_added',
    actor: user,
    entity: 'Truck',
    entityId: truck.id,
    summary: `Image added to ${truck.stockNumber}`,
  });

  return ok({ image });
});

/** Reorders images or promotes one to primary. */
export const PATCH = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('SALES');
  if (isResponse(user)) return user;

  const input = await parseJson(
    request,
    z.object({
      truckId: z.string().min(1),
      /** Image ids in their new display order. */
      order: z.array(z.string()).optional(),
      primaryId: z.string().optional(),
      alt: z.object({ id: z.string(), value: z.string().max(160) }).optional(),
    }),
  );

  const truck = await prisma.truck.findUnique({ where: { id: input.truckId }, select: { id: true } });
  if (!truck) return notFound('Vehicle');

  const owned = await prisma.truckImage.findMany({
    where: { truckId: truck.id },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((image) => image.id));

  if (input.order) {
    await prisma.$transaction(
      input.order
        .filter((id) => ownedIds.has(id))
        .map((id, index) =>
          prisma.truckImage.update({ where: { id }, data: { sortOrder: index } }),
        ),
    );
  }

  if (input.primaryId && ownedIds.has(input.primaryId)) {
    await prisma.$transaction([
      prisma.truckImage.updateMany({ where: { truckId: truck.id }, data: { isPrimary: false } }),
      prisma.truckImage.update({ where: { id: input.primaryId }, data: { isPrimary: true } }),
    ]);
  }

  if (input.alt && ownedIds.has(input.alt.id)) {
    await prisma.truckImage.update({
      where: { id: input.alt.id },
      data: { alt: input.alt.value || null },
    });
  }

  const images = await prisma.truckImage.findMany({
    where: { truckId: truck.id },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
  });

  return ok({ images });
});

export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('SALES');
  if (isResponse(user)) return user;

  const { id } = await parseJson(request, z.object({ id: z.string().min(1) }));

  const image = await prisma.truckImage.findUnique({
    where: { id },
    select: { id: true, truckId: true, isPrimary: true },
  });
  if (!image) return notFound('Image');

  await prisma.truckImage.delete({ where: { id } });

  // Promote the next image so a vehicle is never left without a primary.
  if (image.isPrimary) {
    const next = await prisma.truckImage.findFirst({
      where: { truckId: image.truckId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });
    if (next) {
      await prisma.truckImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  }

  await recordAudit({
    action: 'truck.image_deleted',
    actor: user,
    entity: 'Truck',
    entityId: image.truckId,
    summary: 'Image removed',
  });

  return ok({ deleted: true });
});
