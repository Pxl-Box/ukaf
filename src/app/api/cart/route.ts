import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, guard, handler, notFound, ok, parseJson } from '@/lib/api';
import { addToCartSchema } from '@/lib/validation';
import { cartTotals, getCart, getOrCreateCart } from '@/lib/cart';
import { getDisplayCurrency } from '@/lib/currency';
import { convertFromBase, formatMoney } from '@/lib/money';
import { getSettings } from '@/lib/settings';

/** Current basket contents, converted into the visitor's display currency. */
export const GET = handler(async () => {
  const [cart, currency] = await Promise.all([getCart(), getDisplayCurrency()]);
  const totals = cartTotals(cart);

  return ok({
    itemCount: totals.itemCount,
    subtotal: formatMoney(convertFromBase(totals.subtotalNet, currency), currency),
    total: formatMoney(convertFromBase(totals.total, currency), currency),
    hasUnavailable: totals.hasUnavailable,
    items:
      cart?.items.map((item) => ({
        id: item.id,
        truckId: item.truck.id,
        slug: item.truck.slug,
        title: item.truck.title,
        purchaseType: item.purchaseType,
        status: item.truck.status,
      })) ?? [],
  });
});

/** Adds a vehicle to the basket, as a reservation or an outright purchase. */
export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'api' });
  if (blocked) return blocked;

  const input = await parseJson(request, addToCartSchema);
  const settings = await getSettings();

  if (input.purchaseType === 'FULL_PURCHASE' && !settings.enableFullPurchase) {
    return fail(
      'Vehicles of this value are completed with our sales team rather than online. Please reserve with a deposit or contact us.',
      400,
      { code: 'FULL_PURCHASE_DISABLED' },
    );
  }

  const truck = await prisma.truck.findUnique({
    where: { id: input.truckId },
    select: { id: true, status: true, priceOnApplication: true, title: true, publishedAt: true },
  });

  if (!truck || !truck.publishedAt) return notFound('Vehicle');

  if (truck.status !== 'AVAILABLE') {
    return fail('This vehicle is no longer available.', 409, { code: 'UNAVAILABLE' });
  }
  if (truck.priceOnApplication) {
    return fail('This vehicle is priced on application — please send us an enquiry.', 400, {
      code: 'PRICE_ON_APPLICATION',
    });
  }

  const currency = await getDisplayCurrency();
  const cart = await getOrCreateCart(currency.code);

  await prisma.cartItem.upsert({
    where: { cartId_truckId: { cartId: cart.id, truckId: truck.id } },
    create: { cartId: cart.id, truckId: truck.id, purchaseType: input.purchaseType, quantity: 1 },
    update: { purchaseType: input.purchaseType },
  });

  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });

  const updated = await getCart();
  const totals = cartTotals(updated);

  return ok({
    added: true,
    itemCount: totals.itemCount,
    total: formatMoney(convertFromBase(totals.total, currency), currency),
  });
});

/** Removes a single line, or empties the basket when `all` is set. */
export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'api' });
  if (blocked) return blocked;

  const input = await parseJson(
    request,
    z.object({ itemId: z.string().optional(), all: z.boolean().optional() }),
  );

  const cart = await getCart();
  if (!cart) return ok({ removed: false, itemCount: 0 });

  if (input.all) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return ok({ removed: true, itemCount: 0 });
  }

  if (!input.itemId) return fail('Specify which item to remove.', 400);

  // Scope the delete to this cart so an id from another basket cannot be used.
  await prisma.cartItem.deleteMany({ where: { id: input.itemId, cartId: cart.id } });

  const updated = await getCart();
  return ok({ removed: true, itemCount: updated?.items.length ?? 0 });
});
