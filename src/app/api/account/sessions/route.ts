import { prisma } from '@/lib/db';
import { guard, handler, isResponse, ok, requireApiUser } from '@/lib/api';
import { getSession, revokeAllSessions } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';

/** Lists the user's active sessions so they can spot anything unexpected. */
export const GET = handler(async () => {
  const user = await requireApiUser();
  if (isResponse(user)) return user;

  const current = await getSession();

  const sessions = await prisma.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
    select: { id: true, ipAddress: true, userAgent: true, lastSeenAt: true, createdAt: true },
  });

  return ok({
    sessions: sessions.map((session) => ({
      ...session,
      isCurrent: session.id === current?.sessionId,
    })),
  });
});

/** Signs the user out everywhere except the device they are using now. */
export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'api' });
  if (blocked) return blocked;

  const user = await requireApiUser();
  if (isResponse(user)) return user;

  const current = await getSession();
  const revoked = await revokeAllSessions(user.id, current?.sessionId);

  await recordAudit({
    action: 'auth.sessions_revoked',
    actor: { id: user.id, email: user.email },
    entity: 'User',
    entityId: user.id,
    summary: `Signed out of ${revoked} other ${revoked === 1 ? 'device' : 'devices'}`,
  });

  return ok({ revoked });
});
