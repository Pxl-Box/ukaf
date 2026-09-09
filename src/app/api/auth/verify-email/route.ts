import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { clientIp, guard, handler, isResponse, ok, requireApiUser } from '@/lib/api';
import { hashToken, generateToken } from '@/lib/tokens';
import { env } from '@/lib/env';
import { recordAudit } from '@/lib/audit';
import { sendVerificationEmail } from '@/lib/email';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/** Follows the link from the verification email, then redirects with a status. */
export const GET = handler(async (request: Request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const redirect = (status: string) =>
    NextResponse.redirect(new URL(`/verify-email?status=${status}`, env.siteUrl));

  if (!token) return redirect('invalid');

  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      type: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { id: true, email: true, emailVerifiedAt: true } },
    },
  });

  if (!record || record.type !== 'EMAIL_VERIFICATION') return redirect('invalid');
  if (record.user.emailVerifiedAt) return redirect('already');
  if (record.usedAt) return redirect('invalid');
  if (record.expiresAt.getTime() < Date.now()) return redirect('expired');

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user.id },
      data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
    }),
    prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  await recordAudit({
    action: 'auth.email_verified',
    actor: { id: record.user.id, email: record.user.email },
    entity: 'User',
    entityId: record.user.id,
    summary: 'Email address verified',
  });

  return redirect('verified');
});

/** Re-sends the verification email to the signed-in user. */
export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'passwordReset', identifier: clientIp(request) });
  if (blocked) return blocked;

  const user = await requireApiUser();
  if (isResponse(user)) return user;

  if (user.emailVerifiedAt) {
    return ok({ sent: false, alreadyVerified: true });
  }

  await prisma.verificationToken.updateMany({
    where: { userId: user.id, type: 'EMAIL_VERIFICATION', usedAt: null },
    data: { usedAt: new Date() },
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

  return ok({ sent: true });
});
