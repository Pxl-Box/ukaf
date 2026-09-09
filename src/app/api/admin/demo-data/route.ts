import { prisma } from '@/lib/db';
import { fail, guard, handler, isResponse, ok, requireApiRole } from '@/lib/api';
import { clearDemoData, generateDemoData, getDemoDataStatus } from '@/lib/demo-data';
import { recordAudit } from '@/lib/audit';

/**
 * The "example data" toggle on /admin/settings.
 *
 * ADMIN and above only — this is a bulk, database-wide action, not a routine
 * stock edit, so it sits at the same permission level as site settings.
 */

export const GET = handler(async () => {
  const user = await requireApiRole('ADMIN');
  if (isResponse(user)) return user;

  const status = await getDemoDataStatus(prisma);
  return ok(status);
});

/** Turns example data on: generates it if none exists. Safe to call repeatedly. */
export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('ADMIN');
  if (isResponse(user)) return user;

  try {
    const result = await generateDemoData(prisma, {
      createdById: user.id,
      // Hand new demo enquiries to any active sales rep so the CRM demo has
      // an owner; falls back to the acting admin if none exist yet.
      assignedToId:
        (
          await prisma.user.findFirst({
            where: { role: { in: ['SALES', 'MANAGER'] }, status: 'ACTIVE' },
            select: { id: true },
          })
        )?.id ?? user.id,
    });

    await recordAudit({
      action: 'settings.updated',
      actor: user,
      entity: 'DemoData',
      summary: `Example data switched on (${result.trucksCreated} vehicles, ${result.leadsCreated} enquiries, ${result.testimonialsCreated} testimonials created)`,
    });

    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Could not generate example data.', 400, {
      code: 'DEMO_DATA_GENERATION_FAILED',
    });
  }
});

/** Turns example data off: permanently removes every isDemoData row. */
export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('ADMIN');
  if (isResponse(user)) return user;

  const result = await clearDemoData(prisma);

  await recordAudit({
    action: 'settings.updated',
    actor: user,
    entity: 'DemoData',
    summary: `Example data switched off (${result.trucksDeleted} vehicles, ${result.leadsDeleted} enquiries, ${result.testimonialsDeleted} testimonials removed)`,
    metadata:
      result.trucksKeptWithOrders.length > 0
        ? { trucksKeptWithOrders: result.trucksKeptWithOrders }
        : undefined,
  });

  return ok(result);
});
