import { prisma } from '@/lib/db';
import { fail, guard, handler, ok, parseJson, clientIp } from '@/lib/api';
import { registerSchema } from '@/lib/validation';
import { hashPassword, validatePasswordStrength } from '@/lib/password';
import { createSession, getRequestContext } from '@/lib/auth';
import { generateToken, hashToken } from '@/lib/tokens';
import { sendVerificationEmail } from '@/lib/email';
import { recordAudit } from '@/lib/audit';
import { mergeGuestCart } from '@/lib/cart';
import { clearRateLimit } from '@/lib/rate-limit';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'register', identifier: clientIp(request) });
  if (blocked) return blocked;

  const input = await parseJson(request, registerSchema);

  // Honeypot — a real browser leaves this empty.
  if (input.website) {
    return fail('Your submission could not be processed.', 400, { code: 'SPAM_REJECTED' });
  }

  const strengthError = validatePasswordStrength(input.password, [
    input.email,
    input.firstName,
    input.lastName,
  ]);
  if (strengthError) {
    return fail(strengthError, 422, { code: 'WEAK_PASSWORD', fieldErrors: { password: [strengthError] } });
  }

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    // Do not confirm which addresses are registered — that is an enumeration
    // oracle. Tell the visitor to check their inbox either way.
    return ok({
      registered: true,
      requiresVerification: true,
      message: 'Check your inbox to finish setting up your account.',
    });
  }

  const passwordHash = await hashPassword(input.password);
  const context = await getRequestContext();

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone || null,
      companyName: input.companyName || null,
      marketingOptIn: input.marketingOptIn,
      // Accounts are usable immediately; email verification unlocks checkout.
      status: 'ACTIVE',
    },
    select: { id: true, email: true, firstName: true },
  });

  const token = generateToken(32);
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      type: 'EMAIL_VERIFICATION',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
    },
  });

  await sendVerificationEmail(user.email, user.firstName, token);

  if (input.marketingOptIn) {
    await prisma.newsletterSubscriber
      .upsert({
        where: { email: user.email },
        create: { email: user.email, status: 'SUBSCRIBED', source: 'registration', confirmedAt: new Date() },
        update: { status: 'SUBSCRIBED', confirmedAt: new Date() },
      })
      .catch(() => undefined);
  }

  await createSession(user.id, context);
  await mergeGuestCart(user.id).catch(() => undefined);
  await clearRateLimit('register', clientIp(request));

  await recordAudit({
    action: 'auth.register',
    actor: { id: user.id, email: user.email },
    entity: 'User',
    entityId: user.id,
    summary: `Account created for ${user.email}`,
  });

  return ok({
    registered: true,
    requiresVerification: true,
    message: 'Account created. Please confirm your email address.',
  });
});
