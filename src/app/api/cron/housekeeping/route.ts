import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { purgeExpiredRateLimits } from '@/lib/rate-limit';
import { refreshRatesFromProvider } from '@/lib/currency';
import { env } from '@/lib/env';
import { safeCompare } from '@/lib/tokens';
import { recordAudit } from '@/lib/audit';

/**
 * Scheduled housekeeping.
 *
 * Point a scheduler (Vercel Cron, GitHub Actions, systemd timer) at this
 * endpoint hourly with `Authorization: Bearer $CRON_SECRET`.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(request: Request): boolean {
  if (!env.cronSecret) return false;

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;

  return safeCompare(token, env.cronSecret);
}

export const POST = handler(async (request: Request) => {
  if (!authorised(request)) {
    // Deliberately terse: an unauthenticated caller learns nothing.
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  const results: Record<string, unknown> = {};
  const now = new Date();

  // 1. Expired sessions and used-up tokens.
  const [sessions, tokens, rateLimits] = await Promise.all([
    prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
        ],
      },
    }),
    prisma.verificationToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { usedAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } }],
      },
    }),
    purgeExpiredRateLimits(),
  ]);

  results.sessionsRemoved = sessions.count;
  results.tokensRemoved = tokens.count;
  results.rateLimitsRemoved = rateLimits;

  // 2. Abandoned checkouts. Stripe expires its own sessions after an hour; this
  //    catches orders where the webhook never arrived.
  const abandoned = await prisma.order.updateMany({
    where: {
      status: 'AWAITING_PAYMENT',
      paymentStatus: 'PENDING',
      createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
    data: { status: 'CANCELLED', paymentStatus: 'CANCELLED', internalNotes: 'Automatically cancelled: no payment received within 24 hours.' },
  });
  results.ordersCancelled = abandoned.count;

  // 3. Reservations that have run past their 7-day hold with no progress.
  const staleReservations = await prisma.truck.findMany({
    where: {
      status: 'RESERVED',
      orderItems: {
        some: {
          purchaseType: 'RESERVATION',
          order: {
            paymentStatus: 'SUCCEEDED',
            status: { in: ['PAID'] },
            paidAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
      },
    },
    select: { id: true, stockNumber: true },
  });

  // Flagged rather than released automatically — a lapsed reservation is a
  // conversation with the customer, not a database decision.
  results.reservationsPastHold = staleReservations.map((truck) => truck.stockNumber);

  // 4. Old webhook payloads. The processed flag and audit log remain.
  const webhooks = await prisma.webhookEvent.deleteMany({
    where: { processedAt: { not: null }, createdAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } },
  });
  results.webhookEventsRemoved = webhooks.count;

  // 5. Enquiries past their retention period, per the privacy policy.
  const oldLeads = await prisma.lead.deleteMany({
    where: {
      status: { in: ['LOST'] },
      closedAt: { lt: new Date(now.getTime() - 24 * 30 * 24 * 60 * 60 * 1000) },
    },
  });
  results.leadsPurged = oldLeads.count;

  // 6. Refresh FX rates if a provider is configured.
  if (env.fx.apiUrl) {
    try {
      results.fx = await refreshRatesFromProvider();
    } catch (error) {
      results.fx = { error: error instanceof Error ? error.message : 'FX refresh failed' };
    }
  }

  await recordAudit({
    action: 'settings.updated',
    entity: 'Cron',
    summary: 'Housekeeping job completed',
    metadata: JSON.parse(JSON.stringify(results)),
    ipAddress: null,
    userAgent: 'cron',
  });

  return ok({ ranAt: now.toISOString(), ...results });
});

/** GET mirrors POST so schedulers that only issue GET requests still work. */
export const GET = POST;
