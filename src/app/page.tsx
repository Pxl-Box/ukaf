import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { getFeaturedTrucks, getLatestTrucks, publicWhere } from '@/lib/trucks';
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { env } from '@/lib/env';
import { TruckCard, TruckCardSkeleton } from '@/components/TruckCard';
import { SectionHeading } from '@/components/ui/primitives';
import { HomeSearch } from '@/components/HomeSearch';
import {
  CheckCircleIcon,
  ChevronRightIcon,
  CurrencyIcon,
  DocumentIcon,
  ShieldIcon,
  TruckIcon,
} from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Used HGVs, tractor units & trailers for sale',
  alternates: { canonical: '/' },
};

export const revalidate = 300;

export default async function HomePage() {
  const [featured, latest, categories, makes, stats, settings, user] = await Promise.all([
    getFeaturedTrucks(4).catch(() => []),
    getLatestTrucks(8).catch(() => []),
    prisma.category
      .findMany({
        where: { isActive: true },
        select: {
          name: true,
          slug: true,
          description: true,
          imageUrl: true,
          _count: { select: { trucks: { where: publicWhere() } } },
        },
        orderBy: { sortOrder: 'asc' },
        take: 8,
      })
      .catch(() => []),
    prisma.make
      .findMany({
        where: { trucks: { some: publicWhere() } },
        select: { name: true, slug: true },
        orderBy: { name: 'asc' },
        take: 12,
      })
      .catch(() => []),
    prisma.truck.count({ where: { ...publicWhere(), status: 'AVAILABLE' } }).catch(() => 0),
    getSettings(),
    getCurrentUser().catch(() => null),
  ]);

  const savedIds = user
    ? new Set(
        (await prisma.savedTruck.findMany({ where: { userId: user.id }, select: { truckId: true } })).map(
          (entry) => entry.truckId,
        ),
      )
    : new Set<string>();

  const showcase = featured.length > 0 ? featured : latest.slice(0, 4);

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden bg-steel-950 text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(27,92,245,.35),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(245,163,11,.16),transparent_50%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]"
        />

        <div className="container-page relative py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-brand-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              {stats > 0 ? `${stats} vehicles in stock now` : 'New stock arriving weekly'}
            </p>

            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Commercial vehicles that are
              <span className="text-accent-500"> ready to work</span>
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-steel-300">
              Hand-picked used HGVs, tractor units, tippers and rigids — fully inspected, HPI clear and prepared in our
              own workshop. Buy online, reserve with a deposit, or talk to a specialist.
            </p>

            <div className="mt-8 max-w-2xl">
              <Suspense fallback={<div className="h-14 animate-pulse rounded-xl bg-white/10" />}>
                <HomeSearch />
              </Suspense>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/trucks" className="btn-accent btn-lg">
                Browse all stock
                <ChevronRightIcon />
              </Link>
              <Link
                href="/sell-your-truck"
                className="btn-lg border border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                Sell us your truck
              </Link>
            </div>

            <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-steel-300">
              {[
                'HPI checked & mileage verified',
                'Finance from 8.9% APR',
                'UK delivery & worldwide export',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircleIcon className="text-base text-emerald-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Trust strip */}
      <section className="border-b border-steel-200 bg-white">
        <div className="container-page grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: <ShieldIcon />,
              title: 'Inspected & warranted',
              body: 'Every vehicle is workshop-prepared with a fresh MOT and warranty options.',
            },
            {
              icon: <CurrencyIcon />,
              title: 'Prices in your currency',
              body: 'View stock in GBP, EUR, USD and more. Invoiced in GBP at the rate agreed.',
            },
            {
              icon: <DocumentIcon />,
              title: 'Full history supplied',
              body: 'Service records, V5C and MOT history provided with every sale.',
            },
            {
              icon: <TruckIcon />,
              title: 'Delivered to your yard',
              body: 'Nationwide transport and full export documentation handled in-house.',
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3.5">
              <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-lg text-brand-600">
                {item.icon}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-steel-950">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-steel-600">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- Categories */}
      {categories.length > 0 ? (
        <section className="section">
          <div className="container-page">
            <SectionHeading
              eyebrow="Shop by type"
              title="Find the right vehicle for the job"
              description="From 44-tonne tractor units to 7.5-tonne rigids, browse our stock by body type."
              action={
                <Link href="/trucks" className="btn-secondary btn-sm">
                  View all stock
                  <ChevronRightIcon />
                </Link>
              }
            />

            <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/trucks?category=${category.slug}`}
                    className="card-hover group flex h-full flex-col overflow-hidden"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-steel-100">
                      {category.imageUrl ? (
                        <Image
                          src={category.imageUrl}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 25vw, 50vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-4xl text-steel-300">
                          <TruckIcon />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="text-sm font-semibold text-steel-950 group-hover:text-brand-700">
                        {category.name}
                      </h3>
                      <p className="mt-1 text-xs text-steel-500">
                        {category._count.trucks} {category._count.trucks === 1 ? 'vehicle' : 'vehicles'}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------ Featured */}
      {showcase.length > 0 ? (
        <section className="section bg-white">
          <div className="container-page">
            <SectionHeading
              eyebrow={featured.length > 0 ? 'Featured stock' : 'Latest arrivals'}
              title={featured.length > 0 ? 'Pick of the current stock' : 'Just arrived'}
              description="Fully prepared and available for immediate collection or delivery."
              action={
                <Link href="/trucks" className="btn-secondary btn-sm">
                  See everything
                  <ChevronRightIcon />
                </Link>
              }
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {showcase.map((truck, index) => (
                <Suspense key={truck.id} fallback={<TruckCardSkeleton />}>
                  <TruckCard truck={truck} isSaved={savedIds.has(truck.id)} priority={index < 2} />
                </Suspense>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="section bg-white">
          <div className="container-page">
            <div className="rounded-xl border border-dashed border-steel-300 p-12 text-center">
              <TruckIcon className="mx-auto text-4xl text-steel-300" />
              <h2 className="mt-4 text-lg font-semibold">Stock is being loaded</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-steel-500">
                Our latest vehicles are being photographed and prepared. Register your requirements and we will contact
                you the moment something suitable arrives.
              </p>
              <Link href="/contact" className="btn-primary mt-6">
                Tell us what you need
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- Latest stock */}
      {latest.length > 4 ? (
        <section className="section">
          <div className="container-page">
            <SectionHeading eyebrow="Just in" title="Latest arrivals" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {latest.slice(0, 4).map((truck) => (
                <Suspense key={truck.id} fallback={<TruckCardSkeleton />}>
                  <TruckCard truck={truck} isSaved={savedIds.has(truck.id)} />
                </Suspense>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------------------- Makes */}
      {makes.length > 0 ? (
        <section className="border-y border-steel-200 bg-white py-10">
          <div className="container-page">
            <h2 className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.14em] text-steel-400">
              Manufacturers we stock
            </h2>
            <ul className="flex flex-wrap items-center justify-center gap-2">
              {makes.map((make) => (
                <li key={make.slug}>
                  <Link
                    href={`/trucks?make=${make.slug}`}
                    className="inline-block rounded-full border border-steel-200 px-4 py-1.5 text-sm font-medium text-steel-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {make.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------------------------- Finance */}
      <section className="section">
        <div className="container-page">
          <div className="grid items-center gap-10 rounded-2xl border border-steel-200 bg-white p-8 shadow-card lg:grid-cols-2 lg:p-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Finance & leasing</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Spread the cost from {settings.financeApr}% APR</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-steel-600">
                Hire purchase, finance lease and contract hire for limited companies, sole traders and partnerships.
                Decisions typically within 24 hours, and we work with lenders who understand commercial vehicles.
              </p>

              <ul className="mt-6 space-y-2.5 text-sm text-steel-700">
                {[
                  'Terms from 12 to 60 months',
                  'Deposits from 10%',
                  'Balloon payments available',
                  'New-start and adverse credit considered',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <CheckCircleIcon className="text-base text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/finance" className="btn-primary">
                  Apply for finance
                </Link>
                <Link href="/part-exchange" className="btn-secondary">
                  Value my part exchange
                </Link>
              </div>

              <p className="mt-5 text-xs leading-relaxed text-steel-400">
                Finance subject to status and available to business users only. {env.company.name} is a credit broker,
                not a lender, and may receive a commission from the lender.
              </p>
            </div>

            <div className="rounded-xl bg-steel-950 p-8 text-white">
              <p className="text-sm font-medium text-steel-400">Typical example</p>
              <p className="mt-4 text-4xl font-bold">
                £1,182<span className="text-lg font-medium text-steel-400">/month</span>
              </p>
              <dl className="mt-6 space-y-2.5 text-sm">
                {[
                  ['Vehicle price', '£58,500 + VAT'],
                  ['Deposit (10%)', '£5,850'],
                  ['Term', '48 months'],
                  ['Representative APR', `${settings.financeApr}%`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b border-white/10 pb-2.5">
                    <dt className="text-steel-400">{label}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-xs leading-relaxed text-steel-500">
                Illustration only. Actual payments depend on the vehicle, term, deposit and lender decision.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
