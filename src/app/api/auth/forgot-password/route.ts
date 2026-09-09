import { prisma } from '@/lib/db';
import { clientIp, fail, guard, handler, ok, parseJson } from '@/lib/api';
import { forgotPasswordSchema } from '@/lib/validation';
import { generateToken, hashToken } from '@/lib/tokens';
import { sendPasswordResetEmail } from '@/lib/email';
import { recordAudit } from '@/lib/audit';

const RESET_TTL_MS = 60 * 60 * 1000;

/**
 * Always responds with the same success payload whether or not the address is
 * registered — a differing response would let anyone test which emails have
 * accounts here.
 */
export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'passwordReset', identifier: clientIp(request) });
  if (blocked) return blocked;

  const input = await parseJson(request, forgotPasswordSchema);

  if (input.website) {
    return fail('Your submission could not be processed.', 400, { code: 'SPAM_REJECTED' });
  }

  const genericResponse = ok({
    sent: true,
    message: 'If that email address has an account, we have sent a reset link.',
  });

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, firstName: true, status: true },
  });

  if (!user || user.status === 'DELETED' || user.status === 'SUSPENDED') {
    return genericResponse;
  }

  // Invalidate any outstanding reset tokens so only the newest link works.
  await prisma.verificationToken.updateMany({
    where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateToken(32);
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      type: 'PASSWORD_RESET',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });

  await sendPasswordResetEmail(user.email, user.firstName, token);

  await recordAudit({
    action: 'auth.password_reset_requested',
    actor: { id: user.id, email: user.email },
    entity: 'User',
    entityId: user.id,
    summary: 'Password reset requested',
  });

  return genericResponse;
});
