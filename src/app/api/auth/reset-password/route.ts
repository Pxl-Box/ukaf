import { prisma } from '@/lib/db';
import { clientIp, fail, guard, handler, ok, parseJson } from '@/lib/api';
import { resetPasswordSchema } from '@/lib/validation';
import { hashPassword, validatePasswordStrength } from '@/lib/password';
import { hashToken } from '@/lib/tokens';
import { createSession, getRequestContext, revokeAllSessions } from '@/lib/auth';
import { sendPasswordChangedEmail } from '@/lib/email';
import { recordAudit } from '@/lib/audit';

export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'passwordReset', identifier: clientIp(request) });
  if (blocked) return blocked;

  const input = await parseJson(request, resetPasswordSchema);

  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
    select: {
      id: true,
      type: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } },
    },
  });

  const invalid = () =>
    fail('This reset link is invalid or has expired. Please request a new one.', 400, {
      code: 'INVALID_TOKEN',
    });

  if (!record) return invalid();
  if (record.type !== 'PASSWORD_RESET' && record.type !== 'STAFF_INVITE') return invalid();
  if (record.usedAt) return invalid();
  if (record.expiresAt.getTime() < Date.now()) return invalid();
  if (record.user.status === 'DELETED' || record.user.status === 'SUSPENDED') return invalid();

  const strengthError = validatePasswordStrength(input.password, [
    record.user.email,
    record.user.firstName,
    record.user.lastName,
  ]);
  if (strengthError) {
    return fail(strengthError, 422, { code: 'WEAK_PASSWORD', fieldErrors: { password: [strengthError] } });
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user.id },
      data: {
        passwordHash,
        passwordUpdatedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
        // An invite link doubles as proof of address ownership.
        ...(record.type === 'STAFF_INVITE'
          ? { status: 'ACTIVE' as const, emailVerifiedAt: new Date() }
          : {}),
      },
    }),
    prisma.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // Anyone who was signed in with the old password is signed out.
  await revokeAllSessions(record.user.id);
  await createSession(record.user.id, await getRequestContext());

  await sendPasswordChangedEmail(record.user.email, record.user.firstName).catch(() => undefined);

  await recordAudit({
    action: 'auth.password_reset_completed',
    actor: { id: record.user.id, email: record.user.email },
    entity: 'User',
    entityId: record.user.id,
    summary: 'Password reset completed; all sessions revoked',
  });

  return ok({ reset: true, redirectTo: '/account' });
});
