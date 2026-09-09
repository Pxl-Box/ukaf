import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { currencyFromRow, formatMoney } from '@/lib/money';
import { formatDate, humanise } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '@/lib/orders';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { ReceiptIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Orders & reservations',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AccountOrdersPage() {
  const user = await requireUser('/account/orders');

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      currency: true,
      items: { select: { id: true, name: true, sku: true } },
    },
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Orders & reservations</h1>
        <p className="mt-1 text-sm text-steel-500">
          Every reservation and purchase you have made, with its current status.
        </p>
      </header>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ReceiptIcon />}
          title="No orders yet"
          description="Reserve a vehicle and it will appear here, along with your receipt and progress updates."
          action={
            <Link href="/trucks" className="btn-primary">
              Browse stock
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-steel-900">{order.orderNumber}</p>
                  <p className="mt-0.5 text-xs text-steel-500">
                    {formatDate(order.createdAt)} ·{' '}
                    {order.purchaseType === 'RESERVATION' ? 'Reservation deposit' : 'Full purchase'}
                  </p>
                </div>
                <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
                  {ORDER_STATUS_LABELS[order.status] ?? humanise(order.status)}
                </Badge>
              </div>

              <ul className="mt-4 space-y-1.5 border-t border-steel-100 pt-4 text-sm text-steel-700">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span className="shrink-0 text-xs text-steel-400">{item.sku}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-steel-100 pt-4">
                <p className="text-base font-bold tabular-nums">
                  {formatMoney(order.total, currencyFromRow(order.currency))}
                </p>
                <Link href={`/account/orders/${order.orderNumber}`} className="btn-secondary btn-sm">
                  View details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
