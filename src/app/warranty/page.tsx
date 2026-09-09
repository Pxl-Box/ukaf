import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs, SectionHeading } from '@/components/ui/primitives';
import { CheckIcon, CloseIcon, ShieldIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Warranty',
  description:
    'Warranty options on used HGVs and commercial vehicles: what is covered, what is not, and how to make a claim.',
  alternates: { canonical: '/warranty' },
};

const PLANS = [
  {
    name: 'Standard',
    duration: '3 months',
    body: 'Included on most vehicles at no extra cost. Covers the major driveline components against mechanical failure.',
    covered: ['Engine internals', 'Gearbox and clutch', 'Differential and drive axles', 'Turbocharger'],
  },
  {
    name: 'Extended',
    duration: '6 or 12 months',
    body: 'Adds the systems that cost the most to put right when they go wrong on a modern truck.',
    covered: [
      'Everything in Standard',
      'Emissions system (EGR, SCR, DPF)',
      'Electronic control units',
      'Air system and compressor',
      'Steering and suspension',
    ],
  },
  {
    name: 'Comprehensive',
    duration: '12 or 24 months',
    body: 'Close to full mechanical and electrical cover, with a labour-rate allowance that reflects real workshop rates.',
    covered: [
      'Everything in Extended',
      'Cooling and fuel systems',
      'Braking system components',
      'Cab electrics and instrumentation',
      'Nationwide recovery',
    ],
  },
];

export default function WarrantyPage() {
  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Warranty' }]} />

      <div className="mb-10 max-w-2xl">
        <h1 className="text-2xl font-bold sm:text-3xl">Warranty cover</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-steel-600">
          A truck standing still is a truck losing money. Warranty cover is not about the parts bill — it is about
          getting you moving again quickly.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan, index) => (
          <article
            key={plan.name}
            className={`panel flex flex-col ${index === 1 ? 'ring-2 ring-brand-500' : ''}`}
          >
            {index === 1 ? (
              <p className="mb-3 inline-block self-start rounded-full bg-brand-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Most popular
              </p>
            ) : null}

            <h2 className="text-lg font-semibold">{plan.name}</h2>
            <p className="mt-0.5 text-sm font-medium text-brand-600">{plan.duration}</p>
            <p className="mt-3 text-sm leading-relaxed text-steel-600">{plan.body}</p>

            <ul className="mt-4 flex-1 space-y-2 border-t border-steel-100 pt-4">
              {plan.covered.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-steel-700">
                  <CheckIcon className="mt-0.5 shrink-0 text-emerald-600" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <p className="mt-4 rounded-lg bg-steel-100 p-4 text-sm leading-relaxed text-steel-600">
        The plan available on a given vehicle is shown on its listing, along with anything specific to that truck. Ask
        us before you buy if warranty matters to your decision — we will tell you honestly what is worth taking on a
        particular vehicle and what is not.
      </p>

      <section className="mt-14 grid gap-8 lg:grid-cols-2">
        <div>
          <SectionHeading title="What is not covered" />
          <ul className="space-y-2.5">
            {[
              'Routine servicing, consumables and fluids',
              'Wear items: tyres, brake pads and discs, wiper blades, bulbs',
              'Damage from accident, misuse, overloading or contaminated fuel',
              'Failures caused by missed or late servicing',
              'Modifications and non-approved parts',
              'Bodywork, paint, trim and glass',
              'Consequential loss such as downtime, hire costs or lost contracts',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-steel-600">
                <CloseIcon className="mt-0.5 shrink-0 text-red-500" />
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs leading-relaxed text-steel-400">
            This is a summary. The warranty document supplied with your vehicle is what governs any claim, and it takes
            precedence over anything on this page.
          </p>
        </div>

        <div>
          <SectionHeading title="Making a claim" />
          <ol className="space-y-4">
            {[
              {
                title: 'Stop and call us first',
                body: 'Before authorising any work. Repairs carried out without approval are generally not recoverable, and that is the single most common reason a claim fails.',
              },
              {
                title: 'We agree the repairer',
                body: 'Our own workshop, a main dealer, or your usual garage — whatever gets you moving soonest.',
              },
              {
                title: 'The fault is diagnosed',
                body: 'The repairer confirms the cause and quotes. We check it against the cover and authorise.',
              },
              {
                title: 'We settle directly',
                body: 'Wherever possible we pay the repairer, so you are not out of pocket waiting for a reimbursement.',
              },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-3.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-steel-950">{step.title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-steel-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-steel-200 bg-white p-8">
        <div className="flex flex-wrap items-start gap-6">
          <ShieldIcon className="text-4xl text-brand-600" />
          <div className="min-w-64 flex-1">
            <h2 className="text-xl font-bold">Your statutory rights are separate</h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-steel-600">
              A warranty is in addition to your legal rights, not instead of them. If a vehicle is not as described,
              our{' '}
              <Link href="/legal/terms" className="font-medium text-brand-600 underline underline-offset-2">
                terms of sale
              </Link>{' '}
              and, for consumers, the Consumer Rights Act 2015 apply regardless of what any warranty says.
            </p>
            <Link href="/contact" className="btn-primary mt-5">
              Ask about a specific vehicle
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
