import { guard, handler, ok } from '@/lib/api';
import { destroySession, getCurrentUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';

export const POST = handler(async (request: Request) => {
  const blocked = await guard(request);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  await destroySession();

  if (user) {
    await recordAudit({
      action: 'auth.logout',
      actor: { id: user.id, email: user.email },
      entity: 'User',
      entityId: user.id,
      summary: 'Signed out',
    });
  }

  return ok({ signedOut: true });
});
