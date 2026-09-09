import { prisma } from '@/lib/db';
import { fail, guard, handler, isResponse, ok, parseJson, requireApiUser } from '@/lib/api';
import { changePasswordSchema } from '@/lib/validation';
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/password';
import { getSession, revokeAllSessions } from '@/lib/auth';
import { sendPasswordChangedEmail } from '@/lib/email';
import { recordAudit } from '@/lib/audit';

export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'passwordReset' });
  if (blocked) return blocked;

  const user = await requireApiUser();
  if (isResponse(user)) return user;

  const input = await parseJson(request, changePasswordSchema);

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return fail('Account not found.', 404);

  const valid = await verifyPassword(input.currentPassword, record.passwordHash);
  if (!valid) {
    return fail('Your current password is incorrect.', 400, {
      code: 'INVALID_PASSWORD',
      fieldErrors: { currentPassword: ['Your current password is incorrect.'] },
    });
  }

  const strengthError = validatePasswordStrength(input.password, [
    user.email,
    user.firstName,
    user.lastName,
  ]);
  if (strengthError) {
    return fail(strengthError, 422, { code: 'WEAK_PASSWORD', fieldErrors: { password: [strengthError] } });
  }

  if (await verifyPassword(input.password, record.passwordHash)) {
    return fail('Your new password must be different from your current one.', 422, {
      fieldErrors: { password: ['Choose a password you have not used here before.'] },
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.password), passwordUpdatedAt: new Date() },
  });

  // Keep the current session alive, sign out everywhere else.
  const session = await getSession();
  const revoked = await revokeAllSessions(user.id, session?.sessionId);

  await sendPasswordChangedEmail(user.email, user.firstName).catch(() => undefined);

  await recordAudit({
    action: 'auth.password_changed',
    actor: { id: user.id, email: user.email },
    entity: 'User',
    entityId: user.id,
    summary: `Password changed; ${revoked} other ${revoked === 1 ? 'session' : 'sessions'} revoked`,
  });

  return ok({ changed: true, otherSessionsRevoked: revoked });
});
