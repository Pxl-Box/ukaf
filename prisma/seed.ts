/**
 * Database seed.
 *
 * Creates the reference data the application needs to function (currencies,
 * categories, makes, a depot, an administrator) plus a realistic set of demo
 * stock so the storefront and CRM have something to show.
 *
 * Safe to re-run: everything is upserted on a natural key.
 *
 *   npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
// Relative import, not the `@/lib/...` alias — tsx runs this file without
// Next.js's path-alias resolution, so only relative imports work here.
import { generateDemoData, getDemoDataStatus } from '../src/lib/demo-data';

const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** Mirrors src/lib/password.ts — duplicated so the seed has no app imports. */
async function hashPassword(password: string): Promise<string> {
  const params = { N: 65536, r: 8, p: 1, maxmem: 128 * 65536 * 8 * 2 };
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, 64, params);
  return ['scrypt', params.N, params.r, params.p, salt.toString('hex'), derived.toString('hex')].join('$');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------

const CURRENCIES = [
  { code: 'GBP', name: 'British Pound', symbol: '£', rateToBase: 1, isBase: true, decimals: 2, roundTo: 1, sortOrder: 0 },
  { code: 'EUR', name: 'Euro', symbol: '€', rateToBase: 1.17, isBase: false, decimals: 2, roundTo: 100, sortOrder: 1 },
  { code: 'USD', name: 'US Dollar', symbol: '$', rateToBase: 1.27, isBase: false, decimals: 2, roundTo: 100, sortOrder: 2 },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł', rateToBase: 5.05, isBase: false, decimals: 2, roundTo: 1000, sortOrder: 3 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', rateToBase: 4.66, isBase: false, decimals: 2, roundTo: 100, sortOrder: 4 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', rateToBase: 23.4, isBase: false, decimals: 2, roundTo: 1000, sortOrder: 5 },
];

const CATEGORIES = [
  { name: 'Tractor Units', description: '4x2 and 6x2 units for artic work, from day cab to high-roof sleeper.', icon: 'truck', sortOrder: 1 },
  { name: 'Tippers', description: '8x4 and 6x4 tippers for muck-away, aggregate and construction work.', icon: 'tipper', sortOrder: 2 },
  { name: 'Curtainsiders', description: 'Rigid curtainsiders from 7.5t to 26t, many with tail lifts.', icon: 'curtain', sortOrder: 3 },
  { name: 'Box Vans', description: 'Box bodies for parcels, furniture and general distribution.', icon: 'box', sortOrder: 4 },
  { name: 'Refrigerated', description: 'Temperature-controlled rigids and trailers for chilled and frozen work.', icon: 'fridge', sortOrder: 5 },
  { name: 'Flatbeds & Dropsides', description: 'Flat and dropside bodies, many crane-equipped.', icon: 'flatbed', sortOrder: 6 },
  { name: 'Concrete Mixers', description: 'Volumetric and drum mixers on 8x4 chassis.', icon: 'mixer', sortOrder: 7 },
  { name: 'Trailers', description: 'Curtainside, box, tipping and skeletal trailers.', icon: 'trailer', sortOrder: 8 },
];

const MAKES = ['DAF', 'Scania', 'Volvo', 'MAN', 'Mercedes-Benz', 'Iveco', 'Renault Trucks', 'Isuzu'];

const LOCATIONS = [
  { name: 'Manchester HQ', line1: 'Unit 4, Trafford Park', city: 'Manchester', postcode: 'M17 1AB', phone: '+44 161 000 0000' },
  { name: 'Midlands Depot', line1: 'Kingsbury Road', city: 'Birmingham', postcode: 'B24 9PN', phone: '+44 121 000 0000' },
];

async function main() {
  console.log('Seeding UKAF database…\n');

  // ------------------------------------------------------------- Currencies
  for (const currency of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      create: { ...currency, isActive: true },
      // Rates are operational data — do not clobber live values on a re-seed.
      update: { name: currency.name, symbol: currency.symbol, isBase: currency.isBase },
    });
  }
  console.log(`  Currencies:  ${CURRENCIES.length}`);

  // ------------------------------------------------------------- Categories
  const categories = [];
  for (const category of CATEGORIES) {
    categories.push(
      await prisma.category.upsert({
        where: { slug: slugify(category.name) },
        create: { ...category, slug: slugify(category.name), isActive: true },
        update: { description: category.description, sortOrder: category.sortOrder },
      }),
    );
  }
  console.log(`  Categories:  ${categories.length}`);

  // ------------------------------------------------------------------ Makes
  const makes = [];
  for (const [index, name] of MAKES.entries()) {
    makes.push(
      await prisma.make.upsert({
        where: { slug: slugify(name) },
        create: { name, slug: slugify(name), sortOrder: index },
        update: { name },
      }),
    );
  }
  console.log(`  Makes:       ${makes.length}`);

  // -------------------------------------------------------------- Locations
  const locations = [];
  for (const location of LOCATIONS) {
    locations.push(
      await prisma.location.upsert({
        where: { slug: slugify(location.name) },
        create: { ...location, slug: slugify(location.name), country: 'GB', isActive: true },
        update: { city: location.city, phone: location.phone },
      }),
    );
  }
  console.log(`  Depots:      ${locations.length}`);

  // ------------------------------------------------------------------ Users
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@ukaf.co.uk').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2024';

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      firstName: 'Site',
      lastName: 'Administrator',
      role: 'SUPERADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    update: { role: 'SUPERADMIN', status: 'ACTIVE' },
  });

  // Default sales account for dev/testing — use this to sign in and then
  // promote/convert other accounts from /admin/users. MFA is deliberately
  // left off here (see mfaEnabled default) so it stays quick to use locally;
  // turn it on for real staff accounts once they're created.
  const salesRep = await prisma.user.upsert({
    where: { email: 'sales@ukaf.co.uk' },
    create: {
      email: 'sales@ukaf.co.uk',
      passwordHash: await hashPassword(adminPassword),
      firstName: 'Dani',
      lastName: 'Okafor',
      role: 'SALES',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+44 161 000 0001',
      mfaEnabled: false,
    },
    update: { role: 'SALES', status: 'ACTIVE', mfaEnabled: false },
  });

  console.log(`  Users:       2 (${adminEmail}, sales@ukaf.co.uk)`);

  // ---------------------------------------------------- Example stock & CRM
  // Delegates to src/lib/demo-data.ts so the seed script and the admin
  // "example data" toggle (/admin/settings) generate identical content and
  // never drift apart.
  const before = await getDemoDataStatus(prisma);
  const generated = await generateDemoData(prisma, {
    createdById: admin.id,
    assignedToId: salesRep.id,
  });

  console.log(
    `  Vehicles:    ${generated.trucksCreated > 0 ? generated.trucksCreated : before.truckCount} ${generated.trucksCreated > 0 ? '' : '(existing example stock left untouched)'}`,
  );
  console.log(
    `  Enquiries:   ${generated.leadsCreated > 0 ? generated.leadsCreated : before.leadCount} ${generated.leadsCreated > 0 ? '' : '(existing enquiries left untouched)'}`,
  );
  console.log(`  Testimonials: ${generated.testimonialsCreated > 0 ? generated.testimonialsCreated : before.testimonialCount}`);

  // ---------------------------------------------------------------- Settings
  await prisma.setting.upsert({
    where: { key: 'site' },
    create: {
      key: 'site',
      group: 'general',
      value: {
        siteName: process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'UKAF Commercials Ltd',
        tagline: 'Quality used HGVs, trailers and commercial vehicles, ready to work.',
        contactEmail: process.env.NEXT_PUBLIC_COMPANY_EMAIL ?? 'sales@ukaf.co.uk',
        contactPhone: process.env.NEXT_PUBLIC_COMPANY_PHONE ?? '+44 161 000 0000',
        address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? 'Unit 4, Trafford Park, Manchester, M17 1AB',
        openingHours: 'Mon–Fri 8:00–17:30 · Sat 9:00–13:00 · Sun closed',
        defaultReservationFee: 50_000,
        defaultVatRate: 2000,
        financeApr: 8.9,
        enableGuestCheckout: true,
        enableFullPurchase: false,
        maintenanceMode: false,
      },
    },
    update: {},
  });
  console.log('  Settings:    written');

  console.log('\nDone.\n');
  console.log('  Sign in at /login');
  console.log(`    Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`    Sales: sales@ukaf.co.uk / ${adminPassword}`);
  console.log('\n  Change these passwords before going anywhere near production.\n');
}

main()
  .catch((error) => {
    console.error('\nSeed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
