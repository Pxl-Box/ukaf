import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getRelatedTrucks, getTruckBySlug, incrementViewCount } from '@/lib/trucks';
import { getDisplayCurrency } from '@/lib/currency';
import { convertFromBase, formatMoney, VAT_EXPLAINERS } from '@/lib/money';
import { getSettings } from '@/lib/settings';
import { env } from '@/lib/env';
import { formatDate, formatMileage, formatNumber, formatWeight, humanise, truncate } from '@/lib/utils';
import { formatCustomFieldsForDisplay } from '@/lib/category-fields';
import { PriceBlock } from '@/components/ui/Price';
import { Alert, Badge, Breadcrumbs, DataRow, SectionHeading } from '@/components/ui/primitives';
import { TruckGallery } from '@/components/TruckGallery';
import { TruckCard, TruckCardSkeleton } from '@/components/TruckCard';
import { SaveTruckButton } from '@/components/SaveTruckButton';
import { ReserveButton } from '@/components/ReserveButton';
import { FinanceCalculator } from '@/components/FinanceCalculator';
import { EnquiryForm } from '@/components/forms/EnquiryForm';
import { CompareToggle } from '@/components/CompareToggle';
import {
  CheckIcon,
  DocumentIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldIcon,
  TruckIcon,
} from '@/components/ui/Icons';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const truck = await getTruckBySlug(slug).catch(() => null);

  if (!truck) {
    return { title: 'Vehicle not found' };
  }

  const description =
    truck.metaDescription ??
    truck.shortDescription ??
    `${truck.year} ${truck.make.name} ${truck.modelName}${
      truck.mileageKm ? ` with ${formatNumber(truck.mileageKm)} km` : ''
    }. ${truck.category.name} for sale at UKAF Commercials.`;

  const image = truck.images[0]?.url;

  return {
    title: truck.metaTitle ?? truck.title,
    description: truncate(description, 160),
    alternates: { canonical: `/trucks/${truck.slug}` },
    openGraph: {
      type: 'website',
      title: truck.title,
      description: truncate(description, 200),
      url: `${env.siteUrl}/trucks/${truck.slug}`,
      images: image ? [{ url: image, alt: truck.title }] : undefined,
    },
    robots: truck.status === 'SOLD' ? { index: false, follow: true } : undefined,
  };
}

/** Pre-render the most-viewed listings at build time. */
export async function generateStaticParams() {
  try {
    const trucks = await prisma.truck.findMany({
      where: { status: 'AVAILABLE', publishedAt: { not: null } },
      select: { slug: true },
      orderBy: { viewCount: 'desc' },
      take: 40,
    });
    return trucks.map((truck) => ({ slug: truck.slug }));
  } catch {
    return [];
  }
}

export const revalidate = 300;

export default async function TruckDetailPage({ params }: Props) {
  const { slug } = await params;
  const truck = await getTruckBySlug(slug);

  if (!truck) notFound();

  const [currency, settings, user, related] = await Promise.all([
    getDisplayCurrency(),
    getSettings(),
    getCurrentUser(),
    getRelatedTrucks(truck, 4).catch(() => []),
  ]);

  incrementViewCount(truck.id);

  const isSaved = user
    ? Boolean(
        await prisma.savedTruck.findUnique({
          where: { userId_truckId: { userId: user.id, truckId: truck.id } },
          select: { id: true },
        }),
      )
    : false;

  const savedRelatedIds = user
    ? new Set(
        (await prisma.savedTruck.findMany({ where: { userId: user.id }, select: { truckId: true } })).map(
          (entry) => entry.truckId,
        ),
      )
    : new Set<string>();

  const isAvailable = truck.status === 'AVAILABLE';
  const depositLabel = formatMoney(convertFromBase(truck.reservationFee, currency), currency);

  const specs: Array<[string, string]> = [
    ['Stock number', truck.stockNumber],
    ['Make', truck.make.name],
    ['Model', `${truck.modelName}${truck.variant ? ` ${truck.variant}` : ''}`],
    ['Body type', truck.category.name],
    ['Year', String(truck.year)],
    ['Mileage', formatMileage(truck.mileageKm)],
    ['Condition', humanise(truck.condition)],
    ['Axle configuration', truck.axleConfig ?? '—'],
    ['Gross vehicle weight', formatWeight(truck.grossWeightKg)],
    ['Payload', formatWeight(truck.payloadKg)],
    ['Gearbox', `${humanise(truck.transmission)}${truck.gears ? ` (${truck.gears} speed)` : ''}`],
    ['Fuel', humanise(truck.fuelType)],
    ['Emissions', truck.emissions === 'ZERO_EMISSION' ? 'Zero emission' : truck.emissions.replace('_', ' ')],
    ['Engine', truck.engineCc ? `${formatNumber(truck.engineCc)} cc` : '—'],
    ['Power', truck.powerBhp ? `${truck.powerBhp} bhp` : '—'],
    ['Cab', truck.cabType ?? '—'],
    ['Wheelbase', truck.wheelbaseMm ? `${formatNumber(truck.wheelbaseMm)} mm` : '—'],
    ['Body length', truck.bodyLengthMm ? `${formatNumber(truck.bodyLengthMm)} mm` : '—'],
    ['Colour', truck.colour ?? '—'],
    ['Previous owners', truck.previousOwners != null ? String(truck.previousOwners) : '—'],
    ['MOT expiry', truck.motExpiry ? formatDate(truck.motExpiry) : '—'],
    ['Service history', truck.serviceHistory ?? '—'],
  ];

  // Hide rows we have no data for, except the handful buyers always look for.
  const ALWAYS_SHOWN = new Set(['Mileage', 'MOT expiry', 'Service history', 'Previous owners']);
  const visibleSpecs = specs.filter(([label, value]) => value !== '—' || ALWAYS_SHOWN.has(label));

  // Category-specific fields (e.g. "Cars" → doors, boot space) appended after
  // the standard specification, in the order staff set for this category.
  const customSpecs = formatCustomFieldsForDisplay(truck.category.fields, truck.customFields).map(
    (field) => [field.unit ? `${field.label} (${field.unit})` : field.label, field.display] as const,
  );

  // Structured data helps the listing appear as a rich result.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: truck.title,
    vehicleIdentificationNumber: undefined,
    sku: truck.stockNumber,
    brand: { '@type': 'Brand', name: truck.make.name },
    model: truck.modelName,
    vehicleModelDate: String(truck.year),
    productionDate: String(truck.year),
    bodyType: truck.category.name,
    fuelType: humanise(truck.fuelType),
    vehicleTransmission: humanise(truck.transmission),
    ...(truck.mileageKm
      ? { mileageFromOdometer: { '@type': 'QuantitativeValue', value: truck.mileageKm, unitCode: 'KMT' } }
      : {}),
    image: truck.images.map((image) => image.url),
    description: truck.shortDescription ?? truck.description ?? truck.title,
    offers: truck.priceOnApplication
      ? undefined
      : {
          '@type': 'Offer',
          price: (truck.priceNet / 100).toFixed(2),
          priceCurrency: 'GBP',
          availability:
            truck.status === 'AVAILABLE'
              ? 'https://schema.org/InStock'
              : truck.status === 'RESERVED'
                ? 'https://schema.org/LimitedAvailability'
                : 'https://schema.org/SoldOut',
          url: `${env.siteUrl}/trucks/${truck.slug}`,
          seller: { '@type': 'Organization', name: env.company.name },
        },
  };

  return (
    <div className="container-page py-8">
      <script
        type="application/ld+json"
        // Content is server-generated from our own database, not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Stock', href: '/trucks' },
          { label: truck.category.name, href: `/trucks?category=${truck.category.slug}` },
          { label: truck.title },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10">
        {/* ------------------------------------------------------- Main column */}
        <div className="min-w-0">
          <TruckGallery
            images={truck.images.map((image) => ({ id: image.id, url: image.url, alt: image.alt }))}
            title={truck.title}
          />

          {truck.description ? (
            <section className="mt-10">
              <h2 className="text-lg font-semibold">Description</h2>
              <div className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-steel-700">
                {truck.description}
              </div>
            </section>
          ) : null}

          {truck.features.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-lg font-semibold">Specification highlights</h2>
              <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {truck.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-steel-700">
                    <CheckIcon className="mt-0.5 shrink-0 text-emerald-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-10">
            <h2 className="text-lg font-semibold">Full specification</h2>
            <dl className="mt-3 grid gap-x-10 sm:grid-cols-2">
              {visibleSpecs.map(([label, value]) => (
                <DataRow key={label} label={label} value={value} className="border-b border-steel-100" />
              ))}
              {customSpecs.map(([label, value]) => (
                <DataRow key={label} label={label} value={value} className="border-b border-steel-100" />
              ))}
            </dl>
          </section>

          {truck.documents.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-lg font-semibold">Documents</h2>
              <ul className="mt-3 space-y-2">
                {truck.documents.map((document) => (
                  <li key={document.id}>
                    <a
                      href={document.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-steel-200 p-3 text-sm transition-colors hover:border-brand-300 hover:bg-brand-50"
                    >
                      <DocumentIcon className="text-lg text-steel-400" />
                      <span className="flex-1 font-medium text-steel-800">{document.title}</span>
                      <span className="text-xs text-steel-500">{humanise(document.type)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section id="enquire" className="mt-10 scroll-mt-28">
            <div className="panel">
              <h2 className="text-lg font-semibold">Enquire about this vehicle</h2>
              <p className="mt-1 text-sm text-steel-500">
                Ask a question, request more photographs, or book an inspection.
              </p>
              <EnquiryForm truckId={truck.id} vehicleTitle={truck.title} compact className="mt-5" />
            </div>
          </section>
        </div>

        {/* ------------------------------------------------------------ Sidebar */}
        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="panel">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={isAvailable ? 'success' : truck.status === 'RESERVED' ? 'warning' : 'danger'}>
                {humanise(truck.status)}
              </Badge>
              <span className="text-xs text-steel-400">Stock no. {truck.stockNumber}</span>
            </div>

            <h1 className="mt-3 text-xl font-bold leading-snug">{truck.title}</h1>

            <div className="mt-4 border-t border-steel-200 pt-4">
              <PriceBlock
                amountBase={truck.priceNet}
                vatTreatment={truck.vatTreatment}
                vatRate={truck.vatRate}
                priceOnApplication={truck.priceOnApplication}
                size="lg"
              />
              <p className="mt-2 text-xs leading-relaxed text-steel-500">
                {VAT_EXPLAINERS[truck.vatTreatment]}
              </p>
            </div>

            {!isAvailable ? (
              <Alert tone={truck.status === 'RESERVED' ? 'warning' : 'neutral'} className="mt-4">
                {truck.status === 'RESERVED'
                  ? 'This vehicle is currently reserved. Register your interest and we will contact you if it becomes available again.'
                  : 'This vehicle has been sold. Send us an enquiry and we will let you know when something similar arrives.'}
              </Alert>
            ) : null}

            <div className="mt-5 space-y-2.5">
              {isAvailable && !truck.priceOnApplication ? (
                <ReserveButton truckId={truck.id} depositLabel={depositLabel} />
              ) : null}

              <Link href="#enquire" className="btn-secondary w-full">
                {isAvailable ? 'Ask a question' : 'Find me something similar'}
              </Link>

              <SaveTruckButton truckId={truck.id} initialSaved={isSaved} title={truck.title} variant="full" />

              <CompareToggle truckId={truck.id} />
            </div>

            {isAvailable && !truck.priceOnApplication ? (
              <p className="mt-3 text-center text-xs leading-relaxed text-steel-500">
                A {depositLabel} deposit holds the vehicle for 7 days and comes off the final balance. Refundable in
                line with our{' '}
                <Link href="/legal/returns" className="underline underline-offset-2 hover:text-brand-600">
                  cancellation policy
                </Link>
                .
              </p>
            ) : null}

            <div className="mt-5 space-y-2.5 border-t border-steel-200 pt-5 text-sm">
              {settings.contactPhone ? (
                <a
                  href={`tel:${settings.contactPhone.replace(/\s/g, '')}`}
                  className="flex items-center gap-2.5 font-medium text-steel-800 hover:text-brand-700"
                >
                  <PhoneIcon className="text-steel-400" /> {settings.contactPhone}
                </a>
              ) : null}
              {truck.location ? (
                <p className="flex items-center gap-2.5 text-steel-600">
                  <MapPinIcon className="text-steel-400" /> {truck.location.name}, {truck.location.city}
                </p>
              ) : null}
              <p className="flex items-center gap-2.5 text-steel-600">
                <ShieldIcon className="text-steel-400" /> HPI checked · Workshop prepared
              </p>
              <p className="flex items-center gap-2.5 text-steel-600">
                <TruckIcon className="text-steel-400" /> UK delivery & export available
              </p>
            </div>
          </div>

          {!truck.priceOnApplication ? (
            <div className="mt-4">
              <FinanceCalculator
                priceNet={truck.priceNet}
                apr={settings.financeApr}
                currencySymbol={currency.symbol}
                currencyDecimals={currency.decimals}
                rate={currency.rateToBase}
                truckId={truck.id}
              />
            </div>
          ) : null}
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="mt-16 border-t border-steel-200 pt-12">
          <SectionHeading
            title="You might also like"
            description="Similar vehicles currently available."
            action={
              <Link href="/trucks" className="btn-secondary btn-sm">
                View all stock
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <Suspense key={item.id} fallback={<TruckCardSkeleton />}>
                <TruckCard truck={item} isSaved={savedRelatedIds.has(item.id)} />
              </Suspense>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
