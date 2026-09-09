import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { getLatestTrucks } from '@/lib/trucks';
import { TruckCard } from '@/components/TruckCard';
import { TruckIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

export default async function NotFound() {
  // A dead end is a good place to show stock rather than an apology.
  const [trucks, categories] = await Promise.all([
    getLatestTrucks(4).catch(() => []),
    prisma.category
      .findMany({ where: { isActive: true }, select: { name: true, slug: true }, take: 6 })
      .catch(() => []),
  ]);

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-xl text-center">
        <TruckIcon className="mx-auto text-5xl text-steel-300" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">Error 404</p>
        <h1 className="mt-2 text-3xl font-bold">We could not find that page</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-steel-600">
          The link may be out of date, or the vehicle may have been sold and archived. Try searching our current stock
          instead.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/trucks" className="btn-primary">
            Browse all stock
          </Link>
          <Link href="/contact" className="btn-secondary">
            Tell us what you need
          </Link>
        </div>

        {categories.length > 0 ? (
          <ul className="mt-8 flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/trucks?category=${category.slug}`}
                  className="inline-block rounded-full border border-steel-200 bg-white px-3.5 py-1.5 text-sm text-steel-600 hover:border-brand-300 hover:text-brand-700"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {trucks.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-6 text-center text-lg font-semibold">Latest arrivals</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trucks.map((truck) => (
              <TruckCard key={truck.id} truck={truck} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
