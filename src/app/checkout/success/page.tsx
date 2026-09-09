import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { currencyFromRow, formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { Alert, DataRow } from '@/components/ui/primitives';
import { CheckCircleIcon, ClockIcon, PhoneIcon } from '@/components/ui/Icons';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Order confirmed',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const orderNumber = typeof params.order === 'string' ? params.order : null;

  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);

  const order = orderNumber
    ? await prisma.order.findUnique({
        where: { orderNumber },
        include: {
          items: { select: { id: true, name: true, sku: true, totalGross: true } },
          currency: true,
        },
      })
    : null;

  /**
   * Order numbers alone must not unlock order details — anyone could guess at
   * them. Access requires either signing in as the order's owner, or arriving
   * from Stripe with the matching checkout session id, which acts as a
   * one-time capability token for guest checkout.
   */
  const sessionId = typeof params.session_id === 'string' ? params.session_id : null;
  const canView = Boolean(
    order &&
      ((user && order.userId === user.id) ||
        (sessionId && order.stripeSessionId && sessionId === order.stripeSessionId)),
  );

  if (!order || !canView) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl text-center">
          <CheckCircleIcon className="mx-auto text-5xl text-emerald-600" />
          <h1 className="mt-4 text-2xl font-bold">Thank you — your payment is being processed</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-steel-600">
            We have your payment and will email your confirmation shortly. If you do not receive it within a few
            minutes, please check your spam folder or contact us.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/trucks" className="btn-primary">
              Continue browsing
            </Link>
            <Link href="/contact" className="btn-secondary">
              Contact us
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currencyInfo = currencyFromRow(order.currency);

  const isPaid = order.paymentStatus === 'SUCCEEDED';
  const isReservation = order.purchaseType === 'RESERVATION';

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50">
            <CheckCircleIcon className="text-3xl text-emerald-600" />
          </span>
          <h1 className="mt-5 text-2xl font-bold sm:text-3xl">
            {isReservation ? 'Your vehicle is reserved' : 'Thank you for your order'}
          </h1>
          <p className="mt-2 text-[15px] text-steel-600">
            Order <strong className="text-steel-900">{order.orderNumber}</strong> · {formatDate(order.createdAt)}
          </p>
        </div>

        {!isPaid ? (
          <Alert tone="info" title="Payment is still being confirmed" className="mt-6">
            Your bank is still confirming the payment. This usually takes a few seconds — we will email you as soon as
            it clears, and your order is safe in the meantime.
          </Alert>
        ) : null}

        <div className="panel mt-6">
          <h2 className="text-base font-semibold">What you paid for</h2>
          <ul className="mt-3 divide-y divide-steel-100">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-steel-900">{item.name}</p>
                  <p className="text-xs text-steel-500">Stock {item.sku}</p>
                </div>
                <p className="shrink-0 tabular-nums">{formatMoney(item.totalGross, currencyInfo)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-2 border-t border-steel-200 pt-2">
            <DataRow label="Subtotal" value={formatMoney(order.subtotalNet, currencyInfo)} />
            {order.vatAmount > 0 ? (
              <DataRow label="VAT" value={formatMoney(order.vatAmount, currencyInfo)} />
            ) : null}
            <DataRow
              label="Total paid"
              value={<span className="text-base font-bold">{formatMoney(order.total, currencyInfo)}</span>}
            />
          </dl>
        </div>

        <div className="panel mt-4">
          <h2 className="text-base font-semibold">What happens next</h2>
          <ol className="mt-4 space-y-4">
            {[
              {
                title: 'We confirm by email',
                body: `A receipt is on its way to ${order.billingEmail}.`,
              },
              {
                title: 'A specialist calls you',
                body: 'Within one working day, to arrange inspection, paperwork and the balance.',
              },
              isReservation
                ? {
                    title: 'The vehicle is held for 7 days',
                    body: 'Your deposit takes it off sale and comes off the final balance.',
                  }
                : {
                    title: 'We prepare the vehicle',
                    body: 'Final valet, documentation and handover or delivery booking.',
                  },
              {
                title: 'Collection or delivery',
                body: order.deliveryRequired
                  ? 'We will quote for delivery to the address you gave and confirm a date.'
                  : 'Collect from our depot at a time that suits you.',
              },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-3.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-steel-900">{step.title}</p>
                  <p className="mt-0.5 text-sm text-steel-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {isReservation ? (
          <Alert tone="neutral" className="mt-4">
            <ClockIcon className="mr-1 inline" /> Your reservation is valid for 7 days. Refund terms are set out in our{' '}
            <Link href="/legal/returns" className="font-medium underline">
              cancellation policy
            </Link>
            .
          </Alert>
        ) : null}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {user ? (
            <Link href="/account/orders" className="btn-primary">
              View in my account
            </Link>
          ) : (
            <Link href="/register" className="btn-primary">
              Create an account to track this
            </Link>
          )}
          <Link href="/trucks" className="btn-secondary">
            Keep browsing stock
          </Link>
        </div>

        {settings.contactPhone ? (
          <p className="mt-6 text-center text-sm text-steel-500">
            Questions?{' '}
            <a
              href={`tel:${settings.contactPhone.replace(/\s/g, '')}`}
              className="font-medium text-brand-600 hover:underline"
            >
              <PhoneIcon className="mr-1 inline" />
              {settings.contactPhone}
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
