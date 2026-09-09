import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handler } from '@/lib/api';
import { verifySignedValue } from '@/lib/tokens';
import { env } from '@/lib/env';

/** Confirms a double opt-in subscription from the emailed link. */
export const GET = handler(async (request: Request) => {
  const token = new URL(request.url).searchParams.get('token');
  const redirect = (status: string) =>
    NextResponse.redirect(new URL(`/newsletter?status=${status}`, env.siteUrl));

  if (!token) return redirect('invalid');

  const email = verifySignedValue(token, 'newsletter-confirm');
  if (!email) return redirect('invalid');

  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { email },
    select: { id: true, status: true },
  });
  if (!subscriber) return redirect('invalid');

  if (subscriber.status === 'SUBSCRIBED') return redirect('already');

  await prisma.newsletterSubscriber.update({
    where: { email },
    data: { status: 'SUBSCRIBED', confirmedAt: new Date(), unsubscribedAt: null },
  });

  return redirect('confirmed');
});
