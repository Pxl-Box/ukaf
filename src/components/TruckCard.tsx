import Image from 'next/image';
import Link from 'next/link';
import type { TruckCard as TruckCardData } from '@/lib/trucks';
import { cn, formatMileage, formatWeight, humanise, PLACEHOLDER_IMAGE } from '@/lib/utils';
import { PriceBlock } from './ui/Price';
import { Badge } from './ui/primitives';
import { SaveTruckButton } from './SaveTruckButton';
import { CalendarIcon, GaugeIcon, CogIcon, LeafIcon } from './ui/Icons';

const STATUS_BADGE: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  AVAILABLE: { label: 'Available', tone: 'success' },
  RESERVED: { label: 'Reserved', tone: 'warning' },
  SOLD: { label: 'Sold', tone: 'danger' },
  DRAFT: { label: 'Draft', tone: 'neutral' },
  ARCHIVED: { label: 'Archived', tone: 'neutral' },
};

export async function TruckCard({
  truck,
  isSaved = false,
  priority = false,
  className,
}: {
  truck: TruckCardData;
  isSaved?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const image = truck.images[0];
  const status = STATUS_BADGE[truck.status] ?? STATUS_BADGE.AVAILABLE;
  const isSold = truck.status === 'SOLD';

  return (
    <article
      className={cn(
        'card-hover group relative flex flex-col overflow-hidden',
        isSold && 'opacity-90',
        className,
      )}
    >
      {/*
        No link around the image: the whole card is already clickable via the
        heading's inset ::after overlay, so an extra aria-hidden link would only
        add a duplicate target for assistive technology.
      */}
      <div className="relative aspect-[4/3] overflow-hidden bg-steel-100 dark:bg-steel-800">
        <Image
          src={image?.url ?? PLACEHOLDER_IMAGE}
          alt={image?.alt ?? truck.title}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
          priority={priority}
          className={cn(
            'object-cover transition-transform duration-300 group-hover:scale-[1.03]',
            isSold && 'grayscale-[35%]',
          )}
        />

        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
          {truck.status !== 'AVAILABLE' ? <Badge tone={status.tone}>{status.label}</Badge> : null}
          {truck.featured && truck.status === 'AVAILABLE' ? (
            <Badge tone="info" className="bg-brand-600 text-white">
              Featured
            </Badge>
          ) : null}
          {truck.condition === 'NEW' ? <Badge tone="success">New</Badge> : null}
        </div>

        <div className="absolute right-2.5 top-2.5">
          <SaveTruckButton truckId={truck.id} initialSaved={isSaved} title={truck.title} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
          {truck.make.name} · {truck.category.name}
        </p>

        <h3 className="mt-1 text-[15px] font-semibold leading-snug text-steel-950 dark:text-white">
          <Link href={`/trucks/${truck.slug}`} className="after:absolute after:inset-0 hover:text-brand-700">
            {truck.title}
          </Link>
        </h3>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-steel-600 dark:text-steel-400">
          <Spec icon={<CalendarIcon />} label="Year" value={String(truck.year)} />
          <Spec icon={<GaugeIcon />} label="Mileage" value={formatMileage(truck.mileageKm)} />
          <Spec icon={<CogIcon />} label="Gearbox" value={humanise(truck.transmission)} />
          <Spec
            icon={<LeafIcon />}
            label="Emissions"
            value={truck.emissions === 'ZERO_EMISSION' ? 'Zero emission' : truck.emissions.replace('_', ' ')}
          />
        </dl>

        {truck.axleConfig || truck.grossWeightKg || truck.powerBhp ? (
          <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-steel-500 dark:text-steel-400">
            {truck.axleConfig ? (
              <span className="rounded bg-steel-100 px-1.5 py-0.5 dark:bg-steel-800">{truck.axleConfig}</span>
            ) : null}
            {truck.grossWeightKg ? (
              <span className="rounded bg-steel-100 px-1.5 py-0.5 dark:bg-steel-800">
                {formatWeight(truck.grossWeightKg)} GVW
              </span>
            ) : null}
            {truck.powerBhp ? (
              <span className="rounded bg-steel-100 px-1.5 py-0.5 dark:bg-steel-800">{truck.powerBhp} bhp</span>
            ) : null}
          </p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <PriceBlock
            amountBase={truck.priceNet}
            vatTreatment={truck.vatTreatment}
            vatRate={truck.vatRate}
            priceOnApplication={truck.priceOnApplication}
            size="sm"
          />
          {truck.location ? (
            <p className="pb-0.5 text-right text-[11px] text-steel-400 dark:text-steel-500">{truck.location.city}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 text-steel-400">{icon}</span>
      <span className="sr-only">{label}: </span>
      <span className="truncate">{value}</span>
    </div>
  );
}

/** Loading placeholder matching the card's shape, for Suspense boundaries. */
export function TruckCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="aspect-[4/3] animate-pulse bg-steel-200" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-steel-200" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-steel-200" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-3 animate-pulse rounded bg-steel-100" />
          ))}
        </div>
        <div className="h-6 w-1/2 animate-pulse rounded bg-steel-200" />
      </div>
    </div>
  );
}
