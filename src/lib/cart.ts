import { cookies } from 'next/headers';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { isProduction } from './env';
import { generateToken } from './tokens';
import { getCurrentUser } from './auth';

/**
 * Cart resolution.
 *
 * Signed-in visitors get a cart keyed on their user id. Guests get one keyed
 * on an opaque cookie value, which is merged into their account cart on login.
 */

export const CART_COOKIE = 'ukaf_cart';
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const CART_ITEM_SELECT = {
  id: true,
  quantity: true,
  purchaseType: true,
  createdAt: true,
  truck: {
    select: {
      id: true,
      slug: true,
      title: true,
      stockNumber: true,
      year: true,
      priceNet: true,
      reservationFee: true,
      vatTreatment: true,
      vatRate: true,
      priceOnApplication: true,
      status: true,
      quantity: true,
      make: { select: { name: true } },
      images: {
        select: { url: true, alt: true, isPrimary: true },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        take: 1,
      },
    },
  },
} satisfies Prisma.CartItemSelect;

export type CartWithItems = {
  id: string;
  currency: string;
  items: Array<{
    id: string;
    quantity: number;
    purchaseType: 'RESERVATION' | 'FULL_PURCHASE';
    createdAt: Date;
    truck: {
      id: string;
      slug: string;
      title: string;
      stockNumber: string;
      year: number;
      priceNet: number;
      reservationFee: number;
      vatTreatment: 'PLUS_VAT' | 'VAT_QUALIFYING' | 'MARGIN_SCHEME' | 'NO_VAT';
      vatRate: number;
      priceOnApplication: boolean;
      status: 'DRAFT' | 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'ARCHIVED';
      quantity: number;
      make: { name: string };
      images: Array<{ url: string; alt: string | null; isPrimary: boolean }>;
    };
  }>;
};

async function readAnonId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CART_COOKIE)?.value ?? null;
}

async function writeAnonId(value: string): Promise<void> {
  const cookieStore = await cookies();
  try {
    cookieStore.set(CART_COOKIE, value, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: CART_COOKIE_MAX_AGE,
    });
  } catch {
    // Read-only rendering context.
  }
}

/** Returns the current cart without creating one. */
export async function getCart(): Promise<CartWithItems | null> {
  const user = await getCurrentUser();

  if (user) {
    const cart = await prisma.cart.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, currency: true, items: { select: CART_ITEM_SELECT, orderBy: { createdAt: 'asc' } } },
    });
    return cart as CartWithItems | null;
  }

  const anonId = await readAnonId();
  if (!anonId) return null;

  const cart = await prisma.cart.findUnique({
    where: { anonId },
    select: { id: true, currency: true, items: { select: CART_ITEM_SELECT, orderBy: { createdAt: 'asc' } } },
  });
  return cart as CartWithItems | null;
}

/** Returns the current cart, creating one if needed. */
export async function getOrCreateCart(currency = 'GBP'): Promise<{ id: string; currency: string }> {
  const user = await getCurrentUser();

  if (user) {
    const existing = await prisma.cart.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, currency: true },
    });
    if (existing) return existing;
    return prisma.cart.create({
      data: { userId: user.id, currency },
      select: { id: true, currency: true },
    });
  }

  let anonId = await readAnonId();
  if (anonId) {
    const existing = await prisma.cart.findUnique({
      where: { anonId },
      select: { id: true, currency: true },
    });
    if (existing) return existing;
  }

  anonId = generateToken(18);
  await writeAnonId(anonId);
  return prisma.cart.create({ data: { anonId, currency }, select: { id: true, currency: true } });
}

/**
 * Moves a guest cart onto the user's account after sign-in or registration.
 * Items already in the account cart win on conflict.
 */
export async function mergeGuestCart(userId: string): Promise<void> {
  const anonId = await readAnonId();
  if (!anonId) return;

  const guestCart = await prisma.cart.findUnique({
    where: { anonId },
    select: { id: true, items: { select: { truckId: true, purchaseType: true, quantity: true } } },
  });
  if (!guestCart || guestCart.items.length === 0) {
    await prisma.cart.deleteMany({ where: { anonId } }).catch(() => undefined);
    return;
  }

  const userCart =
    (await prisma.cart.findFirst({ where: { userId }, select: { id: true } })) ??
    (await prisma.cart.create({ data: { userId }, select: { id: true } }));

  for (const item of guestCart.items) {
    await prisma.cartItem
      .create({
        data: {
          cartId: userCart.id,
          truckId: item.truckId,
          purchaseType: item.purchaseType,
          quantity: item.quantity,
        },
      })
      .catch(() => undefined); // Unique constraint: already in the account cart.
  }

  await prisma.cart.delete({ where: { id: guestCart.id } }).catch(() => undefined);

  const cookieStore = await cookies();
  try {
    cookieStore.set(CART_COOKIE, '', { path: '/', maxAge: 0 });
  } catch {
    // Read-only rendering context.
  }
}

export async function getCartCount(): Promise<number> {
  const cart = await getCart();
  return cart?.items.length ?? 0;
}

/**
 * Line total for a cart item in base-currency minor units.
 * A reservation charges the deposit; a full purchase charges the whole price.
 */
export function lineNet(item: CartWithItems['items'][number]): number {
  if (item.purchaseType === 'RESERVATION') return item.truck.reservationFee;
  return item.truck.priceNet * item.quantity;
}

/** Reservation deposits are a payment on account and carry no VAT of their own. */
export function lineVat(item: CartWithItems['items'][number]): number {
  if (item.purchaseType === 'RESERVATION') return 0;
  if (item.truck.vatTreatment === 'MARGIN_SCHEME' || item.truck.vatTreatment === 'NO_VAT') return 0;
  if (item.truck.vatTreatment === 'VAT_QUALIFYING') return 0; // VAT already inside the advertised price
  return Math.round((lineNet(item) * item.truck.vatRate) / 10_000);
}

export type CartTotals = {
  subtotalNet: number;
  vatAmount: number;
  total: number;
  itemCount: number;
  hasUnavailable: boolean;
};

export function cartTotals(cart: CartWithItems | null): CartTotals {
  if (!cart) {
    return { subtotalNet: 0, vatAmount: 0, total: 0, itemCount: 0, hasUnavailable: false };
  }

  let subtotalNet = 0;
  let vatAmount = 0;
  let hasUnavailable = false;

  for (const item of cart.items) {
    if (item.truck.status !== 'AVAILABLE' || item.truck.priceOnApplication) {
      hasUnavailable = true;
      continue;
    }
    subtotalNet += lineNet(item);
    vatAmount += lineVat(item);
  }

  return {
    subtotalNet,
    vatAmount,
    total: subtotalNet + vatAmount,
    itemCount: cart.items.length,
    hasUnavailable,
  };
}
