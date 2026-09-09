import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { env } from '@/lib/env';
import { Breadcrumbs } from '@/components/ui/primitives';
import { EnquiryForm } from '@/components/forms/EnquiryForm';
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Contact us',
  description:
    'Talk to the UKAF sales team about stock, finance, part exchange or delivery. We reply to every enquiry within one working day.',
  alternates: { canonical: '/contact' },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const reference = typeof params.ref === 'string' ? params.ref : null;

  const [settings, locations] = await Promise.all([
    getSettings(),
    prisma.location
      .findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          line1: true,
          city: true,
          postcode: true,
          phone: true,
          email: true,
        },
      })
      .catch(() => []),
  ]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    name: env.company.name,
    url: env.siteUrl,
    telephone: settings.contactPhone,
    email: settings.contactEmail,
    address: { '@type': 'PostalAddress', streetAddress: settings.address },
    vatID: env.company.vat || undefined,
  };

  return (
    <div className="container-page py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Contact' }]} />

      <div className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-bold sm:text-3xl">Talk to us</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-steel-600">
          Whether you know exactly what you want or just have a job to do and no idea what will do it, we can help. We
          reply to every enquiry within one working day.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="panel">
          <h2 className="text-base font-semibold">Send us a message</h2>
          <EnquiryForm
            className="mt-5"
            defaultMessage={reference ? `Regarding order ${reference}:\n\n` : undefined}
          />
        </div>

        <aside className="space-y-4">
          <div className="panel">
            <h2 className="text-base font-semibold">Get in touch directly</h2>
            <ul className="mt-4 space-y-3.5 text-sm">
              {settings.contactPhone ? (
                <li className="flex gap-3">
                  <PhoneIcon className="mt-0.5 shrink-0 text-lg text-steel-400" />
                  <div>
                    <a
                      href={`tel:${settings.contactPhone.replace(/\s/g, '')}`}
                      className="font-medium text-steel-900 hover:text-brand-700"
                    >
                      {settings.contactPhone}
                    </a>
                    <p className="text-xs text-steel-500">Fastest way to reach us</p>
                  </div>
                </li>
              ) : null}

              {settings.contactEmail ? (
                <li className="flex gap-3">
                  <MailIcon className="mt-0.5 shrink-0 text-lg text-steel-400" />
                  <div>
                    <a
                      href={`mailto:${settings.contactEmail}`}
                      className="break-all font-medium text-steel-900 hover:text-brand-700"
                    >
                      {settings.contactEmail}
                    </a>
                    <p className="text-xs text-steel-500">We reply within one working day</p>
                  </div>
                </li>
              ) : null}

              {settings.address ? (
                <li className="flex gap-3">
                  <MapPinIcon className="mt-0.5 shrink-0 text-lg text-steel-400" />
                  <div>
                    <p className="font-medium text-steel-900">{settings.address}</p>
                    <p className="text-xs text-steel-500">Viewings by appointment</p>
                  </div>
                </li>
              ) : null}

              {settings.openingHours ? (
                <li className="flex gap-3">
                  <ClockIcon className="mt-0.5 shrink-0 text-lg text-steel-400" />
                  <p className="text-steel-700">{settings.openingHours}</p>
                </li>
              ) : null}
            </ul>
          </div>

          {locations.length > 0 ? (
            <div className="panel">
              <h2 className="text-base font-semibold">Our depots</h2>
              <ul className="mt-4 space-y-4 text-sm">
                {locations.map((location) => (
                  <li key={location.id} className="border-b border-steel-100 pb-4 last:border-0 last:pb-0">
                    <p className="font-medium text-steel-900">{location.name}</p>
                    <address className="mt-1 text-xs not-italic leading-relaxed text-steel-600">
                      {location.line1 ? (
                        <>
                          {location.line1}
                          <br />
                        </>
                      ) : null}
                      {location.city}
                      {location.postcode ? `, ${location.postcode}` : ''}
                    </address>
                    {location.phone ? (
                      <a
                        href={`tel:${location.phone.replace(/\s/g, '')}`}
                        className="mt-1 block text-xs text-brand-600 hover:underline"
                      >
                        {location.phone}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="panel bg-steel-950 text-white">
            <h2 className="text-base font-semibold text-white">Company details</h2>
            <dl className="mt-3 space-y-2 text-xs text-steel-300">
              <div>
                <dt className="text-steel-500">Registered name</dt>
                <dd>{env.company.name}</dd>
              </div>
              {env.company.number ? (
                <div>
                  <dt className="text-steel-500">Company number</dt>
                  <dd>{env.company.number}</dd>
                </div>
              ) : null}
              {env.company.vat ? (
                <div>
                  <dt className="text-steel-500">VAT number</dt>
                  <dd>{env.company.vat}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
