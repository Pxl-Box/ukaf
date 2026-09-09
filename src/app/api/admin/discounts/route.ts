import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, guard, handler, isResponse, notFound, ok, parseJson, requireApiRole } from '@/lib/api';
import { discountSchema } from '@/lib/validation';
import { recordAudit } from '@/lib/audit';

function toDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const input = await parseJson(request, discountSchema);

  if (input.type === 'PERCENTAGE' && input.value > 100) {
    return fail('A percentage discount cannot exceed 100%.', 422, {
      fieldErrors: { value: ['Enter a percentage between 1 and 100.'] },
    });
  }

  const existing = await prisma.discount.findUnique({ where: { code: input.code }, select: { id: true } });
  if (existing) {
    return fail('That code already exists.', 409, { fieldErrors: { code: ['That code already exists.'] } });
  }

  const discount = await prisma.discount.create({
    data: {
      code: input.code,
      description: input.description || null,
      type: input.type,
      // Percentages are stored as whole numbers; fixed amounts as minor units.
      value: input.type === 'PERCENTAGE' ? input.value : input.value * 100,
      minSubtotal: input.minSubtotal ?? 0,
      usageLimit: input.usageLimit,
      startsAt: toDate(input.startsAt),
      expiresAt: toDate(input.expiresAt),
      isActive: input.isActive,
    },
  });

  await recordAudit({
    action: 'discount.created',
    actor: user,
    entity: 'Discount',
    entityId: discount.id,
    summary: `Created discount ${discount.code}`,
  });

  return ok({ discount });
});

export const PATCH = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const input = await parseJson(request, discountSchema.extend({ id: z.string().min(1) }));

  const existing = await prisma.discount.findUnique({ where: { id: input.id }, select: { id: true, code: true } });
  if (!existing) return notFound('Discount');

  const discount = await prisma.discount.update({
    where: { id: existing.id },
    data: {
      code: input.code,
      description: input.description || null,
      type: input.type,
      value: input.type === 'PERCENTAGE' ? input.value : input.value * 100,
      minSubtotal: input.minSubtotal ?? 0,
      usageLimit: input.usageLimit,
      startsAt: toDate(input.startsAt),
      expiresAt: toDate(input.expiresAt),
      isActive: input.isActive,
    },
  });

  await recordAudit({
    action: 'discount.updated',
    actor: user,
    entity: 'Discount',
    entityId: discount.id,
    summary: `Updated discount ${discount.code}`,
  });

  return ok({ discount });
});

export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const { id } = await parseJson(request, z.object({ id: z.string().min(1) }));

  const discount = await prisma.discount.findUnique({ where: { id }, select: { code: true, usedCount: true } });
  if (!discount) return notFound('Discount');

  // A used code stays on the books for reconciliation.
  if (discount.usedCount > 0) {
    await prisma.discount.update({ where: { id }, data: { isActive: false } });
    return ok({
      deleted: false,
      deactivated: true,
      message: 'This code has been used, so it was deactivated rather than deleted.',
    });
  }

  await prisma.discount.delete({ where: { id } });

  await recordAudit({
    action: 'discount.updated',
    actor: user,
    entity: 'Discount',
    entityId: id,
    summary: `Deleted discount ${discount.code}`,
  });

  return ok({ deleted: true, deactivated: false });
});
