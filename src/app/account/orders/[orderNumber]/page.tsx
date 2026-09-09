import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { currencyFromRow, formatMoney } from '@/lib/money';
import { formatDate, formatDateTime, humanise } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '@/lib/orders';
import { Alert, Badge, Breadcrumbs, DataRow } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Order details',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const user = await requireUser(`/account/orders/${orderNumber}`);

  // Scoped to the signed-in user — an order number from someone else 404s.
  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: user.id },
    include: {
      currency: true,
      items: { include: { truck: { select: { slug: true, title: true } } } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!order) notFound();

  const currency = currencyFromRow(order.currency);
  const money = (amount: number) => formatMoney(amount, currency);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Account', href: '/account' },
          { label: 'Orders', href: '/account/orders' },
          { label: order.orderNumber },
        ]}
      />

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-steel-500">
            Placed {formatDate(order.createdAt)} ·{' '}
            {order.purchaseType === 'RESERVATION' ? 'Reservation deposit' : 'Full purchase'}
          </p>
        </div>
        <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
          {ORDER_STATUS_LABELS[order.status] ?? humanise(order.status)}
        </Badge>
      </header>

      {order.status === 'AWAITING_PAYMENT' ? (
        <Alert tone="warning" title="Payment not completed" className="mb-6">
          We have not received payment for this order. If you closed the payment window, you can start again from your
          basket, or contact us and we will take payment another way.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel">
          <h2 className="mb-3 text-base font-semibold">Items</h2>
          <ul className="divide-y divide-steel-100">
            {order.items.map((item) => (
              <li key={item.id} className="py-3">
                <div className="flex justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-steel-900">
                      {item.truck ? (
                        <Link href={`/trucks/${item.truck.slug}`} className="hover:text-brand-700">
                          {item.name}
                        </Link>
                      ) : (
                        item.name
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-steel-500">Stock {item.sku}</p>
                    {item.description ? (
                      <p className="mt-1 text-xs text-steel-500">{item.description}</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-sm tabular-nums">{money(item.totalGross)}</p>
                </div>
              </li>
            ))}
          </ul>

          <dl className="mt-2 border-t border-steel-200 pt-2">
            <DataRow label="Subtotal" value={money(order.subtotalNet)} />
            {order.vatAmount > 0 ? <DataRow label="VAT" value={money(order.vatAmount)} /> : null}
            {order.deliveryFee > 0 ? <DataRow label="Delivery" value={money(order.deliveryFee)} /> : null}
            {order.discount > 0 ? <DataRow label="Discount" value={`− ${money(order.discount)}`} /> : null}
            <DataRow
              label="Total"
              value={<span className="text-base font-bold">{money(order.total)}</span>}
              className="border-t border-steel-200"
            />
          </dl>
        </section>

        <div className="space-y-4">
          <section className="panel">
            <h2 className="mb-3 text-base font-semibold">Billing</h2>
            <address className="text-sm not-italic leading-relaxed text-steel-700">
              {order.billingName ? <p className="font-medium text-steel-900">{order.billingName}</p> : null}
              {order.billingCompany ? <p>{order.billingCompany}</p> : null}
              {order.billingLine1 ? <p>{order.billingLine1}</p> : null}
              {order.billingLine2 ? <p>{order.billingLine2}</p> : null}
              {order.billingCity ? <p>{order.billingCity}</p> : null}
              {order.billingPostcode ? <p>{order.billingPostcode}</p> : null}
              {order.billingCountry ? <p>{order.billingCountry}</p> : null}
              <p className="mt-2 text-steel-500">{order.billingEmail}</p>
              {order.billingPhone ? <p className="text-steel-500">{order.billingPhone}</p> : null}
            </address>
          </section>

          {order.deliveryRequired ? (
            <section className="panel">
              <h2 className="mb-3 text-base font-semibold">Delivery</h2>
              <address className="text-sm not-italic leading-relaxed text-steel-700">
                {order.deliveryLine1 ? <p>{order.deliveryLine1}</p> : null}
                {order.deliveryCity ? <p>{order.deliveryCity}</p> : null}
                {order.deliveryPostcode ? <p>{order.deliveryPostcode}</p> : null}
                {order.deliveryCountry ? <p>{order.deliveryCountry}</p> : null}
              </address>
              {order.deliveryNotes ? (
                <p className="mt-3 rounded-lg bg-steel-50 p-3 text-xs text-steel-600">{order.deliveryNotes}</p>
              ) : null}
              <p className="mt-3 text-xs text-steel-500">
                Delivery is quoted separately — we will confirm the cost and date with you.
              </p>
            </section>
          ) : (
            <section className="panel">
              <h2 className="mb-2 text-base font-semibold">Collection</h2>
              <p className="text-sm text-steel-600">
                Collection from our depot. We will contact you to arrange a time that suits.
              </p>
            </section>
          )}

          <section className="panel">
            <h2 className="mb-3 text-base font-semibold">Payments</h2>
            {order.payments.length === 0 ? (
              <p className="text-sm text-steel-500">No payments recorded yet.</p>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {order.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-steel-900">
                        {formatMoney(payment.amount, { ...currency, code: payment.currencyCode })}
                      </p>
                      <p className="text-xs text-steel-500">
                        {formatDateTime(payment.createdAt)} · {payment.method ?? payment.provider}
                      </p>
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
          </section>
        </div>
      </div>

      {order.customerNotes ? (
        <section className="panel mt-4">
          <h2 className="mb-2 text-base font-semibold">Your notes</h2>
          <p className="whitespace-pre-wrap text-sm text-steel-700">{order.customerNotes}</p>
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/account/orders" className="btn-secondary">
          Back to orders
        </Link>
        <Link href={`/contact?ref=${order.orderNumber}`} className="btn-ghost">
          Question about this order?
        </Link>
      </div>
    </div>
  );
}
