import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { generateReference } from './tokens';
import { convertFromBase, type CurrencyInfo } from './money';
import type { CartWithItems } from './cart';
import { lineNet, lineVat } from './cart';

/**
 * Order construction.
 *
 * Prices are held in base currency on the catalogue, but an order must record
 * exactly what the customer agreed to pay, in the currency they saw. Each
 * order therefore stores its presentment currency, the FX rate used, and the
 * base-currency equivalent for reporting.
 */

export type OrderDraftLine = {
  truckId: string;
  sku: string;
  name: string;
  description: string | null;
  purchaseType: 'RESERVATION' | 'FULL_PURCHASE';
  quantity: number;
  unitPriceNet: number;
  vatRate: number;
  vatAmount: number;
  totalNet: number;
  totalGross: number;
  snapshot: Prisma.InputJsonValue;
};

export type OrderDraft = {
  lines: OrderDraftLine[];
  subtotalNet: number;
  vatAmount: number;
  total: number;
  baseTotal: number;
  currency: CurrencyInfo;
};

/**
 * Converts a cart into presentment-currency line items.
 * Unavailable or POA vehicles are dropped — they cannot be bought online.
 */
export function buildOrderDraft(cart: CartWithItems, currency: CurrencyInfo): OrderDraft {
  const lines: OrderDraftLine[] = [];
  let subtotalNet = 0;
  let vatAmount = 0;
  let baseTotal = 0;

  for (const item of cart.items) {
    if (item.truck.status !== 'AVAILABLE' || item.truck.priceOnApplication) continue;

    const baseNet = lineNet(item);
    const baseVat = lineVat(item);

    const net = convertFromBase(baseNet, currency);
    const vat = convertFromBase(baseVat, currency);
    const isReservation = item.purchaseType === 'RESERVATION';

    lines.push({
      truckId: item.truck.id,
      sku: item.truck.stockNumber,
      name: isReservation ? `Reservation deposit — ${item.truck.title}` : item.truck.title,
      description: isReservation
        ? 'Refundable reservation deposit, deducted from the final balance.'
        : `${item.truck.year} ${item.truck.make.name}`,
      purchaseType: item.purchaseType,
      quantity: isReservation ? 1 : item.quantity,
      unitPriceNet: net,
      vatRate: isReservation ? 0 : item.truck.vatRate,
      vatAmount: vat,
      totalNet: net,
      totalGross: net + vat,
      snapshot: {
        truckId: item.truck.id,
        slug: item.truck.slug,
        title: item.truck.title,
        stockNumber: item.truck.stockNumber,
        year: item.truck.year,
        make: item.truck.make.name,
        basePriceNet: item.truck.priceNet,
        baseReservationFee: item.truck.reservationFee,
        vatTreatment: item.truck.vatTreatment,
        capturedAt: new Date().toISOString(),
      },
    });

    subtotalNet += net;
    vatAmount += vat;
    baseTotal += baseNet + baseVat;
  }

  return {
    lines,
    subtotalNet,
    vatAmount,
    total: subtotalNet + vatAmount,
    baseTotal,
    currency,
  };
}

export function generateOrderNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  return generateReference(`UK${year}`, 6);
}

export const ORDER_DETAIL_INCLUDE = {
  items: { include: { truck: { select: { slug: true, title: true, stockNumber: true } } } },
  payments: { orderBy: { createdAt: 'desc' as const } },
  user: { select: { id: true, email: true, firstName: true, lastName: true, companyName: true, phone: true } },
  currency: true,
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  AWAITING_PAYMENT: 'Awaiting payment',
  PAID: 'Paid',
  IN_PREPARATION: 'In preparation',
  READY_FOR_COLLECTION: 'Ready for collection',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

export const ORDER_STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'neutral',
  AWAITING_PAYMENT: 'warning',
  PAID: 'success',
  IN_PREPARATION: 'info',
  READY_FOR_COLLECTION: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  REFUNDED: 'danger',
};

/**
 * Marks stock as reserved or sold once payment succeeds, and closes any open
 * cart holding it. Runs inside the webhook transaction.
 */
export async function applyStockSideEffects(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { items: { select: { truckId: true, purchaseType: true } } },
  });
  if (!order) return;

  for (const item of order.items) {
    if (!item.truckId) continue;

    if (item.purchaseType === 'RESERVATION') {
      await tx.truck.updateMany({
        where: { id: item.truckId, status: 'AVAILABLE' },
        data: { status: 'RESERVED' },
      });
    } else {
      await tx.truck.updateMany({
        where: { id: item.truckId, status: { in: ['AVAILABLE', 'RESERVED'] } },
        data: { status: 'SOLD', soldAt: new Date() },
      });
    }

    // Remove the vehicle from every other cart so it cannot be double-sold.
    await tx.cartItem.deleteMany({ where: { truckId: item.truckId } });
  }
}

/** Aggregate figures for the admin dashboard. */
export async function getSalesSummary(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [paidAgg, orderCount, pendingCount, recentOrders] = await Promise.all([
    prisma.order.aggregate({
      where: { paymentStatus: 'SUCCEEDED', createdAt: { gte: since } },
      _sum: { baseTotal: true },
      _count: { _all: true },
    }),
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.order.count({ where: { status: { in: ['PENDING', 'AWAITING_PAYMENT'] } } }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        currencyCode: true,
        billingEmail: true,
        billingName: true,
        createdAt: true,
        purchaseType: true,
      },
    }),
  ]);

  return {
    revenueBase: paidAgg._sum.baseTotal ?? 0,
    paidOrders: paidAgg._count._all,
    orderCount,
    pendingCount,
    recentOrders,
  };
}
