import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, guard, handler, isResponse, notFound, ok, parseJson, requireApiRole } from '@/lib/api';
import { activitySchema } from '@/lib/validation';

function toDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Adds a note, call log or task to a lead or order timeline. */
export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('SALES');
  if (isResponse(user)) return user;

  const input = await parseJson(request, activitySchema);

  if (!input.leadId && !input.orderId) {
    return fail('An activity must be attached to an enquiry or an order.', 400);
  }

  if (input.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true } });
    if (!lead) return notFound('Enquiry');
  }
  if (input.orderId) {
    const order = await prisma.order.findUnique({ where: { id: input.orderId }, select: { id: true } });
    if (!order) return notFound('Order');
  }

  const dueAt = toDate(input.dueAt);

  const activity = await prisma.activity.create({
    data: {
      leadId: input.leadId || null,
      orderId: input.orderId || null,
      type: input.type,
      subject: input.subject || null,
      body: input.body,
      dueAt,
      // A task is outstanding until completed; a note is complete on creation.
      completedAt: input.type === 'TASK' ? null : new Date(),
      createdById: user.id,
    },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  // Logging contact moves an untouched lead along and schedules the next step.
  if (input.leadId && ['CALL', 'EMAIL', 'MEETING'].includes(input.type)) {
    await prisma.lead.updateMany({
      where: { id: input.leadId, status: 'NEW' },
      data: { status: 'CONTACTED', contactedAt: new Date() },
    });
    if (dueAt) {
      await prisma.lead.update({ where: { id: input.leadId }, data: { nextActionAt: dueAt } });
    }
  }

  return ok({ activity });
});

/** Marks a task complete, or reopens it. */
export const PATCH = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('SALES');
  if (isResponse(user)) return user;

  const input = await parseJson(
    request,
    z.object({ id: z.string().min(1), completed: z.boolean() }),
  );

  const existing = await prisma.activity.findUnique({ where: { id: input.id }, select: { id: true } });
  if (!existing) return notFound('Activity');

  const activity = await prisma.activity.update({
    where: { id: input.id },
    data: { completedAt: input.completed ? new Date() : null },
    select: { id: true, completedAt: true },
  });

  return ok({ activity });
});

export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const { id } = await parseJson(request, z.object({ id: z.string().min(1) }));

  const result = await prisma.activity.deleteMany({ where: { id } });
  if (result.count === 0) return notFound('Activity');

  return ok({ deleted: true });
});
