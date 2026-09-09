import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { getBaseCurrency } from '@/lib/currency';
import { env } from '@/lib/env';
import { Breadcrumbs, SectionHeading } from '@/components/ui/primitives';
import { CheckIcon } from '@/components/ui/Icons';
import { FinanceEnquiryForm } from './FinanceEnquiryForm';

export const metadata: Metadata = {
  title: 'HGV finance & leasing',
  description:
    'Hire purchase, finance lease and contract hire for commercial vehicles. Decisions typically within 24 hours for limited companies, sole traders and partnerships.',
  alternates: { canonical: '/finance' },
};

const PRODUCTS = [
  {
    name: 'Hire purchase',
    body: 'Fixed monthly payments over an agreed term. You own the vehicle outright at the end after the option-to-purchase fee. The most common choice for owner-operators building an asset base.',
    points: ['Own the asset at the end', 'Deposit typically 10%', 'Capital allowances may apply'],
  },
  {
    name: 'Finance lease',
    body: 'The lender buys the vehicle and leases it to you. Payments are usually allowable against taxable profit, and VAT is spread across the rentals rather than paid up front.',
    points: ['VAT spread over the term', 'Off-balance-sheet options', 'Balloon payments available'],
  },
  {
    name: 'Contract hire',
    body: 'A fixed monthly cost with the residual value risk carried by the lender. Suits fleets that want predictable budgeting and to hand the vehicle back at the end.',
    points: ['No residual value risk', 'Maintenance packages available', 'Simple fleet budgeting'],
  },
];

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const truckId = typeof params.truck === 'string' ? params.truck : undefined;

  const [settings, base, truck] = await Promise.all([
    getSettings(),
    getBaseCurrency(),
    truckId
      ? prisma.truck
          .findFirst({
            where: { id: truckId, publishedAt: { not: null } },
            select: { id: true, title: true, priceNet: true, slug: true },
          })
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <section className="border-b border-steel-200 bg-steel-950 text-white">
        <div className="container-page py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-300">Finance & leasing</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold sm:text-4xl">
            Finance built for commercial vehicles, from {settings.financeApr}% APR
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-steel-300">
            We work with lenders who understand haulage — who know what a 6x2 tractor unit is worth at three years old,
            and that a new-start operator with the right contract is a good risk.
          </p>

          <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-steel-300">
            {[
              'Decisions typically within 24 hours',
              'Terms from 12 to 60 months',
              'New-start and adverse credit considered',
            ].map((point) => (
              <li key={point} className="flex items-center gap-2">
                <CheckIcon className="text-emerald-400" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="container-page py-10">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Finance' }]} />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0">
            <SectionHeading
              title="Which product suits you?"
              description="A quick guide. We will talk it through properly before anything is submitted."
            />

            <div className="grid gap-4 sm:grid-cols-3">
              {PRODUCTS.map((product) => (
                <article key={product.name} className="panel flex flex-col">
                  <h3 className="text-base font-semibold">{product.name}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-steel-600">{product.body}</p>
                  <ul className="mt-4 space-y-1.5 border-t border-steel-100 pt-4">
                    {product.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-xs text-steel-600">
                        <CheckIcon className="mt-0.5 shrink-0 text-emerald-600" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <section className="mt-12">
              <SectionHeading title="What we will need" />
              <div className="panel">
                <ul className="space-y-3 text-sm text-steel-700">
                  {[
                    ['Business details', 'Trading name, address, how long you have been trading, and your company number if incorporated.'],
                    ['Director or proprietor details', 'Name, date of birth and address history — lenders need this for their credit search.'],
                    ['Bank statements', 'Usually three months, sometimes six for a newer business.'],
                    ['Proof of the work', 'A contract, a customer letter or recent invoices help enormously with a new-start application.'],
                  ].map(([title, body]) => (
                    <li key={title} className="flex gap-3">
                      <CheckIcon className="mt-0.5 shrink-0 text-emerald-600" />
                      <span>
                        <strong className="text-steel-900">{title}</strong> — {body}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-5 rounded-lg bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900">
                  <strong>Submitting this form does not run a credit check.</strong> It starts a conversation. Nothing
                  touches your credit file until you have seen the terms and told us to proceed.
                </p>
              </div>
            </section>

            <section className="mt-12">
              <SectionHeading title="The legal bit" />
              <div className="prose-legal">
                <p>
                  {env.company.name} is a credit broker, not a lender. We introduce you to a panel of lenders and may
                  receive a commission from the lender if you take out an agreement — the amount does not affect what
                  you pay, and we will tell you the nature of the commission on request.
                </p>
                <p>
                  Finance is subject to status, credit checks and lender approval, and is available to business users
                  only. The representative APR of {settings.financeApr}% is indicative; your actual rate depends on the
                  lender&rsquo;s assessment, the vehicle, the term and the deposit.
                </p>
                <p>
                  Written quotations are available on request. All figures shown anywhere on this website are
                  illustrations and do not constitute an offer of finance.
                </p>
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-28 lg:h-fit">
            <div className="panel">
              <h2 className="text-base font-semibold">Request a quote</h2>
              <p className="mt-1 text-sm text-steel-500">
                A finance specialist will call you to talk through the options.
              </p>

              {truck ? (
                <p className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
                  Quoting for{' '}
                  <Link href={`/trucks/${truck.slug}`} className="font-semibold underline">
                    {truck.title}
                  </Link>
                </p>
              ) : null}

              <FinanceEnquiryForm
                className="mt-5"
                truckId={truck?.id}
                defaultPrice={truck ? (truck.priceNet / 100).toFixed(2) : ''}
                currencySymbol={base.symbol}
                apr={settings.financeApr}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
