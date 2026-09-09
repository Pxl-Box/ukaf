import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handler } from '@/lib/api';
import { verifySignedValue } from '@/lib/tokens';
import { env } from '@/lib/env';

/**
 * One-click unsubscribe. Accepts GET (link in an email) and POST (RFC 8058
 * List-Unsubscribe-Post, which some clients call automatically).
 */
async function unsubscribe(token: string | null): Promise<boolean> {
  if (!token) return false;
  const email = verifySignedValue(token, 'newsletter-unsubscribe');
  if (!email) return false;

  await prisma.newsletterSubscriber
    .updateMany({
      where: { email },
      data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
    })
    .catch(() => undefined);

  await prisma.user
    .updateMany({ where: { email }, data: { marketingOptIn: false } })
    .catch(() => undefined);

  return true;
}

export const GET = handler(async (request: Request) => {
  const token = new URL(request.url).searchParams.get('token');
  const done = await unsubscribe(token);
  return NextResponse.redirect(
    new URL(`/newsletter?status=${done ? 'unsubscribed' : 'invalid'}`, env.siteUrl),
  );
});

export const POST = handler(async (request: Request) => {
  const token = new URL(request.url).searchParams.get('token');
  const done = await unsubscribe(token);
  return NextResponse.json({ ok: done });
});
