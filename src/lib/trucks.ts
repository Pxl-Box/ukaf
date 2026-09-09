import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import type { TruckFilterInput } from './validation';

/**
 * Catalogue queries.
 *
 * Everything here is composed with Prisma's typed query builder, which emits
 * parameterised SQL — user-supplied filters and search terms are never
 * interpolated into a statement.
 */

export const PUBLIC_TRUCK_SELECT = {
  id: true,
  slug: true,
  stockNumber: true,
  title: true,
  modelName: true,
  variant: true,
  year: true,
  mileageKm: true,
  condition: true,
  fuelType: true,
  transmission: true,
  gears: true,
  emissions: true,
  axleConfig: true,
  cabType: true,
  bodyLengthMm: true,
  wheelbaseMm: true,
  grossWeightKg: true,
  payloadKg: true,
  engineCc: true,
  powerBhp: true,
  colour: true,
  previousOwners: true,
  motExpiry: true,
  serviceHistory: true,
  priceNet: true,
  retailPriceNet: true,
  vatTreatment: true,
  vatRate: true,
  priceOnApplication: true,
  reservationFee: true,
  status: true,
  featured: true,
  quantity: true,
  shortDescription: true,
  description: true,
  features: true,
  metaTitle: true,
  metaDescription: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
  customFields: true,
  make: { select: { id: true, name: true, slug: true, logoUrl: true } },
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      fields: { orderBy: { sortOrder: 'asc' } },
    },
  },
  location: { select: { id: true, name: true, city: true, slug: true } },
  images: {
    select: { id: true, url: true, alt: true, isPrimary: true, sortOrder: true },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] as const,
  },
  documents: {
    where: { isPublic: true },
    select: { id: true, title: true, url: true, type: true },
  },
} satisfies Prisma.TruckSelect;

export type PublicTruck = Prisma.TruckGetPayload<{ select: typeof PUBLIC_TRUCK_SELECT }>;

/** Card-sized projection for grids and carousels. */
export const TRUCK_CARD_SELECT = {
  id: true,
  slug: true,
  stockNumber: true,
  title: true,
  year: true,
  mileageKm: true,
  priceNet: true,
  retailPriceNet: true,
  vatTreatment: true,
  vatRate: true,
  priceOnApplication: true,
  status: true,
  featured: true,
  condition: true,
  fuelType: true,
  transmission: true,
  emissions: true,
  axleConfig: true,
  grossWeightKg: true,
  powerBhp: true,
  shortDescription: true,
  make: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
  location: { select: { name: true, city: true } },
  images: {
    select: { url: true, alt: true, isPrimary: true },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] as const,
    take: 1,
  },
} satisfies Prisma.TruckSelect;

export type TruckCard = Prisma.TruckGetPayload<{ select: typeof TRUCK_CARD_SELECT }>;

/** Statuses a visitor is allowed to see. Sold stock stays visible for SEO. */
const PUBLIC_STATUSES: Prisma.EnumStockStatusFilter = { in: ['AVAILABLE', 'RESERVED', 'SOLD'] };

export function publicWhere(): Prisma.TruckWhereInput {
  return { status: PUBLIC_STATUSES, publishedAt: { not: null } };
}

/** Translates parsed query-string filters into a Prisma `where` clause. */
export function buildTruckWhere(
  filters: Partial<TruckFilterInput>,
  /**
   * Raw `cf_<key>=<value>` query parameters for the selected category's
   * admin-defined filter fields — see `buildCustomFieldWhere` in
   * `@/lib/category-fields`. Optional because most callers (facets, the
   * homepage, related-vehicle lookups) never filter on these.
   */
  customFieldClauses: Prisma.TruckWhereInput[] = [],
): Prisma.TruckWhereInput {
  const where: Prisma.TruckWhereInput = { ...publicWhere() };
  const and: Prisma.TruckWhereInput[] = [...customFieldClauses];

  if (filters.q) {
    const term = filters.q.trim();
    and.push({
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { modelName: { contains: term, mode: 'insensitive' } },
        { variant: { contains: term, mode: 'insensitive' } },
        { stockNumber: { contains: term, mode: 'insensitive' } },
        { shortDescription: { contains: term, mode: 'insensitive' } },
        { make: { name: { contains: term, mode: 'insensitive' } } },
        { category: { name: { contains: term, mode: 'insensitive' } } },
      ],
    });
  }

  if (filters.make) where.make = { slug: filters.make };
  if (filters.category) where.category = { slug: filters.category };
  if (filters.location) where.location = { slug: filters.location };
  if (filters.condition) where.condition = filters.condition;
  if (filters.fuelType) where.fuelType = filters.fuelType;
  if (filters.transmission) where.transmission = filters.transmission;
  if (filters.emissions) where.emissions = filters.emissions;
  if (filters.axleConfig) where.axleConfig = filters.axleConfig;

  if (filters.minPrice != null || filters.maxPrice != null) {
    where.priceNet = {
      ...(filters.minPrice != null ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice != null ? { lte: filters.maxPrice } : {}),
    };
  }

  if (filters.minYear != null || filters.maxYear != null) {
    where.year = {
      ...(filters.minYear != null ? { gte: filters.minYear } : {}),
      ...(filters.maxYear != null ? { lte: filters.maxYear } : {}),
    };
  }

  if (filters.maxMileage != null) {
    where.mileageKm = { lte: filters.maxMileage };
  }

  if (and.length > 0) where.AND = and;
  return where;
}

export function buildTruckOrderBy(
  sort: TruckFilterInput['sort'] = 'newest',
): Prisma.TruckOrderByWithRelationInput[] {
  switch (sort) {
    case 'price-asc':
      return [{ priceOnApplication: 'asc' }, { priceNet: 'asc' }];
    case 'price-desc':
      return [{ priceOnApplication: 'asc' }, { priceNet: 'desc' }];
    case 'year-desc':
      return [{ year: 'desc' }, { createdAt: 'desc' }];
    case 'year-asc':
      return [{ year: 'asc' }, { createdAt: 'desc' }];
    case 'mileage-asc':
      return [{ mileageKm: 'asc' }, { createdAt: 'desc' }];
    case 'popular':
      return [{ viewCount: 'desc' }, { createdAt: 'desc' }];
    case 'newest':
    default:
      // Available stock always outranks sold stock, then newest first.
      return [{ status: 'asc' }, { featured: 'desc' }, { publishedAt: 'desc' }];
  }
}

export type TruckSearchResult = {
  trucks: TruckCard[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

export async function searchTrucks(
  filters: Partial<TruckFilterInput>,
  { limit = 12, customFieldClauses = [] }: { limit?: number; customFieldClauses?: Prisma.TruckWhereInput[] } = {},
): Promise<TruckSearchResult> {
  const page = Math.max(1, filters.page ?? 1);
  const where = buildTruckWhere(filters, customFieldClauses);

  const [total, trucks] = await Promise.all([
    prisma.truck.count({ where }),
    prisma.truck.findMany({
      where,
      select: TRUCK_CARD_SELECT,
      orderBy: buildTruckOrderBy(filters.sort),
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { trucks, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}

export async function getTruckBySlug(slug: string): Promise<PublicTruck | null> {
  return prisma.truck.findFirst({
    where: { slug, ...publicWhere() },
    select: PUBLIC_TRUCK_SELECT,
  });
}

/** Fire-and-forget view counter; never blocks the render. */
export function incrementViewCount(id: string): void {
  void prisma.truck
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);
}

export async function getFeaturedTrucks(take = 6): Promise<TruckCard[]> {
  return prisma.truck.findMany({
    where: { ...publicWhere(), status: 'AVAILABLE', featured: true },
    select: TRUCK_CARD_SELECT,
    orderBy: [{ publishedAt: 'desc' }],
    take,
  });
}

export async function getLatestTrucks(take = 8): Promise<TruckCard[]> {
  return prisma.truck.findMany({
    where: { ...publicWhere(), status: 'AVAILABLE' },
    select: TRUCK_CARD_SELECT,
    orderBy: [{ publishedAt: 'desc' }],
    take,
  });
}

/** Same body type or make, similar money — used on the vehicle detail page. */
export async function getRelatedTrucks(truck: PublicTruck, take = 4): Promise<TruckCard[]> {
  const spread = Math.max(1_000_00, Math.round(truck.priceNet * 0.35));

  return prisma.truck.findMany({
    where: {
      ...publicWhere(),
      status: 'AVAILABLE',
      id: { not: truck.id },
      OR: [
        { categoryId: truck.category.id },
        { makeId: truck.make.id },
        { priceNet: { gte: truck.priceNet - spread, lte: truck.priceNet + spread } },
      ],
    },
    select: TRUCK_CARD_SELECT,
    orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
    take,
  });
}

/** Facet counts and price bounds that drive the filter sidebar. */
export async function getFilterFacets() {
  const [makes, categories, locations, bounds, axleConfigs] = await Promise.all([
    prisma.make.findMany({
      where: { trucks: { some: publicWhere() } },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { trucks: { where: publicWhere() } } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        _count: { select: { trucks: { where: publicWhere() } } },
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.location.findMany({
      where: { isActive: true },
      select: { id: true, name: true, city: true, slug: true },
      orderBy: { name: 'asc' },
    }),
    prisma.truck.aggregate({
      where: { ...publicWhere(), priceOnApplication: false },
      _min: { priceNet: true, year: true, mileageKm: true },
      _max: { priceNet: true, year: true, mileageKm: true },
    }),
    prisma.truck.groupBy({
      by: ['axleConfig'],
      where: { ...publicWhere(), axleConfig: { not: null } },
      _count: { _all: true },
      orderBy: { axleConfig: 'asc' },
    }),
  ]);

  return {
    makes: makes.filter((make) => make._count.trucks > 0),
    categories,
    locations,
    axleConfigs: axleConfigs
      .filter((entry): entry is typeof entry & { axleConfig: string } => Boolean(entry.axleConfig))
      .map((entry) => ({ value: entry.axleConfig, count: entry._count._all })),
    priceMin: bounds._min.priceNet ?? 0,
    priceMax: bounds._max.priceNet ?? 20_000_000,
    yearMin: bounds._min.year ?? 2000,
    yearMax: bounds._max.year ?? new Date().getFullYear(),
    mileageMax: bounds._max.mileageKm ?? 1_000_000,
  };
}

export type FilterFacets = Awaited<ReturnType<typeof getFilterFacets>>;

/**
 * The admin-defined fields for one category that are switched on as public
 * filters — e.g. "Cars" → "Transmission style" as a select filter. Returns
 * an empty array when no category is selected or it has none.
 */
export async function getCategoryFilterFields(categorySlug: string | undefined) {
  if (!categorySlug) return [];

  return prisma.categoryField.findMany({
    where: { showInFilters: true, category: { slug: categorySlug } },
    orderBy: { sortOrder: 'asc' },
  });
}
