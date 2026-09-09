import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { hasRole, requireStaff } from '@/lib/auth';
import { currencyFromRow, formatMoney } from '@/lib/money';
import { formatDateTime, humanise } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '@/lib/orders';
import { Badge, DataRow } from '@/components/ui/primitives';
import { AdminCard, AdminHeader } from '@/components/admin/shell';
import { OrderControls } from './OrderControls';

export const metadata: Metadata = {
  title: 'Order',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff();

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      currency: true,
      items: { include: { truck: { select: { id: true, slug: true, title: true } } } },
      payments: { orderBy: { createdAt: 'desc' } },
      user: { select: { id: true, email: true, firstName: true, lastName: true, companyName: true } },
      activities: {
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  if (!order) notFound();

  const currency = currencyFromRow(order.currency);
  const money = (amount: number) => formatMoney(amount, currency);

  const refundable =
    (order.paymentStatus === 'SUCCEEDED' || order.paymentStatus === 'PARTIALLY_REFUNDED') &&
    Boolean(order.stripePaymentIntentId) &&
    hasRole(user, 'MANAGER');

  return (
    <div>
      <AdminHeader
        title={order.orderNumber}
        description={`Placed ${formatDateTime(order.createdAt)} · ${
          order.purchaseType === 'RESERVATION' ? 'Reservation deposit' : 'Full purchase'
        }`}
        breadcrumb={{ label: 'Back to orders', href: '/admin/orders' }}
        action={
          <div className="flex items-center gap-2">
            <Badge
              tone={
                order.paymentStatus === 'SUCCEEDED'
                  ? 'success'
                  : order.paymentStatus === 'FAILED'
                    ? 'danger'
                    : 'neutral'
              }
            >
              {humanise(order.paymentStatus)}
            </Badge>
            <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
              {ORDER_STATUS_LABELS[order.status] ?? humanise(order.status)}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <AdminCard title="Items" padded={false}>
            <ul className="divide-y divide-steel-100">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-steel-900">
                      {item.truck ? (
                        <Link href={`/admin/trucks/${item.truck.id}`} className="hover:text-brand-700">
                          {item.name}
                        </Link>
                      ) : (
                        item.name
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-steel-500">
                      Stock {item.sku} ·{' '}
                      {item.purchaseType === 'RESERVATION' ? 'Reservation deposit' : 'Full purchase'}
                      {item.vatAmount > 0 ? ` · VAT ${money(item.vatAmount)}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums">{money(item.totalGross)}</p>
                </li>
              ))}
            </ul>

            <dl className="border-t border-steel-200 px-5 py-3">
              <DataRow label="Subtotal" value={money(order.subtotalNet)} />
              {order.vatAmount > 0 ? <DataRow label="VAT" value={money(order.vatAmount)} /> : null}
              {order.deliveryFee > 0 ? <DataRow label="Delivery" value={money(order.deliveryFee)} /> : null}
              {order.discount > 0 ? <DataRow label="Discount" value={`− ${money(order.discount)}`} /> : null}
              <DataRow
                label="Total"
                value={<span className="text-base font-bold">{money(order.total)}</span>}
                className="border-t border-steel-200"
              />
              {!order.currency.isBase ? (
                <DataRow
                  label="Base currency equivalent"
                  value={
                    <span className="text-xs text-steel-500">
                      {(order.baseTotal / 100).toLocaleString('en-GB', {
                        style: 'currency',
                        currency: 'GBP',
                      })}{' '}
                      at {Number(order.fxRate).toFixed(4)}
                    </span>
                  }
                />
              ) : null}
            </dl>
          </AdminCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminCard title="Billing">
              <address className="text-sm not-italic leading-relaxed text-steel-700">
                <p className="font-medium text-steel-900">{order.billingName}</p>
                {order.billingCompany ? <p>{order.billingCompany}</p> : null}
                {order.billingLine1 ? <p>{order.billingLine1}</p> : null}
                {order.billingLine2 ? <p>{order.billingLine2}</p> : null}
                {order.billingCity ? <p>{order.billingCity}</p> : null}
                {order.billingPostcode ? <p>{order.billingPostcode}</p> : null}
                {order.billingCountry ? <p>{order.billingCountry}</p> : null}
              </address>
              <p className="mt-2 text-sm">
                <a href={`mailto:${order.billingEmail}`} className="text-brand-600 hover:underline">
                  {order.billingEmail}
                </a>
              </p>
              {order.billingPhone ? (
                <p className="text-sm">
                  <a
                    href={`tel:${order.billingPhone.replace(/\s/g, '')}`}
                    className="text-brand-600 hover:underline"
                  >
                    {order.billingPhone}
                  </a>
                </p>
              ) : null}
              <p className="mt-3 border-t border-steel-100 pt-3 text-xs text-steel-500">
                {order.user ? (
                  <Link href={`/admin/customers/${order.user.id}`} className="text-brand-600 hover:underline">
                    Registered customer account
                  </Link>
                ) : (
                  'Guest checkout — no account'
                )}
              </p>
            </AdminCard>

            <AdminCard title={order.deliveryRequired ? 'Delivery' : 'Collection'}>
              {order.deliveryRequired ? (
                <>
                  <address className="text-sm not-italic leading-relaxed text-steel-700">
                    {order.deliveryLine1 ? <p>{order.deliveryLine1}</p> : null}
                    {order.deliveryCity ? <p>{order.deliveryCity}</p> : null}
                    {order.deliveryPostcode ? <p>{order.deliveryPostcode}</p> : null}
                    {order.deliveryCountry ? <p>{order.deliveryCountry}</p> : null}
                  </address>
                  {order.deliveryNotes ? (
                    <p className="mt-3 rounded-lg bg-steel-50 p-3 text-xs text-steel-600">
                      {order.deliveryNotes}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-steel-600">Customer is collecting from the depot.</p>
              )}

              {order.customerNotes ? (
                <div className="mt-4 border-t border-steel-100 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-steel-500">
                    Customer notes
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-steel-700">{order.customerNotes}</p>
                </div>
              ) : null}
            </AdminCard>
          </div>

          <AdminCard title="Payments" padded={false}>
            {order.payments.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-steel-400">No payments recorded.</p>
            ) : (
              <ul className="divide-y divide-steel-100">
                {order.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium tabular-nums text-steel-900">
                        {formatMoney(payment.amount, { ...currency, code: payment.currencyCode })}
                        {payment.refundedAmount > 0 ? (
                          <span className="ml-2 text-xs font-normal text-amber-600">
                            {formatMoney(payment.refundedAmount, { ...currency, code: payment.currencyCode })}{' '}
                            refunded
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-steel-500">
                        {formatDateTime(payment.createdAt)} · {payment.method ?? payment.provider}
                        {payment.providerRef ? ` · ${payment.providerRef}` : ''}
                      </p>
                      {payment.failureMessage ? (
                        <p className="mt-1 text-xs text-red-600">{payment.failureMessage}</p>
                      ) : null}
                    </div>
                    <Badge
                      tone={
                        payment.status === 'SUCCEEDED'
                          ? 'success'
                          : payment.status === 'FAILED'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {humanise(payment.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          {order.activities.length > 0 ? (
            <AdminCard title="Order history">
              <ol className="space-y-3 text-sm">
                {order.activities.map((activity) => (
                  <li key={activity.id} className="border-b border-steel-100 pb-3 last:border-0 last:pb-0">
                    <p className="font-medium text-steel-900">{activity.subject ?? humanise(activity.type)}</p>
                    {activity.body ? <p className="mt-0.5 text-steel-600">{activity.body}</p> : null}
                    <p className="mt-1 text-xs text-steel-400">
                      {activity.createdBy
                        ? `${activity.createdBy.firstName} ${activity.createdBy.lastName}`
                        : 'System'}{' '}
                      · {formatDateTime(activity.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            </AdminCard>
          ) : null}
        </div>

        <div className="space-y-4">
          <AdminCard title="Manage order">
            <OrderControls
              orderId={order.id}
              status={order.status}
              internalNotes={order.internalNotes ?? ''}
              refundable={refundable}
              totalFormatted={money(order.total)}
            />
          </AdminCard>

          <AdminCard title="Reference">
            <dl>
              <DataRow label="Order" value={order.orderNumber} className="border-b border-steel-100" />
              <DataRow
                label="Currency"
                value={`${order.currency.code} (${order.currency.symbol})`}
                className="border-b border-steel-100"
              />
              <DataRow
                label="FX rate"
                value={Number(order.fxRate).toFixed(6)}
                className="border-b border-steel-100"
              />
              <DataRow
                label="Paid at"
                value={order.paidAt ? formatDateTime(order.paidAt) : '—'}
                className="border-b border-steel-100"
              />
              <DataRow
                label="Terms accepted"
                value={order.termsAcceptedAt ? formatDateTime(order.termsAcceptedAt) : '—'}
                className="border-b border-steel-100"
              />
              <DataRow label="IP address" value={order.ipAddress ?? '—'} className="border-b border-steel-100" />
              <DataRow
                label="Stripe payment"
                value={
                  order.stripePaymentIntentId ? (
                    <span className="font-mono text-xs">{order.stripePaymentIntentId}</span>
                  ) : (
                    '—'
                  )
                }
              />
            </dl>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
