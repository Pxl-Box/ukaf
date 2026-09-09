import type { Metadata } from 'next';
import { Breadcrumbs, SectionHeading } from '@/components/ui/primitives';
import { EnquiryForm } from '@/components/forms/EnquiryForm';
import { CheckIcon, ClockIcon, CurrencyIcon, ShieldIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Sell your truck to us',
  description:
    'We buy quality used HGVs, tractor units, tippers and rigids outright. Fast payment, finance settled, collection arranged.',
  alternates: { canonical: '/sell-your-truck' },
};

export default function SellYourTruckPage() {
  return (
    <div>
      <section className="border-b border-steel-200 bg-steel-950 text-white">
        <div className="container-page py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-400">We buy</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold sm:text-4xl">
            Sell us your truck — outright, and without the messing about
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-steel-300">
            No listing fees, no time-wasters ringing you at seven in the morning, and no offer that mysteriously drops
            when the transporter arrives. We inspect, we agree a price, we pay.
          </p>
        </div>
      </section>

      <div className="container-page py-10">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Sell your truck' }]} />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: <ClockIcon />,
                  title: 'Valued within 24 hours',
                  body: 'Send the details today and you will have a figure tomorrow.',
                },
                {
                  icon: <CurrencyIcon />,
                  title: 'Paid on collection',
                  body: 'Funds sent by bank transfer the day we collect, not thirty days later.',
                },
                {
                  icon: <ShieldIcon />,
                  title: 'Finance settled',
                  body: 'Outstanding HP or lease settled directly with the lender.',
                },
              ].map((item) => (
                <div key={item.title} className="panel">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-lg text-brand-600">
                    {item.icon}
                  </span>
                  <h2 className="mt-3 text-sm font-semibold text-steel-950">{item.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-steel-600">{item.body}</p>
                </div>
              ))}
            </div>

            <section className="mt-12">
              <SectionHeading
                title="What we are looking for"
                description="We buy across the board, but these move fastest."
              />
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {[
                  'Euro 6 tractor units, 4x2 and 6x2',
                  'Tippers and grab loaders, 8x4',
                  'Curtainsiders and box rigids, 7.5t to 26t',
                  'Refrigerated rigids and trailers',
                  'Concrete mixers and hook loaders',
                  'Recovery and vehicle transporters',
                  'Well-maintained fleet disposals',
                  'Vehicles with full service history',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-steel-700">
                    <CheckIcon className="mt-0.5 shrink-0 text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>

              <p className="mt-5 rounded-lg bg-steel-100 p-4 text-sm leading-relaxed text-steel-600">
                Have a whole fleet to move, or something unusual? Tell us anyway. We would rather see it and say no
                than miss something good.
              </p>
            </section>

            <section className="mt-12">
              <SectionHeading title="What happens next" />
              <ol className="space-y-5">
                {[
                  {
                    title: 'You send the details',
                    body: 'Make, model, year, mileage, registration and anything we should know. Photographs are welcome but not required.',
                  },
                  {
                    title: 'We make an offer',
                    body: 'A realistic figure within one working day, subject to inspection. We will explain how we got to it.',
                  },
                  {
                    title: 'We inspect',
                    body: 'At your yard or ours. If the vehicle is as described, the price does not change.',
                  },
                  {
                    title: 'We pay and collect',
                    body: 'Bank transfer on the day, any outstanding finance settled directly, and we arrange transport at our cost.',
                  },
                ].map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-500 text-sm font-bold text-steel-950">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-steel-950">{step.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-steel-600">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="lg:sticky lg:top-28 lg:h-fit">
            <div className="panel">
              <h2 className="text-base font-semibold">Tell us what you have</h2>
              <p className="mt-1 text-sm text-steel-500">Free valuation, no obligation.</p>
              <EnquiryForm
                variant="part-exchange"
                className="mt-5"
                defaultMessage="I would like to sell this vehicle outright."
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
