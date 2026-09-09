import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getBaseCurrency } from '@/lib/currency';
import { currencyFromRow, formatMoney } from '@/lib/money';
import { formatDate, humanise } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '@/lib/orders';
import { Badge, Stat } from '@/components/ui/primitives';
import { AdminCard, AdminHeader, EmptyRow, TableWrap, Td, Th } from '@/components/admin/shell';
import { Pagination } from '@/components/ui/Pagination';

export const metadata: Metadata = {
  title: 'Orders',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

const STATUSES = [
  'PENDING',
  'AWAITING_PAYMENT',
  'PAID',
  'IN_PREPARATION',
  'READY_FOR_COLLECTION',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();
  const params = await searchParams;

  const single = (key: string) => {
    const value = params[key];
    return typeof value === 'string' && value ? value : undefined;
  };

  const page = Math.max(1, Number(single('page') ?? '1') || 1);
  const status = single('status');
  const q = single('q');

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status: status as Prisma.EnumOrderStatusFilter['equals'] } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: 'insensitive' } },
            { billingEmail: { contains: q, mode: 'insensitive' } },
            { billingName: { contains: q, mode: 'insensitive' } },
            { billingCompany: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, orders, base, revenue, counts] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        currency: true,
        items: { select: { id: true, name: true, sku: true } },
        user: { select: { id: true } },
      },
    }),
    getBaseCurrency(),
    prisma.order.aggregate({
      where: { paymentStatus: 'SUCCEEDED' },
      _sum: { baseTotal: true },
      _count: { _all: true },
    }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const byStatus = Object.fromEntries(counts.map((entry) => [entry.status, entry._count._all]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <AdminHeader title="Orders" description={`${total} matching ${total === 1 ? 'order' : 'orders'}`} />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Lifetime revenue"
          value={formatMoney(revenue._sum.baseTotal ?? 0, base, { compact: true })}
          hint={`${revenue._count._all} paid orders`}
          tone="success"
        />
        <Stat label="Awaiting payment" value={byStatus.AWAITING_PAYMENT ?? 0} tone="warning" />
        <Stat
          label="In progress"
          value={(byStatus.PAID ?? 0) + (byStatus.IN_PREPARATION ?? 0) + (byStatus.READY_FOR_COLLECTION ?? 0)}
          tone="info"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((entry) => (
          <Link
            key={entry}
            href={status === entry ? '/admin/orders' : `/admin/orders?status=${entry}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              status === entry
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-steel-200 bg-white text-steel-600 hover:bg-steel-50'
            }`}
          >
            {ORDER_STATUS_LABELS[entry]}{' '}
            <span className="tabular-nums text-steel-400">{byStatus[entry] ?? 0}</span>
          </Link>
        ))}
      </div>

      <AdminCard padded={false}>
        <TableWrap>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Vehicles</Th>
              <Th>Type</Th>
              <Th align="right">Total</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <EmptyRow colSpan={7} message="No orders match those filters." />
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-steel-50">
                  <Td>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    <span className="block text-xs text-steel-400">{formatDate(order.createdAt)}</span>
                  </Td>
                  <Td>
                    <span className="block truncate">{order.billingName ?? '—'}</span>
                    <span className="block truncate text-xs text-steel-400">
                      {order.billingEmail}
                      {!order.user ? ' (guest)' : ''}
                    </span>
                  </Td>
                  <Td className="max-w-64">
                    <span className="block truncate text-xs">
                      {order.items.map((item) => item.sku).join(', ')}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {order.purchaseType === 'RESERVATION' ? 'Reservation' : 'Full purchase'}
                  </Td>
                  <Td align="right" className="whitespace-nowrap tabular-nums">
                    {formatMoney(order.total, currencyFromRow(order.currency))}
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        order.paymentStatus === 'SUCCEEDED'
                          ? 'success'
                          : order.paymentStatus === 'FAILED'
                            ? 'danger'
                            : order.paymentStatus === 'REFUNDED' || order.paymentStatus === 'PARTIALLY_REFUNDED'
                              ? 'warning'
                              : 'neutral'
                      }
                    >
                      {humanise(order.paymentStatus)}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
                      {ORDER_STATUS_LABELS[order.status] ?? humanise(order.status)}
                    </Badge>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      </AdminCard>

      <Pagination
        page={page}
        pages={pages}
        total={total}
        limit={PAGE_SIZE}
        searchParams={params}
        basePath="/admin/orders"
      />
    </div>
  );
}
