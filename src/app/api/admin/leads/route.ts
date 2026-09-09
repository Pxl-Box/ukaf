import { z } from 'zod';
import { prisma } from '@/lib/db';
import { guard, handler, isResponse, notFound, ok, parseJson, requireApiRole } from '@/lib/api';
import { updateLeadSchema } from '@/lib/validation';
import { LEAD_STATUS_LABELS } from '@/lib/leads';
import { recordAudit } from '@/lib/audit';

function toDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Updates a lead's status, owner, value or next action. */
export const PATCH = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('SALES');
  if (isResponse(user)) return user;

  const input = await parseJson(request, updateLeadSchema.extend({ id: z.string().min(1) }));

  const existing = await prisma.lead.findUnique({
    where: { id: input.id },
    select: { id: true, ref: true, status: true, assignedToId: true },
  });
  if (!existing) return notFound('Enquiry');

  // Only staff may own a lead.
  let assignedToId: string | null | undefined;
  if (input.assignedToId !== undefined) {
    if (input.assignedToId === '') {
      assignedToId = null;
    } else {
      const assignee = await prisma.user.findFirst({
        where: {
          id: input.assignedToId,
          role: { in: ['SALES', 'MANAGER', 'ADMIN', 'SUPERADMIN'] },
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      assignedToId = assignee?.id ?? null;
    }
  }

  const isClosing = input.status === 'WON' || input.status === 'LOST';

  const lead = await prisma.lead.update({
    where: { id: existing.id },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(assignedToId !== undefined ? { assignedToId } : {}),
      ...(input.estimatedValue !== undefined ? { estimatedValue: input.estimatedValue } : {}),
      ...(input.score !== undefined && input.score !== null ? { score: input.score } : {}),
      ...(input.nextActionAt !== undefined ? { nextActionAt: toDate(input.nextActionAt) } : {}),
      ...(input.lostReason !== undefined ? { lostReason: input.lostReason || null } : {}),
      ...(input.status && input.status !== 'NEW' && !existing.status.startsWith('CONT')
        ? { contactedAt: new Date() }
        : {}),
      ...(isClosing ? { closedAt: new Date() } : {}),
    },
    select: { id: true, ref: true, status: true, assignedToId: true },
  });

  // Status changes are recorded on the timeline so the history is legible.
  if (input.status && input.status !== existing.status) {
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: 'STATUS_CHANGE',
        subject: `Status changed to ${LEAD_STATUS_LABELS[input.status]}`,
        body: `${LEAD_STATUS_LABELS[existing.status]} → ${LEAD_STATUS_LABELS[input.status]}`,
        createdById: user.id,
      },
    });

    await recordAudit({
      action: 'lead.status_changed',
      actor: user,
      entity: 'Lead',
      entityId: lead.id,
      summary: `${lead.ref}: ${existing.status} → ${input.status}`,
    });
  }

  if (assignedToId !== undefined && assignedToId !== existing.assignedToId) {
    await recordAudit({
      action: 'lead.assigned',
      actor: user,
      entity: 'Lead',
      entityId: lead.id,
      summary: `${lead.ref} reassigned`,
      metadata: { from: existing.assignedToId, to: assignedToId },
    });
  }

  return ok({ lead });
});

export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const { id } = await parseJson(request, z.object({ id: z.string().min(1) }));

  const lead = await prisma.lead.findUnique({ where: { id }, select: { ref: true } });
  if (!lead) return notFound('Enquiry');

  await prisma.lead.delete({ where: { id } });

  await recordAudit({
    action: 'lead.deleted',
    actor: user,
    entity: 'Lead',
    entityId: id,
    summary: `Deleted enquiry ${lead.ref}`,
  });

  return ok({ deleted: true });
});
