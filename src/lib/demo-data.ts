import type { Prisma, PrismaClient } from '@prisma/client';
import { slugify } from './utils';

/**
 * Demo/example data: generation and removal.
 *
 * Every row this module creates is stamped `isDemoData: true`, which is the
 * only thing that distinguishes "the 24 example vehicles the seed script
 * made" from "the vehicle a member of staff actually listed" — both live in
 * the same `trucks` table with the same shape. Nothing else in the app reads
 * this flag; it exists purely so demo content can be told apart from real
 * content and cleanly removed.
 *
 * Used by two callers that must behave identically:
 *   - `prisma/seed.ts` (CLI, run once when standing up a new database)
 *   - `/api/admin/demo-data` (the "example data" toggle in the admin)
 *
 * Only relative imports here — this file is loaded by `tsx` from
 * `prisma/seed.ts` without Next.js's path-alias resolution in the loop, so a
 * `@/lib/...` import would fail there even though it works fine from the app.
 */

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

export const DEMO_TRUCK_COUNT = 24;

/**
 * Vehicle profiles per body type. Keeping the model, axle configuration and
 * weight together means the generated demo stock is internally consistent —
 * a 44-tonne tractor unit is never described as a 7.5-tonne box van.
 */
const PROFILES: Record<
  string,
  {
    axleConfigs: string[];
    weights: number[];
    cabTypes: string[];
    models: Record<string, string[]>;
  }
> = {
  'tractor-units': {
    axleConfigs: ['4x2', '6x2'],
    weights: [40000, 44000],
    cabTypes: ['Sleeper', 'High roof sleeper', 'Space cab'],
    models: {
      DAF: ['XF 480', 'XF 530', 'XG 480'],
      Scania: ['R 450', 'R 500', 'S 500'],
      Volvo: ['FH 460', 'FH 500'],
      MAN: ['TGX 18.500', 'TGX 26.470'],
      'Mercedes-Benz': ['Actros 2545', 'Actros 1845'],
      Iveco: ['S-Way 460', 'Stralis 460'],
      'Renault Trucks': ['T 460', 'T 520'],
    },
  },
  tippers: {
    axleConfigs: ['8x4', '6x4'],
    weights: [32000, 26000],
    cabTypes: ['Day cab'],
    models: {
      DAF: ['CF 450'],
      Scania: ['G 410'],
      Volvo: ['FM 420'],
      MAN: ['TGS 32.400'],
      'Mercedes-Benz': ['Arocs 3240'],
      Iveco: ['Trakker 410'],
      'Renault Trucks': ['C 430'],
    },
  },
  curtainsiders: {
    axleConfigs: ['4x2', '6x2'],
    weights: [18000, 26000],
    cabTypes: ['Day cab', 'Sleeper'],
    models: {
      DAF: ['LF 260', 'CF 450'],
      Scania: ['P 280'],
      Volvo: ['FE 320'],
      MAN: ['TGM 18.290'],
      'Mercedes-Benz': ['Antos 1830', 'Atego 1524'],
      Iveco: ['Eurocargo 180E28'],
      'Renault Trucks': ['D 250'],
    },
  },
  'box-vans': {
    axleConfigs: ['4x2'],
    weights: [7500, 12000],
    cabTypes: ['Day cab'],
    models: {
      DAF: ['LF 260'],
      Isuzu: ['Forward N75', 'Forward F110'],
      'Mercedes-Benz': ['Atego 1524'],
      MAN: ['TGL 12.220'],
      Volvo: ['FL 250'],
      'Renault Trucks': ['D 250'],
    },
  },
  refrigerated: {
    axleConfigs: ['4x2', '6x2'],
    weights: [7500, 18000, 26000],
    cabTypes: ['Day cab', 'Sleeper'],
    models: {
      DAF: ['LF 260', 'CF 450'],
      Isuzu: ['Forward N75'],
      'Mercedes-Benz': ['Atego 1524', 'Antos 1830'],
      Volvo: ['FE 320'],
      Iveco: ['Eurocargo 180E28'],
    },
  },
  'flatbeds-dropsides': {
    axleConfigs: ['4x2', '6x2', '8x4'],
    weights: [7500, 18000, 32000],
    cabTypes: ['Day cab'],
    models: {
      DAF: ['LF 260', 'CF 450'],
      Isuzu: ['Grafter N35', 'Forward N75'],
      MAN: ['TGM 18.290'],
      Scania: ['P 280'],
      'Mercedes-Benz': ['Atego 1524'],
    },
  },
  'concrete-mixers': {
    axleConfigs: ['8x4'],
    weights: [32000],
    cabTypes: ['Day cab'],
    models: {
      'Mercedes-Benz': ['Arocs 3240'],
      MAN: ['TGS 32.400'],
      Scania: ['G 410'],
      Volvo: ['FM 420'],
      Iveco: ['Trakker 410'],
    },
  },
  trailers: {
    axleConfigs: ['Tri-axle', 'Tandem axle'],
    weights: [39000, 32000],
    cabTypes: [],
    models: {
      // Trailers are bodybuilder-branded rather than chassis-branded.
      DAF: ['Curtainside Trailer'],
      Scania: ['Box Trailer'],
      Volvo: ['Tipping Trailer'],
      MAN: ['Skeletal Trailer'],
      'Mercedes-Benz': ['Curtainside Trailer'],
      Iveco: ['Flat Trailer'],
      'Renault Trucks': ['Box Trailer'],
      Isuzu: ['Curtainside Trailer'],
    },
  },
};

const FEATURES = [
  'Full service history',
  'Fridge and night heater',
  'Cruise control',
  'Lane departure warning',
  'Adaptive cruise control',
  'Air conditioning',
  'Electric windows and mirrors',
  'Bluetooth hands-free',
  'Reversing camera',
  'Twin bunks',
  'Aluminium catwalk',
  'Alloy wheels',
  'Hydraulics fitted',
  'Tail lift',
  'Euro 6 emissions',
  'Recent MOT',
  'New tyres all round',
  'Tri-axle running gear',
];

const DEMO_LEADS = [
  { firstName: 'Marcus', lastName: 'Reid', company: 'Reid Haulage Ltd', status: 'NEW' as const, message: 'Interested in this unit. Can you tell me the plating date and whether it has a fridge?' },
  { firstName: 'Priya', lastName: 'Shah', company: 'Shah Logistics', status: 'CONTACTED' as const, message: 'Looking for two 6x2 units before the end of the quarter. What can you do on price for both?' },
  { firstName: 'Tom', lastName: 'Nowak', company: 'TN Transport', status: 'QUALIFIED' as const, message: 'Need a tipper for muck-away work. Finance would be helpful — we have been trading four years.' },
  { firstName: 'Aisha', lastName: 'Bello', company: 'Bello Freight', status: 'QUOTED' as const, message: 'Please send a written quote including delivery to Felixstowe.' },
  { firstName: 'Craig', lastName: 'Donnelly', company: null, status: 'NEGOTIATION' as const, message: 'Ready to move on this if we can agree a part exchange figure for my current unit.' },
  { firstName: 'Elena', lastName: 'Vasquez', company: 'Iberia Transportes', status: 'NEW' as const, message: 'Enquiring about export to Spain. Do you handle the documentation?' },
];

const DEMO_TESTIMONIALS = [
  { authorName: 'Marcus Reid', company: 'Reid Haulage', rating: 5, body: 'Straightforward buying process and the truck was exactly as described. Delivered to our yard in Aberdeen two days after we paid.' },
  { authorName: 'Priya Shah', company: 'Shah Logistics', rating: 5, body: 'Third unit we have bought from UKAF. They tell you what is wrong with a vehicle before you ask, which is rarer than it should be.' },
  { authorName: 'Tom Nowak', company: 'TN Transport', rating: 4, body: 'Finance was sorted in a day and the tipper has been faultless for six months. Only gripe is I would have liked more photos before the viewing.' },
];

// ---------------------------------------------------------------------------
// Small deterministic PRNG so a given run is reproducible for debugging.
// ---------------------------------------------------------------------------

function makeRandom(seed = 42) {
  let state = seed;
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const between = (min: number, max: number) => Math.floor(min + random() * (max - min + 1));
  return { pick, between };
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type DemoDataStatus = {
  truckCount: number;
  leadCount: number;
  testimonialCount: number;
  /** Whether makes/categories/locations exist for generation to attach to. */
  hasReferenceData: boolean;
};

export async function getDemoDataStatus(prisma: PrismaClient): Promise<DemoDataStatus> {
  const [truckCount, leadCount, testimonialCount, makeCount, categoryCount] = await Promise.all([
    prisma.truck.count({ where: { isDemoData: true } }),
    prisma.lead.count({ where: { isDemoData: true } }),
    prisma.testimonial.count({ where: { isDemoData: true } }),
    prisma.make.count(),
    prisma.category.count(),
  ]);

  return {
    truckCount,
    leadCount,
    testimonialCount,
    hasReferenceData: makeCount > 0 && categoryCount > 0,
  };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export type GenerateDemoDataResult = {
  trucksCreated: number;
  leadsCreated: number;
  testimonialsCreated: number;
};

/**
 * Creates the example vehicles (and, if there is stock to point them at, the
 * example enquiries and testimonials). Idempotent by design: if demo trucks
 * already exist, does nothing and returns zero counts — this is what makes
 * "switch demo data back on" a safe, repeatable action rather than something
 * that piles up duplicates if pressed twice.
 *
 * Requires reference data (at least one Make and Category) to already exist —
 * that's taxonomy real listings need too, so it is never itself demo data and
 * is never removed by `clearDemoData`. Run the seed script first on a brand
 * new database.
 */
export async function generateDemoData(
  prisma: PrismaClient,
  options: { createdById: string; assignedToId?: string },
): Promise<GenerateDemoDataResult> {
  const status = await getDemoDataStatus(prisma);

  if (!status.hasReferenceData) {
    throw new Error(
      'No makes or categories exist yet. Run `npm run db:seed` once to set up reference data before generating example stock.',
    );
  }

  const result: GenerateDemoDataResult = { trucksCreated: 0, leadsCreated: 0, testimonialsCreated: 0 };

  if (status.truckCount === 0) {
    result.trucksCreated = await generateDemoTrucks(prisma, options.createdById);
  }

  if (status.leadCount === 0 && options.assignedToId) {
    result.leadsCreated = await generateDemoLeads(prisma, options.assignedToId);
  }

  if (status.testimonialCount === 0) {
    result.testimonialsCreated = await generateDemoTestimonials(prisma);
  }

  return result;
}

async function generateDemoTrucks(prisma: PrismaClient, createdById: string): Promise<number> {
  const [makes, categories, locations] = await Promise.all([
    prisma.make.findMany(),
    prisma.category.findMany(),
    prisma.location.findMany(),
  ]);

  if (makes.length === 0 || categories.length === 0) return 0;

  const { pick, between } = makeRandom();
  const conditions = ['USED', 'USED', 'USED', 'EX_DEMO'] as const;
  const transmissions = ['AUTOMATIC', 'AUTOMATIC', 'AUTOMATIC', 'MANUAL'] as const;
  const emissions = ['EURO_6', 'EURO_6', 'EURO_6', 'EURO_5'] as const;
  const colours = ['White', 'Silver', 'Blue', 'Red', 'Grey', 'Black'];

  // Existing stock numbers determine where the UK-1000... sequence resumes,
  // so re-generating after a partial clear never collides.
  const highestStockNumber = await prisma.truck.findFirst({
    where: { stockNumber: { startsWith: 'UK-' } },
    orderBy: { stockNumber: 'desc' },
    select: { stockNumber: true },
  });
  const startAt = highestStockNumber
    ? Number(highestStockNumber.stockNumber.replace('UK-', '')) + 1
    : 1000;

  const trucks: Prisma.TruckCreateInput[] = [];

  for (let index = 0; index < DEMO_TRUCK_COUNT; index += 1) {
    const category = categories[index % categories.length];
    const profile = PROFILES[category.slug] ?? PROFILES['tractor-units'];

    const eligibleMakes = makes.filter((entry) => profile.models[entry.name]?.length);
    const make = pick(eligibleMakes.length > 0 ? eligibleMakes : makes);
    const modelName = pick(profile.models[make.name] ?? ['Unknown']);

    const axleConfig = pick(profile.axleConfigs);
    const grossWeightKg = pick(profile.weights);
    const isTrailer = category.slug === 'trailers';
    const year = between(2017, 2023);
    const age = new Date().getFullYear() - year;

    const basePrice = Math.max(14_000, 78_000 - age * 8_500 + between(-6_000, 9_000));
    const priceNet = Math.round(basePrice / 250) * 250 * 100;

    const stockNumber = `UK-${String(startAt + index)}`;
    const title = isTrailer
      ? `${year} ${modelName} ${axleConfig}`
      : `${year} ${make.name} ${modelName} ${axleConfig} ${category.name.replace(/s$/, '')}`;

    const featureCount = between(4, 8);
    const features: string[] = [];
    while (features.length < featureCount) {
      const feature = pick(FEATURES);
      if (!features.includes(feature)) features.push(feature);
    }

    const status =
      index < 18 ? 'AVAILABLE' : index < 21 ? 'AVAILABLE' : index < 23 ? 'RESERVED' : 'SOLD';

    trucks.push({
      stockNumber,
      slug: `${slugify(title)}-${stockNumber.toLowerCase()}`,
      title,
      make: { connect: { id: make.id } },
      modelName,
      category: { connect: { id: category.id } },
      ...(locations.length > 0 ? { location: { connect: { id: pick(locations).id } } } : {}),
      year,
      mileageKm: between(180_000, 780_000),
      condition: pick(conditions),
      fuelType: 'DIESEL',
      transmission: pick(transmissions),
      gears: isTrailer ? null : pick([6, 8, 12]),
      emissions: pick(emissions),
      axleConfig,
      cabType: profile.cabTypes.length > 0 ? pick(profile.cabTypes) : null,
      grossWeightKg,
      payloadKg: Math.round(grossWeightKg * (isTrailer ? 0.72 : 0.58)),
      engineCc: isTrailer ? null : grossWeightKg >= 32000 ? pick([12780, 12902, 10837]) : pick([5193, 6871, 7700]),
      powerBhp: isTrailer ? null : grossWeightKg >= 32000 ? pick([410, 450, 480, 500, 530]) : pick([220, 260, 320]),
      colour: pick(colours),
      previousOwners: between(1, 3),
      motExpiry: new Date(Date.now() + between(60, 330) * 24 * 60 * 60 * 1000),
      serviceHistory: pick(['Full main dealer', 'Full service history', 'Partial history', 'Full fleet history']),
      registration: `${pick(['AB', 'CD', 'EF', 'GH'])}${String(year).slice(-2)} ${pick(['XYZ', 'ABC', 'DEF', 'GHJ'])}`,
      costPriceNet: Math.round(priceNet * 0.86),
      priceNet,
      vatTreatment: pick(['PLUS_VAT', 'PLUS_VAT', 'PLUS_VAT', 'MARGIN_SCHEME'] as const),
      vatRate: 2000,
      reservationFee: 50_000,
      status,
      featured: index < 4,
      isDemoData: true,
      publishedAt: new Date(Date.now() - between(0, 60) * 24 * 60 * 60 * 1000),
      soldAt: status === 'SOLD' ? new Date() : null,
      shortDescription: `${year} ${make.name} ${modelName}, ${pick(['well maintained', 'direct from fleet', 'one owner from new', 'workshop prepared'])}, ready for work.`,
      description: [
        `A ${year} ${make.name} ${modelName} that has come to us ${pick(['direct from a national fleet', 'from a long-standing local operator', 'as a part exchange against a new vehicle'])}.`,
        '',
        `It has been through our workshop for a full inspection and service. ${pick(['Everything works as it should.', 'The only work needed was a service and a set of front tyres, both done.', 'We have replaced the brake pads and given it a full valet.'])}`,
        '',
        `The paint is ${pick(['very good for the age', 'tidy with a few stone chips', 'excellent', 'good, with the usual marks from working life'])} and the interior is ${pick(['clean', 'very clean', 'tidy', 'well looked after'])}. Full documentation is available and we are happy to arrange an independent inspection.`,
        '',
        'Finance, part exchange, UK delivery and export all available. Call us to arrange a viewing.',
      ].join('\n'),
      features,
      createdBy: { connect: { id: createdById } },
      images: {
        create: [
          {
            url: '/images/placeholder-truck.svg',
            alt: `${title} — photograph to follow`,
            sortOrder: 0,
            isPrimary: true,
          },
        ],
      },
    });
  }

  for (const truck of trucks) {
    await prisma.truck.create({ data: truck });
  }

  return trucks.length;
}

async function generateDemoLeads(prisma: PrismaClient, assignedToId: string): Promise<number> {
  const availableTrucks = await prisma.truck.findMany({
    where: { status: 'AVAILABLE' },
    select: { id: true, priceNet: true },
    take: 6,
  });

  const { between } = makeRandom(7);

  for (const [index, lead] of DEMO_LEADS.entries()) {
    const truck = availableTrucks[index % Math.max(1, availableTrucks.length)];

    await prisma.lead.create({
      data: {
        ref: `ENQ-DEMO${index + 1}`,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: `${lead.firstName.toLowerCase()}.${lead.lastName.toLowerCase()}@example.com`,
        phone: `+44 7700 9000${index}${index}`,
        company: lead.company,
        message: lead.message,
        status: lead.status,
        source: truck ? 'VEHICLE_ENQUIRY' : 'WEBSITE_ENQUIRY',
        truckId: truck?.id,
        assignedToId,
        estimatedValue: truck?.priceNet,
        score: between(35, 90),
        isDemoData: true,
        nextActionAt: new Date(Date.now() + between(-2, 5) * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - between(1, 21) * 24 * 60 * 60 * 1000),
        activities: {
          create: {
            type: 'SYSTEM',
            subject: 'Enquiry received',
            body: 'Demo enquiry created by the example-data generator.',
            completedAt: new Date(),
          },
        },
      },
    });
  }

  return DEMO_LEADS.length;
}

async function generateDemoTestimonials(prisma: PrismaClient): Promise<number> {
  let created = 0;
  for (const testimonial of DEMO_TESTIMONIALS) {
    const exists = await prisma.testimonial.findFirst({ where: { authorName: testimonial.authorName } });
    if (!exists) {
      await prisma.testimonial.create({
        data: { ...testimonial, isApproved: true, isFeatured: true, isDemoData: true },
      });
      created += 1;
    }
  }
  return created;
}

// ---------------------------------------------------------------------------
// Removal
// ---------------------------------------------------------------------------

export type ClearDemoDataResult = {
  trucksDeleted: number;
  /** Demo trucks that already have real order history — kept, but unflagged. */
  trucksKeptWithOrders: string[];
  leadsDeleted: number;
  testimonialsDeleted: number;
};

/**
 * Removes every row flagged `isDemoData`, and only those rows — anything a
 * member of staff created by hand (no flag set) is untouched. Reference data
 * (makes, categories, locations, currencies) is never touched either way,
 * since real listings need it too.
 *
 * A demo vehicle that has genuinely been ordered (only realistically possible
 * if someone tested a purchase against example stock) is not deleted — order
 * history must never be destroyed. It is unflagged instead, so it quietly
 * becomes an ordinary listing rather than disappearing or being deleted out
 * from under its order.
 */
export async function clearDemoData(prisma: PrismaClient): Promise<ClearDemoDataResult> {
  // Demo leads first — this cascades their Activity rows automatically.
  const { count: leadsDeleted } = await prisma.lead.deleteMany({ where: { isDemoData: true } });

  const { count: testimonialsDeleted } = await prisma.testimonial.deleteMany({
    where: { isDemoData: true },
  });

  const demoTrucks = await prisma.truck.findMany({
    where: { isDemoData: true },
    select: { id: true, stockNumber: true, _count: { select: { orderItems: true } } },
  });

  const deletableIds = demoTrucks.filter((truck) => truck._count.orderItems === 0).map((truck) => truck.id);
  const keepIds = demoTrucks.filter((truck) => truck._count.orderItems > 0);

  if (deletableIds.length > 0) {
    // Any surviving (non-demo, e.g. real) leads or finance enquiries that
    // happen to point at a demo vehicle would otherwise block the delete via
    // the foreign key — unlink rather than delete those rows, since they
    // belong to a real customer.
    await prisma.lead.updateMany({
      where: { truckId: { in: deletableIds } },
      data: { truckId: null },
    });
    await prisma.financeApplication.updateMany({
      where: { truckId: { in: deletableIds } },
      data: { truckId: null },
    });

    // Images, documents, price history, cart items and saved-vehicle rows
    // all cascade automatically from the schema.
    await prisma.truck.deleteMany({ where: { id: { in: deletableIds } } });
  }

  if (keepIds.length > 0) {
    await prisma.truck.updateMany({
      where: { id: { in: keepIds.map((truck) => truck.id) } },
      data: { isDemoData: false },
    });
  }

  return {
    trucksDeleted: deletableIds.length,
    trucksKeptWithOrders: keepIds.map((truck) => truck.stockNumber),
    leadsDeleted,
    testimonialsDeleted,
  };
}
