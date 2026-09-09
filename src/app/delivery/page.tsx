import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs, SectionHeading } from '@/components/ui/primitives';
import { CheckIcon, DocumentIcon, MapPinIcon, TruckIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Delivery & export',
  description:
    'UK-wide delivery and worldwide export for commercial vehicles, including customs documentation, shipping and de-registration.',
  alternates: { canonical: '/delivery' },
};

export default function DeliveryPage() {
  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Delivery & export' }]} />

      <div className="mb-10 max-w-2xl">
        <h1 className="text-2xl font-bold sm:text-3xl">Delivery and export</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-steel-600">
          Collect from us, have it delivered to your yard, or ship it abroad. We handle the paperwork either way.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {[
          {
            icon: <MapPinIcon />,
            title: 'Collection',
            price: 'Free',
            body: 'By appointment from our depot. Bring your paperwork and photo ID; we will have the vehicle prepared, fuelled and ready to drive away.',
            points: ['No charge', 'Same-day once funds clear', 'Full handover and walkaround'],
          },
          {
            icon: <TruckIcon />,
            title: 'UK delivery',
            price: 'Quoted per job',
            body: 'Driven or transported to your address anywhere in mainland Britain. We quote once your order is confirmed, based on distance and whether the vehicle is road-legal to drive.',
            points: ['Typically 2–5 working days', 'Driven or low-loader', 'Confirmed delivery window'],
          },
          {
            icon: <DocumentIcon />,
            title: 'Export',
            price: 'Quoted per job',
            body: 'We are set up for export and do it regularly. We handle de-registration, customs documentation and delivery to your chosen port or shipping agent.',
            points: ['NOVA and V5C notification', 'Customs and CMR paperwork', 'Port delivery arranged'],
          },
        ].map((option) => (
          <article key={option.title} className="panel flex flex-col">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-50 text-xl text-brand-600">
              {option.icon}
            </span>
            <h2 className="mt-4 text-lg font-semibold">{option.title}</h2>
            <p className="mt-0.5 text-sm font-medium text-brand-600">{option.price}</p>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-steel-600">{option.body}</p>
            <ul className="mt-4 space-y-1.5 border-t border-steel-100 pt-4">
              {option.points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-xs text-steel-600">
                  <CheckIcon className="mt-0.5 shrink-0 text-emerald-600" />
                  {point}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <section className="mt-14">
        <SectionHeading
          title="Exporting: what you need to know"
          description="Export is straightforward when it is planned, and expensive when it is not. Here is what actually matters."
        />

        <div className="prose-legal max-w-3xl">
          <h3>VAT on exports</h3>
          <p>
            A vehicle sold for export outside the UK can be zero-rated for VAT, but only if we hold satisfactory
            evidence that it actually left the country within the time limit HMRC sets. In practice that means proof of
            shipping and, usually, evidence of arrival.
          </p>
          <p>
            Because of that, we normally take the VAT as a deposit and refund it once we have the evidence. It is not
            us being awkward — if the proof never arrives, HMRC comes to us for the VAT, and our{' '}
            <Link href="/legal/terms">terms of sale</Link> reflect that.
          </p>

          <h3>Registration in the destination country</h3>
          <p>
            You are responsible for making sure the vehicle can be registered where it is going. Emissions standards,
            lighting, tachograph rules and weight limits vary. Ask us for the exact specification before you commit
            — we would much rather answer a dozen questions than have a truck stuck at a port.
          </p>

          <h3>Documentation we provide</h3>
          <ul>
            <li>V5C notification of permanent export to the DVLA</li>
            <li>Commercial invoice with the correct HS commodity code</li>
            <li>CMR consignment note where the vehicle travels by road</li>
            <li>Certificate of conformity where one exists for the vehicle</li>
            <li>Service history and MOT records as held</li>
          </ul>

          <h3>Payment for export sales</h3>
          <p>
            Export orders are settled by bank transfer in cleared funds before the vehicle leaves. We do not release a
            vehicle against a pending payment, a cheque, or a promise from a third-party agent.
          </p>
          <p>
            <strong>A word on fraud:</strong> we will never tell you our bank details have changed by email alone. If
            you get a message saying so, telephone us using the number on this website before you send anything.
          </p>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-steel-200 bg-white p-8 text-center">
        <h2 className="text-xl font-bold">Need a delivery or export quote?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-steel-600">
          Tell us the vehicle and the destination and we will come back with a figure and a realistic timescale.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/contact" className="btn-primary">
            Request a quote
          </Link>
          <Link href="/trucks" className="btn-secondary">
            Browse stock
          </Link>
        </div>
      </section>
    </div>
  );
}
