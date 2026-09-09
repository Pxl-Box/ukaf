import { prisma } from '@/lib/db';
import { clientIp, fail, guard, handler, ok, parseJson } from '@/lib/api';
import { loginSchema } from '@/lib/validation';
import { hashPassword, needsRehash, verifyPassword } from '@/lib/password';
import { createMfaChallenge, createSession, getRequestContext } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { mergeGuestCart } from '@/lib/cart';
import { clearRateLimit } from '@/lib/rate-limit';
import { safeRedirectPath } from '@/lib/utils';
import { generateOtpCode, hashToken } from '@/lib/tokens';
import { sendMfaOtpEmail } from '@/lib/email';

const OTP_TTL_MS = 10 * 60 * 1000;

/** Progressive lockout after repeated failures on the same account. */
const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_MINUTES = 15;

/** A generic message for every failure mode, so accounts cannot be enumerated. */
const GENERIC_FAILURE = 'Email address or password is incorrect.';

export const POST = handler(async (request: Request) => {
  const ip = clientIp(request);
  const blocked = await guard(request, { limit: 'login', identifier: ip });
  if (blocked) return blocked;

  const input = await parseJson(request, loginSchema);

  // Rate limit per account as well as per IP — a distributed attack against one
  // account would otherwise slip past the IP bucket.
  const perAccount = await guard(request, {
    csrf: false,
    limit: 'login',
    identifier: `account:${input.email}`,
  });
  if (perAccount) return perAccount;

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      firstName: true,
      passwordHash: true,
      role: true,
      status: true,
      failedLoginCount: true,
      lockedUntil: true,
      emailVerifiedAt: true,
      mfaEnabled: true,
    },
  });

  if (!user) {
    // Spend comparable time on a miss so response timing does not reveal
    // whether the address exists.
    await verifyPassword(input.password, 'scrypt$65536$8$1$00$00');
    return fail(GENERIC_FAILURE, 401, { code: 'INVALID_CREDENTIALS' });
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return fail(
      `Too many failed attempts. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}, or reset your password.`,
      429,
      { code: 'ACCOUNT_LOCKED' },
    );
  }

  const valid = await verifyPassword(input.password, user.passwordHash);

  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    const shouldLock = failedLoginCount >= LOCKOUT_THRESHOLD;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
      },
    });

    await recordAudit({
      action: 'auth.login_failed',
      actor: { id: user.id, email: user.email },
      entity: 'User',
      entityId: user.id,
      summary: `Failed sign-in attempt (${failedLoginCount})`,
      metadata: { locked: shouldLock },
    });

    return fail(GENERIC_FAILURE, 401, { code: 'INVALID_CREDENTIALS' });
  }

  if (user.status === 'SUSPENDED') {
    return fail('This account has been suspended. Please contact us for help.', 403, {
      code: 'ACCOUNT_SUSPENDED',
    });
  }
  if (user.status === 'DELETED') {
    return fail(GENERIC_FAILURE, 401, { code: 'INVALID_CREDENTIALS' });
  }

  const context = await getRequestContext();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: context.ipAddress,
      // A PENDING account becomes ACTIVE on first successful sign-in.
      ...(user.status === 'PENDING' ? { status: 'ACTIVE' as const } : {}),
      // Transparently upgrade hashes when the cost policy is raised.
      ...(needsRehash(user.passwordHash)
        ? { passwordHash: await hashPassword(input.password) }
        : {}),
    },
  });

  await Promise.all([clearRateLimit('login', ip), clearRateLimit('login', `account:${input.email}`)]);

  const isStaff = ['SALES', 'MANAGER', 'ADMIN', 'SUPERADMIN'].includes(user.role);
  const redirectTo = safeRedirectPath(input.next, isStaff ? '/admin' : '/account');

  if (user.mfaEnabled) {
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

    await recordAudit({
      action: 'auth.mfa_challenge',
      actor: { id: user.id, email: user.email },
      entity: 'User',
      entityId: user.id,
      summary: 'Password verified — MFA code sent',
    });

    return ok({
      mfaRequired: true,
      mfaToken: createMfaChallenge(user.id),
      redirectTo,
      maskedEmail: maskEmail(user.email),
    });
  }

  await createSession(user.id, context);
  await mergeGuestCart(user.id).catch(() => undefined);

  await recordAudit({
    action: 'auth.login',
    actor: { id: user.id, email: user.email },
    entity: 'User',
    entityId: user.id,
    summary: 'Signed in',
  });

  return ok({
    signedIn: true,
    redirectTo,
    emailVerified: Boolean(user.emailVerifiedAt),
    firstName: user.firstName,
  });
});

/** obscures a mailbox for display: "da**@example.com" */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}
