import { z } from 'zod';
import { prisma } from '@/lib/db';
import { guard, handler, isResponse, notFound, ok, parseJson, requireApiUser } from '@/lib/api';
import { addressSchema } from '@/lib/validation';

/** Creates an address on the signed-in user's account. */
export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'api' });
  if (blocked) return blocked;

  const user = await requireApiUser();
  if (isResponse(user)) return user;

  const input = await parseJson(request, addressSchema);

  // Only one default per address type.
  if (input.isDefault) {
    await prisma.address.updateMany({
      where: { userId: user.id, type: input.type },
      data: { isDefault: false },
    });
  }

  const existingCount = await prisma.address.count({ where: { userId: user.id, type: input.type } });

  const address = await prisma.address.create({
    data: {
      userId: user.id,
      type: input.type,
      fullName: input.fullName,
      company: input.company || null,
      line1: input.line1,
      line2: input.line2 || null,
      city: input.city,
      county: input.county || null,
      postcode: input.postcode,
      country: input.country,
      phone: input.phone || null,
      isDefault: input.isDefault || existingCount === 0,
    },
  });

  return ok({ address });
});

/** Updates one of the user's own addresses. */
export const PATCH = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'api' });
  if (blocked) return blocked;

  const user = await requireApiUser();
  if (isResponse(user)) return user;

  const input = await parseJson(request, addressSchema.extend({ id: z.string().min(1) }));

  // Scope by userId so an id belonging to someone else cannot be edited.
  const existing = await prisma.address.findFirst({
    where: { id: input.id, userId: user.id },
    select: { id: true },
  });
  if (!existing) return notFound('Address');

  if (input.isDefault) {
    await prisma.address.updateMany({
      where: { userId: user.id, type: input.type },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.update({
    where: { id: existing.id },
    data: {
      type: input.type,
      fullName: input.fullName,
      company: input.company || null,
      line1: input.line1,
      line2: input.line2 || null,
      city: input.city,
      county: input.county || null,
      postcode: input.postcode,
      country: input.country,
      phone: input.phone || null,
      isDefault: Boolean(input.isDefault),
    },
  });

  return ok({ address });
});

export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'api' });
  if (blocked) return blocked;

  const user = await requireApiUser();
  if (isResponse(user)) return user;

  const { id } = await parseJson(request, z.object({ id: z.string().min(1) }));

  const result = await prisma.address.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) return notFound('Address');

  return ok({ deleted: true });
});
