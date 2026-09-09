import type Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { env } from '@/lib/env';
import { applyStockSideEffects } from '@/lib/orders';
import { sendOrderConfirmationEmail, sendInternalOrderNotification } from '@/lib/email';
import { currencyFromRow, formatMoney } from '@/lib/money';
import { recordAudit } from '@/lib/audit';

/**
 * Stripe webhook.
 *
 * Three rules govern this handler:
 *   1. Verify the signature against the raw body before trusting anything.
 *   2. Be idempotent — Stripe retries, and events can arrive out of order.
 *   3. Always return 2xx once the event is stored, so Stripe stops retrying an
 *      event we have already accepted; internal failures are recorded on the
 *      WebhookEvent row for replay instead.
 */

export const runtime = 'nodejs';
// The raw body must not be parsed or cached.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !env.stripe.webhookSecret) {
    console.error('[stripe] Webhook received but Stripe is not configured.');
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
  } catch (error) {
    console.error('[stripe] Signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  // Idempotency: if we have seen this event id before, acknowledge and stop.
  const existing = await prisma.webhookEvent.findUnique({
    where: { eventId: event.id },
    select: { id: true, processedAt: true },
  });

  if (existing?.processedAt) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const record =
    existing ??
    (await prisma.webhookEvent.create({
      data: {
        eventId: event.id,
        type: event.type,
        payload: event as unknown as object,
      },
      select: { id: true, processedAt: true },
    }));

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'checkout.session.expired':
        await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleRefund(event.data.object as Stripe.Charge);
        break;

      default:
        // Unhandled types are stored for audit and acknowledged.
        break;
    }

    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { processedAt: new Date(), error: null },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook error';
    console.error(`[stripe] Failed to process ${event.type} (${event.id}):`, error);

    await prisma.webhookEvent
      .update({ where: { id: record.id }, data: { error: message } })
      .catch(() => undefined);

    // 500 asks Stripe to retry — the event row is kept so we can replay too.
    return NextResponse.json({ error: 'Processing failed.' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) {
    console.warn('[stripe] checkout.session.completed without an orderId.');
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { select: { name: true, totalGross: true, sku: true } },
      currency: true,
    },
  });

  if (!order) {
    console.warn(`[stripe] No order found for id ${orderId}.`);
    return;
  }

  // Already reconciled — a retry or an out-of-order duplicate.
  if (order.paymentStatus === 'SUCCEEDED') return;

  const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
  if (!paid) return;

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
      },
    });

    await tx.payment.create({
      data: {
        orderId: order.id,
        provider: 'stripe',
        providerRef: paymentIntentId ?? session.id,
        amount: session.amount_total ?? order.total,
        currencyCode: (session.currency ?? order.currencyCode).toUpperCase(),
        status: 'SUCCEEDED',
        method: session.payment_method_types?.[0] ?? 'card',
        rawEvent: session as unknown as object,
      },
    });

    await applyStockSideEffects(tx, order.id);

    // The purchased vehicles leave the buyer's basket.
    if (order.userId) {
      const carts = await tx.cart.findMany({ where: { userId: order.userId }, select: { id: true } });
      if (carts.length > 0) {
        await tx.cartItem.deleteMany({ where: { cartId: { in: carts.map((cart) => cart.id) } } });
      }
    }
  });

  const currencyInfo = currencyFromRow(order.currency);

  const totalFormatted = formatMoney(order.total, currencyInfo);

  await Promise.allSettled([
    sendOrderConfirmationEmail(order.billingEmail, {
      orderNumber: order.orderNumber,
      customerName: order.billingName ?? 'there',
      purchaseType: order.purchaseType,
      totalFormatted,
      items: order.items.map((item) => ({
        name: item.name,
        stockNumber: item.sku,
        priceFormatted: formatMoney(item.totalGross, currencyInfo),
      })),
    }),
    sendInternalOrderNotification({
      orderNumber: order.orderNumber,
      customerName: order.billingName ?? order.billingEmail,
      email: order.billingEmail,
      totalFormatted,
      purchaseType: order.purchaseType,
      items: order.items.map((item) => item.sku),
    }),
  ]);

  await recordAudit({
    action: 'payment.succeeded',
    entity: 'Order',
    entityId: order.id,
    summary: `${order.orderNumber} paid — ${totalFormatted}`,
    metadata: { paymentIntentId, sessionId: session.id },
    ipAddress: null,
    userAgent: 'stripe-webhook',
  });
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) return;

  await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: { in: ['PENDING', 'PROCESSING'] } },
    data: {
      status: 'CANCELLED',
      paymentStatus: 'CANCELLED',
      internalNotes: 'Stripe checkout session expired before payment.',
    },
  });
}

async function handlePaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
  const orderId = intent.metadata?.orderId;
  if (!orderId) return;

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true } });
  if (!order) return;

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'FAILED', status: 'AWAITING_PAYMENT' },
    }),
    prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'stripe',
        providerRef: intent.id,
        amount: intent.amount,
        currencyCode: intent.currency.toUpperCase(),
        status: 'FAILED',
        failureCode: intent.last_payment_error?.code ?? null,
        failureMessage: intent.last_payment_error?.message ?? null,
        rawEvent: intent as unknown as object,
      },
    }),
  ]);

  await recordAudit({
    action: 'payment.failed',
    entity: 'Order',
    entityId: order.id,
    summary: `Payment failed for ${order.orderNumber}`,
    metadata: { code: intent.last_payment_error?.code ?? null },
    ipAddress: null,
    userAgent: 'stripe-webhook',
  });
}

async function handleRefund(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
  if (!paymentIntentId) return;

  const order = await prisma.order.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, orderNumber: true, total: true, items: { select: { truckId: true, purchaseType: true } } },
  });
  if (!order) return;

  const refunded = charge.amount_refunded ?? 0;
  const fullyRefunded = refunded >= (charge.amount ?? order.total);

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: fullyRefunded ? 'REFUNDED' : 'PAID',
        paymentStatus: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      },
    });

    await tx.payment.updateMany({
      where: { orderId: order.id, providerRef: paymentIntentId },
      data: {
        refundedAmount: refunded,
        status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      },
    });

    // A fully refunded reservation puts the vehicle back on sale.
    if (fullyRefunded) {
      for (const item of order.items) {
        if (!item.truckId || item.purchaseType !== 'RESERVATION') continue;
        await tx.truck.updateMany({
          where: { id: item.truckId, status: 'RESERVED' },
          data: { status: 'AVAILABLE' },
        });
      }
    }
  });

  await recordAudit({
    action: 'order.refunded',
    entity: 'Order',
    entityId: order.id,
    summary: `${order.orderNumber} refunded (${fullyRefunded ? 'full' : 'partial'})`,
    metadata: { refunded },
    ipAddress: null,
    userAgent: 'stripe-webhook',
  });
}
