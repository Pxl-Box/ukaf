import { prisma } from '@/lib/db';
import { fail, guard, handler, ok, parseJson } from '@/lib/api';
import { verifyOtpSchema } from '@/lib/validation';
import { createSession, getRequestContext, readMfaChallenge } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { mergeGuestCart } from '@/lib/cart';
import { clearRateLimit } from '@/lib/rate-limit';
import { hashToken } from '@/lib/tokens';

const GENERIC_FAILURE = 'That code is incorrect or has expired.';

export const POST = handler(async (request: Request) => {
  const input = await parseJson(request, verifyOtpSchema);

  const blocked = await guard(request, {
    limit: 'mfaVerify',
    identifier: `mfa:${input.mfaToken}`,
  });
  if (blocked) return blocked;

  const userId = readMfaChallenge(input.mfaToken);
  if (!userId) {
    return fail('This sign-in attempt has expired. Please sign in again.', 401, {
      code: 'MFA_CHALLENGE_EXPIRED',
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, role: true, status: true, emailVerifiedAt: true },
  });
  if (!user || user.status === 'SUSPENDED' || user.status === 'DELETED') {
    return fail(GENERIC_FAILURE, 401, { code: 'INVALID_CODE' });
  }

  const codeHash = hashToken(input.code);
  const challenge = await prisma.verificationToken.findFirst({
    where: {
      userId: user.id,
      type: 'MFA_LOGIN',
      tokenHash: codeHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!challenge) {
    return fail(GENERIC_FAILURE, 401, { code: 'INVALID_CODE' });
  }

  await prisma.verificationToken.update({
    where: { id: challenge.id },
    data: { usedAt: new Date() },
  });

  const context = await getRequestContext();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: context.ipAddress,
      ...(user.status === 'PENDING' ? { status: 'ACTIVE' as const } : {}),
    },
  });

  await createSession(user.id, context);
  await mergeGuestCart(user.id).catch(() => undefined);
  await clearRateLimit('mfaVerify', `mfa:${input.mfaToken}`);

  await recordAudit({
    action: 'auth.login',
    actor: { id: user.id, email: user.email },
    entity: 'User',
    entityId: user.id,
    summary: 'Signed in (MFA)',
  });

  const isStaff = ['SALES', 'MANAGER', 'ADMIN', 'SUPERADMIN'].includes(user.role);

  return ok({
    signedIn: true,
    redirectTo: isStaff ? '/admin' : '/account',
    emailVerified: Boolean(user.emailVerifiedAt),
    firstName: user.firstName,
  });
});
