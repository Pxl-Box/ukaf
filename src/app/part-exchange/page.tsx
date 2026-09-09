import type { Metadata } from 'next';
import { Breadcrumbs, SectionHeading } from '@/components/ui/primitives';
import { EnquiryForm } from '@/components/forms/EnquiryForm';
import { CheckIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Part exchange valuation',
  description:
    'Free, no-obligation part exchange valuations on HGVs, tractor units, trailers and rigids. Tell us what you have and we will make you an offer.',
  alternates: { canonical: '/part-exchange' },
};

const STEPS = [
  {
    title: 'Tell us what you have',
    body: 'Make, model, year, mileage and registration. Photographs help, but are not essential at this stage.',
  },
  {
    title: 'We value it',
    body: 'We check trade guides, current auction results and what we are actually seeing sell. You get a realistic figure, not a hopeful one.',
  },
  {
    title: 'We confirm on inspection',
    body: 'The offer is subject to the vehicle being as described. We inspect at handover — no last-minute renegotiation over things you already told us about.',
  },
  {
    title: 'We settle any finance',
    body: 'If there is outstanding finance we will settle it directly with the lender and pay you the balance.',
  },
];

export default function PartExchangePage() {
  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Part exchange' }]} />

      <div className="mb-10 max-w-2xl">
        <h1 className="text-2xl font-bold sm:text-3xl">Part exchange your current vehicle</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-steel-600">
          Free valuation, no obligation, and no pressure to buy anything from us. We would rather give you an honest
          number and lose the deal than waste your afternoon.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          <SectionHeading title="How it works" />

          <ol className="space-y-5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-steel-950">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-steel-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <section className="mt-12">
            <SectionHeading title="What affects the value" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: 'Mileage and age',
                  body: 'The obvious ones, but less decisive than people expect on a well-maintained vehicle.',
                },
                {
                  title: 'Service history',
                  body: 'A complete, documented history is worth real money. Bring the folder.',
                },
                {
                  title: 'MOT and plating',
                  body: 'A long MOT and current plating certificate save us work, and that comes back to you.',
                },
                {
                  title: 'Specification',
                  body: 'Axle configuration, emissions standard and gearbox matter more than colour or cab trim.',
                },
                {
                  title: 'Tyres and bodywork',
                  body: 'We expect fair wear. We are pricing a working vehicle, not a show truck.',
                },
                {
                  title: 'Outstanding finance',
                  body: 'Not a problem — we settle it directly. Just tell us up front so there are no surprises.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-steel-200 bg-white p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-steel-900">
                    <CheckIcon className="text-emerald-600" />
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-steel-600">{item.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="panel">
            <h2 className="text-base font-semibold">Get a valuation</h2>
            <p className="mt-1 text-sm text-steel-500">
              We aim to come back to you within one working day.
            </p>
            <EnquiryForm
              variant="part-exchange"
              className="mt-5"
              defaultMessage="I would like a part exchange valuation."
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
