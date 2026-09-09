import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { cartTotals, getCart, lineNet, lineVat } from '@/lib/cart';
import { getDisplayCurrency } from '@/lib/currency';
import { convertFromBase, formatMoney, VAT_LABELS } from '@/lib/money';
import { PLACEHOLDER_IMAGE } from '@/lib/utils';
import { Alert, Breadcrumbs, EmptyState } from '@/components/ui/primitives';
import { CartIcon, ShieldIcon } from '@/components/ui/Icons';
import { RemoveCartItemButton } from '@/components/CartActions';

export const metadata: Metadata = {
  title: 'Your basket',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const [cart, currency] = await Promise.all([getCart(), getDisplayCurrency()]);
  const totals = cartTotals(cart);

  const money = (baseMinor: number) => formatMoney(convertFromBase(baseMinor, currency), currency);

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-page py-8">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Basket' }]} />
        <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Your basket</h1>
        <EmptyState
          icon={<CartIcon />}
          title="Your basket is empty"
          description="Reserve a vehicle from any listing to hold it while you arrange inspection and payment."
          action={
            <Link href="/trucks" className="btn-primary">
              Browse stock
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Basket' }]} />
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Your basket</h1>

      {totals.hasUnavailable ? (
        <Alert tone="warning" title="Some items are no longer available" className="mb-5">
          One or more vehicles below have been reserved or sold since you added them. Remove them to continue to
          checkout.
        </Alert>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <ul className="space-y-3">
          {cart.items.map((item) => {
            const unavailable = item.truck.status !== 'AVAILABLE' || item.truck.priceOnApplication;
            const isReservation = item.purchaseType === 'RESERVATION';

            return (
              <li key={item.id} className="card flex gap-4 p-4">
                <Link
                  href={`/trucks/${item.truck.slug}`}
                  className="relative block h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-steel-100"
                >
                  <Image
                    src={item.truck.images[0]?.url ?? PLACEHOLDER_IMAGE}
                    alt=""
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold">
                        <Link href={`/trucks/${item.truck.slug}`} className="hover:text-brand-700">
                          {item.truck.title}
                        </Link>
                      </h2>
                      <p className="mt-0.5 text-xs text-steel-500">
                        {item.truck.year} {item.truck.make.name} · Stock {item.truck.stockNumber}
                      </p>
                    </div>
                    <RemoveCartItemButton itemId={item.id} title={item.truck.title} />
                  </div>

                  <p className="mt-2 text-xs">
                    <span
                      className={
                        isReservation
                          ? 'rounded bg-brand-50 px-2 py-0.5 font-medium text-brand-700'
                          : 'rounded bg-steel-100 px-2 py-0.5 font-medium text-steel-700'
                      }
                    >
                      {isReservation ? 'Reservation deposit' : 'Full purchase'}
                    </span>
                  </p>

                  {unavailable ? (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      No longer available — please remove to continue.
                    </p>
                  ) : (
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <p className="text-xs text-steel-500">
                        {isReservation ? (
                          <>
                            Vehicle price {money(item.truck.priceNet)} · {VAT_LABELS[item.truck.vatTreatment]}
                          </>
                        ) : (
                          VAT_LABELS[item.truck.vatTreatment]
                        )}
                      </p>
                      <p className="text-base font-bold tabular-nums">
                        {money(lineNet(item) + lineVat(item))}
                      </p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="panel">
            <h2 className="text-base font-semibold">Summary</h2>

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

            {currency.isBase ? null : (
              <p className="mt-2 text-xs text-steel-500">
                Shown in {currency.code}. You will be charged in {currency.code} at checkout.
              </p>
            )}

            <Link
              href="/checkout"
              aria-disabled={totals.hasUnavailable}
              className={`btn-primary mt-5 w-full ${totals.hasUnavailable ? 'pointer-events-none opacity-50' : ''}`}
            >
              Continue to checkout
            </Link>

            <Link href="/trucks" className="btn-ghost mt-2 w-full">
              Continue browsing
            </Link>

            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-steel-500">
              <ShieldIcon className="mt-0.5 shrink-0 text-emerald-600" />
              Payments are processed by Stripe. We never see or store your card details.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
