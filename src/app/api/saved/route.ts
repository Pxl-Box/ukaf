import { z } from 'zod';
import { prisma } from '@/lib/db';
import { guard, handler, isResponse, notFound, ok, parseJson, requireApiUser } from '@/lib/api';

const bodySchema = z.object({ truckId: z.string().min(1) });

/** Adds a vehicle to the signed-in user's saved list. */
export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'api' });
  if (blocked) return blocked;

  const user = await requireApiUser();
  if (isResponse(user)) return user;

  const { truckId } = await parseJson(request, bodySchema);

  const truck = await prisma.truck.findUnique({ where: { id: truckId }, select: { id: true } });
  if (!truck) return notFound('Vehicle');

  await prisma.savedTruck.upsert({
    where: { userId_truckId: { userId: user.id, truckId } },
    create: { userId: user.id, truckId },
    update: {},
  });

  const count = await prisma.savedTruck.count({ where: { userId: user.id } });
  return ok({ saved: true, count });
});

/** Removes a vehicle from the saved list. */
export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'api' });
  if (blocked) return blocked;

  const user = await requireApiUser();
  if (isResponse(user)) return user;

  const { truckId } = await parseJson(request, bodySchema);

  await prisma.savedTruck.deleteMany({ where: { userId: user.id, truckId } });

  const count = await prisma.savedTruck.count({ where: { userId: user.id } });
  return ok({ saved: false, count });
});
