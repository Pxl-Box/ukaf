import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, guard, handler, isResponse, notFound, ok, parseJson, requireApiRole } from '@/lib/api';
import { updateOrderSchema } from '@/lib/validation';
import { ORDER_STATUS_LABELS } from '@/lib/orders';
import { getStripe, stripeErrorMessage } from '@/lib/stripe';
import { recordAudit } from '@/lib/audit';

/** Updates an order's status and internal notes. */
export const PATCH = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('SALES');
  if (isResponse(user)) return user;

  const input = await parseJson(request, updateOrderSchema.extend({ id: z.string().min(1) }));

  const existing = await prisma.order.findUnique({
    where: { id: input.id },
    select: { id: true, orderNumber: true, status: true },
  });
  if (!existing) return notFound('Order');

  const order = await prisma.order.update({
    where: { id: existing.id },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.internalNotes !== undefined ? { internalNotes: input.internalNotes || null } : {}),
      ...(input.deliveryNotes !== undefined ? { deliveryNotes: input.deliveryNotes || null } : {}),
    },
    select: { id: true, orderNumber: true, status: true },
  });

  if (input.status && input.status !== existing.status) {
    await prisma.activity.create({
      data: {
        orderId: order.id,
        type: 'STATUS_CHANGE',
        subject: `Order status: ${ORDER_STATUS_LABELS[input.status] ?? input.status}`,
        body: `${existing.status} → ${input.status}`,
        createdById: user.id,
        completedAt: new Date(),
      },
    });

    await recordAudit({
      action: 'order.status_changed',
      actor: user,
      entity: 'Order',
      entityId: order.id,
      summary: `${order.orderNumber}: ${existing.status} → ${input.status}`,
    });
  } else {
    await recordAudit({
      action: 'order.updated',
      actor: user,
      entity: 'Order',
      entityId: order.id,
      summary: `Updated ${order.orderNumber}`,
    });
  }

  return ok({ order });
});

/**
 * Issues a refund through Stripe. The webhook (`charge.refunded`) is what
 * actually updates our records, so this endpoint only initiates it — that way
 * a refund made from the Stripe dashboard behaves identically.
 */
export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const input = await parseJson(
    request,
    z.object({
      id: z.string().min(1),
      action: z.literal('refund'),
      /** Minor units. Omit to refund in full. */
      amount: z.number().int().positive().optional(),
      reason: z.string().max(200).optional(),
    }),
  );

  const order = await prisma.order.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      paymentStatus: true,
      stripePaymentIntentId: true,
    },
  });
  if (!order) return notFound('Order');

  if (order.paymentStatus !== 'SUCCEEDED' && order.paymentStatus !== 'PARTIALLY_REFUNDED') {
    return fail('This order has no completed payment to refund.', 400, { code: 'NOT_REFUNDABLE' });
  }
  if (!order.stripePaymentIntentId) {
    return fail('No Stripe payment is linked to this order. Refund it manually.', 400, {
      code: 'NO_PAYMENT_INTENT',
    });
  }

  const stripe = getStripe();
  if (!stripe) return fail('Stripe is not configured.', 503, { code: 'PAYMENTS_UNAVAILABLE' });

  try {
    const refund = await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      ...(input.amount ? { amount: input.amount } : {}),
      metadata: { orderId: order.id, orderNumber: order.orderNumber, staffId: user.id },
    });

    await recordAudit({
      action: 'order.refunded',
      actor: user,
      entity: 'Order',
      entityId: order.id,
      summary: `Refund initiated for ${order.orderNumber}${input.amount ? ` (${(input.amount / 100).toFixed(2)})` : ' (full)'}`,
      metadata: { refundId: refund.id, reason: input.reason ?? null },
    });

    return ok({
      refundId: refund.id,
      status: refund.status,
      message: 'Refund submitted. The order will update once Stripe confirms it.',
    });
  } catch (error) {
    console.error('[admin] Refund failed:', error);
    return fail(stripeErrorMessage(error), 502, { code: 'STRIPE_ERROR' });
  }
});
