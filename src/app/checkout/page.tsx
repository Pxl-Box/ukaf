import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cartTotals, getCart, lineNet, lineVat } from '@/lib/cart';
import { getDisplayCurrency } from '@/lib/currency';
import { convertFromBase, formatMoney } from '@/lib/money';
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { isStripeEnabled } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { Alert, Breadcrumbs } from '@/components/ui/primitives';
import { ShieldIcon } from '@/components/ui/Icons';
import { CheckoutForm } from './CheckoutForm';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const [cart, currency, user, settings] = await Promise.all([
    getCart(),
    getDisplayCurrency(),
    getCurrentUser(),
    getSettings(),
  ]);

  if (!cart || cart.items.length === 0) {
    redirect('/cart');
  }

  const totals = cartTotals(cart);
  const money = (baseMinor: number) => formatMoney(convertFromBase(baseMinor, currency), currency);

  // Pre-fill from the user's default billing address where we have one.
  const defaultAddress = user
    ? await prisma.address.findFirst({
        where: { userId: user.id, type: 'BILLING' },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      })
    : null;

  const payable = cart.items.filter(
    (item) => item.truck.status === 'AVAILABLE' && !item.truck.priceOnApplication,
  );

  return (
    <div className="container-page py-8">
      <Breadcrumbs
        items={[{ label: 'Home', href: '/' }, { label: 'Basket', href: '/cart' }, { label: 'Checkout' }]}
      />
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Checkout</h1>

      {params.cancelled ? (
        <Alert tone="warning" title="Payment cancelled" className="mb-5">
          Your payment was cancelled and nothing has been charged. Your basket is unchanged — you can try again below.
        </Alert>
      ) : null}

      {!isStripeEnabled() ? (
        <Alert tone="danger" title="Online payment is unavailable" className="mb-5">
          We cannot take card payments at the moment. Please{' '}
          <Link href="/contact" className="underline">
            contact our sales team
          </Link>{' '}
          and we will complete your order by bank transfer.
        </Alert>
      ) : null}

      {totals.hasUnavailable ? (
        <Alert tone="warning" title="Some items are unavailable" className="mb-5">
          Vehicles that are no longer available have been excluded from this order.{' '}
          <Link href="/cart" className="underline">
            Review your basket
          </Link>
          .
        </Alert>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <CheckoutForm
          defaultValues={{
            email: user?.email ?? '',
            firstName: user?.firstName ?? '',
            lastName: user?.lastName ?? '',
            phone: user?.phone ?? '',
            company: user?.companyName ?? defaultAddress?.company ?? '',
            billingLine1: defaultAddress?.line1 ?? '',
            billingLine2: defaultAddress?.line2 ?? '',
            billingCity: defaultAddress?.city ?? '',
            billingPostcode: defaultAddress?.postcode ?? '',
            billingCountry: defaultAddress?.country ?? 'GB',
          }}
          isSignedIn={Boolean(user)}
          guestCheckoutEnabled={settings.enableGuestCheckout}
          stripeEnabled={isStripeEnabled()}
        />

        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="panel">
            <h2 className="text-base font-semibold">Order summary</h2>

            <ul className="mt-4 space-y-3 border-b border-steel-200 pb-4">
              {payable.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-steel-900">{item.truck.title}</p>
                    <p className="text-xs text-steel-500">
                      {item.purchaseType === 'RESERVATION' ? 'Reservation deposit' : 'Full purchase'} · Stock{' '}
                      {item.truck.stockNumber}
                    </p>
                  </div>
                  <p className="shrink-0 tabular-nums">{money(lineNet(item) + lineVat(item))}</p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-steel-500">Subtotal</dt>
                <dd className="tabular-nums">{money(totals.subtotalNet)}</dd>
              </div>
              {totals.vatAmount > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-steel-500">VAT</dt>
                  <dd className="tabular-nums">{money(totals.vatAmount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-steel-200 pt-2.5 text-base font-bold">
                <dt>Total due now</dt>
                <dd className="tabular-nums">{money(totals.total)}</dd>
              </div>
            </dl>

            <p className="mt-3 text-xs leading-relaxed text-steel-500">
              Charged in <strong>{currency.code}</strong>.
              {!currency.isBase
                ? ' Converted from GBP at today’s rate; your bank may apply its own charges.'
                : ''}
            </p>

            <p className="mt-4 flex items-start gap-2 rounded-lg bg-steel-50 p-3 text-xs leading-relaxed text-steel-600">
              <ShieldIcon className="mt-0.5 shrink-0 text-emerald-600" />
              You will be redirected to Stripe to pay. We never see your card details, and 3-D Secure applies where your
              bank requires it.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
