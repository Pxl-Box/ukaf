import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { publicWhere } from '@/lib/trucks';
import { getSettings } from '@/lib/settings';
import { env } from '@/lib/env';
import { Breadcrumbs, SectionHeading } from '@/components/ui/primitives';
import { CheckIcon, DocumentIcon, ShieldIcon, TruckIcon, UsersIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'About us',
  description:
    'UKAF Commercials supplies inspected, workshop-prepared HGVs and commercial vehicles across the UK and for export.',
  alternates: { canonical: '/about' },
};

export const revalidate = 3600;

export default async function AboutPage() {
  const [settings, stockCount, locationCount] = await Promise.all([
    getSettings(),
    prisma.truck.count({ where: { ...publicWhere(), status: 'AVAILABLE' } }).catch(() => 0),
    prisma.location.count({ where: { isActive: true } }).catch(() => 0),
  ]);

  return (
    <div>
      <section className="border-b border-steel-200 bg-white">
        <div className="container-page py-14">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">About us</p>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
              We sell trucks that turn up and do the job
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-steel-600">
              {settings.tagline} Every vehicle we sell goes through our own workshop before it goes on the website,
              because a truck that fails in week two costs you far more than the discount you thought you were getting.
            </p>
          </div>
        </div>
      </section>

      <div className="container-page py-10">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'About' }]} />

        <div className="mb-12 grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Vehicles in stock', value: stockCount > 0 ? String(stockCount) : '—', icon: <TruckIcon /> },
            { label: 'Depots', value: locationCount > 0 ? String(locationCount) : '—', icon: <UsersIcon /> },
            { label: 'Export destinations', value: '20+', icon: <DocumentIcon /> },
          ].map((stat) => (
            <div key={stat.label} className="panel text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-brand-50 text-xl text-brand-600">
                {stat.icon}
              </span>
              <p className="mt-3 text-3xl font-bold tabular-nums text-steel-950">{stat.value}</p>
              <p className="mt-1 text-sm text-steel-500">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-12 lg:grid-cols-2">
          <section>
            <SectionHeading title="How we work" />
            <div className="prose-legal">
              <p>
                We buy selectively. Most of our stock comes from fleet disposals and part exchanges where we know the
                operator and can see the maintenance history, rather than from auction where you are bidding on a
                photograph and a prayer.
              </p>
              <p>
                Everything is HPI checked and mileage verified before it goes anywhere near the website. It then goes
                through our workshop for inspection, service, and whatever it needs to be right — which is sometimes
                nothing and sometimes a fortnight&rsquo;s work.
              </p>
              <p>
                We photograph the actual vehicle, including the bits that are not perfect. If a truck has a dented
                wing or worn driver&rsquo;s seat, you will see it in the listing rather than discover it on collection
                day.
              </p>
            </div>
          </section>

          <section>
            <SectionHeading title="What you get" />
            <ul className="space-y-3">
              {[
                ['HPI clear and mileage verified', 'Every vehicle, without exception, before it is advertised.'],
                ['Full documentation', 'V5C, service records and MOT history handed over with the keys.'],
                ['Workshop preparation', 'Inspected and serviced in-house, with a fresh MOT where appropriate.'],
                ['Warranty options', 'Cover available on every vehicle; the terms are stated on the listing.'],
                ['Finance and part exchange', 'Handled in-house so you deal with one company, not three.'],
                ['UK delivery and export', 'Nationwide transport and full export documentation.'],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-3">
                  <CheckIcon className="mt-0.5 shrink-0 text-emerald-600" />
                  <span className="text-sm leading-relaxed text-steel-700">
                    <strong className="text-steel-950">{title}</strong> — {body}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-12 rounded-2xl border border-steel-200 bg-white p-8">
          <div className="flex flex-wrap items-start gap-6">
            <ShieldIcon className="text-4xl text-brand-600" />
            <div className="min-w-64 flex-1">
              <h2 className="text-xl font-bold">Buying with confidence</h2>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-steel-600">
                Card payments are processed by Stripe with 3-D Secure — we never see your card details. Reservation
                deposits are held against a specific vehicle and are refundable under our published{' '}
                <Link href="/legal/returns" className="font-medium text-brand-600 underline underline-offset-2">
                  cancellation policy
                </Link>
                . Our{' '}
                <Link href="/legal/terms" className="font-medium text-brand-600 underline underline-offset-2">
                  terms of sale
                </Link>{' '}
                set out exactly what you are agreeing to, in plain English.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-steel-950 p-8 text-white">
          <h2 className="text-xl font-bold">Company details</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Registered name', env.company.name],
              ['Company number', env.company.number || '—'],
              ['VAT number', env.company.vat || '—'],
              ['Registered office', env.company.address || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-steel-500">{label}</dt>
                <dd className="mt-1 text-steel-200">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/trucks" className="btn-accent">
              Browse stock
            </Link>
            <Link href="/contact" className="btn-lg border border-white/20 bg-white/5 text-white hover:bg-white/10">
              Get in touch
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
