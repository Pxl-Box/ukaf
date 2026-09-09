import { prisma } from '@/lib/db';
import { clientIp, fail, guard, handler, ok, parseJson } from '@/lib/api';
import { checkoutSchema } from '@/lib/validation';
import { cartTotals, getCart } from '@/lib/cart';
import { getDisplayCurrency } from '@/lib/currency';
import { buildOrderDraft, generateOrderNumber } from '@/lib/orders';
import {
  getStripe,
  STRIPE_MAX_CARD_AMOUNT_MINOR,
  STRIPE_MIN_AMOUNT_MINOR,
  stripeErrorMessage,
  toStripeAmount,
} from '@/lib/stripe';
import { getCurrentUser, getRequestContext } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { env } from '@/lib/env';
import { recordAudit } from '@/lib/audit';

/**
 * Creates an order and a Stripe Checkout Session.
 *
 * The order is written first with status AWAITING_PAYMENT so a payment can
 * always be reconciled to a record, even if the customer closes the tab. Stock
 * is not marked reserved until the webhook confirms payment — see
 * `applyStockSideEffects`.
 *
 * Prices are recomputed here from the database. Nothing about the amount comes
 * from the client.
 */
export const POST = handler(async (request: Request) => {
  const ip = clientIp(request);
  const blocked = await guard(request, { limit: 'checkout', identifier: ip });
  if (blocked) return blocked;

  const input = await parseJson(request, checkoutSchema);

  if (input.website) {
    return fail('Your submission could not be processed.', 400, { code: 'SPAM_REJECTED' });
  }

  const [user, settings, currency, cart] = await Promise.all([
    getCurrentUser(),
    getSettings(),
    getDisplayCurrency(),
    getCart(),
  ]);

  if (!user && !settings.enableGuestCheckout) {
    return fail('Please sign in or create an account to complete your purchase.', 401, {
      code: 'LOGIN_REQUIRED',
    });
  }

  if (!cart || cart.items.length === 0) {
    return fail('Your basket is empty.', 400, { code: 'EMPTY_CART' });
  }

  // Re-validate availability at the moment of purchase.
  const totals = cartTotals(cart);
  if (totals.hasUnavailable) {
    return fail(
      'One or more vehicles in your basket are no longer available. Please review your basket.',
      409,
      { code: 'CART_CHANGED' },
    );
  }

  const draft = buildOrderDraft(cart, currency);
  if (draft.lines.length === 0) {
    return fail('There is nothing in your basket that can be paid for online.', 400, {
      code: 'NOTHING_PAYABLE',
    });
  }

  if (draft.total < STRIPE_MIN_AMOUNT_MINOR) {
    return fail('This order is below the minimum amount we can take online.', 400, {
      code: 'AMOUNT_TOO_SMALL',
    });
  }
  if (draft.total > STRIPE_MAX_CARD_AMOUNT_MINOR) {
    return fail(
      'Orders of this value are completed by bank transfer. Our team will contact you to arrange payment.',
      400,
      { code: 'AMOUNT_TOO_LARGE' },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return fail(
      'Online payment is temporarily unavailable. Please contact us and we will complete your order.',
      503,
      { code: 'PAYMENTS_UNAVAILABLE' },
    );
  }

  const context = await getRequestContext();
  const orderNumber = generateOrderNumber();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId: user?.id ?? null,
      guestEmail: user ? null : input.email,
      status: 'AWAITING_PAYMENT',
      purchaseType: input.purchaseType,
      currencyCode: currency.code,
      fxRate: currency.rateToBase,
      subtotalNet: draft.subtotalNet,
      vatAmount: draft.vatAmount,
      total: draft.total,
      baseTotal: draft.baseTotal,
      billingName: `${input.firstName} ${input.lastName}`,
      billingCompany: input.company || null,
      billingEmail: input.email,
      billingPhone: input.phone,
      billingLine1: input.billingLine1,
      billingLine2: input.billingLine2 || null,
      billingCity: input.billingCity,
      billingPostcode: input.billingPostcode,
      billingCountry: input.billingCountry,
      deliveryRequired: input.deliveryRequired,
      deliveryLine1: input.deliveryLine1 || null,
      deliveryCity: input.deliveryCity || null,
      deliveryPostcode: input.deliveryPostcode || null,
      deliveryCountry: input.deliveryCountry || null,
      deliveryNotes: input.deliveryNotes || null,
      customerNotes: input.customerNotes || null,
      ipAddress: context.ipAddress,
      termsAcceptedAt: new Date(),
      items: {
        create: draft.lines.map((line) => ({
          truckId: line.truckId,
          sku: line.sku,
          name: line.name,
          description: line.description,
          purchaseType: line.purchaseType,
          quantity: line.quantity,
          unitPriceNet: line.unitPriceNet,
          vatRate: line.vatRate,
          vatAmount: line.vatAmount,
          totalNet: line.totalNet,
          totalGross: line.totalGross,
          snapshot: line.snapshot,
        })),
      },
    },
    select: { id: true, orderNumber: true, items: { select: { id: true, name: true, totalGross: true } } },
  });

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        // Guests may not have an account; Stripe collects/records the email.
        customer_email: input.email,
        client_reference_id: order.id,
        line_items: draft.lines.map((line) => ({
          quantity: line.quantity,
          price_data: {
            currency: currency.code.toLowerCase(),
            unit_amount: toStripeAmount(
              Math.round(line.totalGross / line.quantity),
              currency.code,
              currency.decimals,
            ),
            product_data: {
              name: line.name,
              description: line.description ?? undefined,
              metadata: { sku: line.sku },
            },
          },
        })),
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          purchaseType: input.purchaseType,
          userId: user?.id ?? '',
        },
        payment_intent_data: {
          description: `${order.orderNumber} — ${env.company.name}`,
          metadata: { orderId: order.id, orderNumber: order.orderNumber },
        },
        success_url: `${env.siteUrl}/checkout/success?order=${order.orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.siteUrl}/checkout?cancelled=1`,
        // Expire the hold reasonably quickly so stock is not held indefinitely.
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
        billing_address_collection: 'required',
        allow_promotion_codes: false,
      },
      // Guards against a double-submitted form creating two payments.
      { idempotencyKey: `checkout:${order.id}` },
    );

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    await recordAudit({
      action: 'order.created',
      actor: user ? { id: user.id, email: user.email } : null,
      entity: 'Order',
      entityId: order.id,
      summary: `Checkout started for ${order.orderNumber}`,
      metadata: { total: draft.total, currency: currency.code, items: draft.lines.length },
    });

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL.');
    }

    return ok({ orderNumber: order.orderNumber, checkoutUrl: session.url });
  } catch (error) {
    console.error('[checkout] Stripe session creation failed:', error);

    await prisma.order
      .update({
        where: { id: order.id },
        data: { status: 'CANCELLED', internalNotes: 'Stripe session could not be created.' },
      })
      .catch(() => undefined);

    return fail(stripeErrorMessage(error), 502, { code: 'STRIPE_ERROR' });
  }
});
