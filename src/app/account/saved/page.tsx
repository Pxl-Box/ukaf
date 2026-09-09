import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { TRUCK_CARD_SELECT } from '@/lib/trucks';
import { TruckCard, TruckCardSkeleton } from '@/components/TruckCard';
import { EmptyState } from '@/components/ui/primitives';
import { HeartIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Saved vehicles',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function SavedTrucksPage() {
  const user = await requireUser('/account/saved');

  const saved = await prisma.savedTruck.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, truck: { select: TRUCK_CARD_SELECT } },
  });

  const soldCount = saved.filter((entry) => entry.truck.status === 'SOLD').length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Saved vehicles</h1>
        <p className="mt-1 text-sm text-steel-500">
          {saved.length === 0
            ? 'Vehicles you save will be listed here.'
            : `${saved.length} saved${soldCount > 0 ? ` · ${soldCount} now sold` : ''}`}
        </p>
      </header>

      {saved.length === 0 ? (
        <EmptyState
          icon={<HeartIcon />}
          title="Nothing saved yet"
          description="Tap the heart on any vehicle to keep it here while you decide. We will tell you if the price changes."
          action={
            <Link href="/trucks" className="btn-primary">
              Browse stock
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {saved.map((entry) => (
            <Suspense key={entry.id} fallback={<TruckCardSkeleton />}>
              <TruckCard truck={entry.truck} isSaved />
            </Suspense>
          ))}
        </div>
      )}
    </div>
  );
}
