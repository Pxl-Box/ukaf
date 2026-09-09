import { prisma } from '@/lib/db';
import { fail, guard, handler, ok, parseJson } from '@/lib/api';
import { resendOtpSchema } from '@/lib/validation';
import { readMfaChallenge } from '@/lib/auth';
import { sendMfaOtpEmail } from '@/lib/email';
import { generateOtpCode, hashToken } from '@/lib/tokens';

const OTP_TTL_MS = 10 * 60 * 1000;

export const POST = handler(async (request: Request) => {
  const input = await parseJson(request, resendOtpSchema);

  const blocked = await guard(request, {
    limit: 'mfaVerify',
    identifier: `mfa-resend:${input.mfaToken}`,
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
    select: { id: true, email: true, firstName: true, status: true },
  });
  if (!user || user.status === 'SUSPENDED' || user.status === 'DELETED') {
    return fail('This sign-in attempt has expired. Please sign in again.', 401, {
      code: 'MFA_CHALLENGE_EXPIRED',
    });
  }

  // Invalidate any still-outstanding codes so only the newest one works.
  await prisma.verificationToken.updateMany({
    where: { userId: user.id, type: 'MFA_LOGIN', usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = generateOtpCode();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      type: 'MFA_LOGIN',
      tokenHash: hashToken(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  await sendMfaOtpEmail(user.email, user.firstName, code);

  return ok({ sent: true });
});
