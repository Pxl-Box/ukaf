/**
 * One-off migration helper: flags rows created by the seed script *before*
 * `isDemoData` existed, using the same naming conventions the seed script
 * used at the time (stock numbers `UK-1xxx`, enquiry refs `ENQ-DEMOn`, and
 * the three fixed demo testimonial authors).
 *
 * Not needed on a fresh database — `npm run db:seed` already stamps new
 * example data correctly. Only run this once, against a database that was
 * seeded before this flag was introduced.
 *
 *   npx tsx scripts/backfill-demo-flag.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const trucks = await prisma.truck.updateMany({
    where: { stockNumber: { startsWith: 'UK-1' }, isDemoData: false },
    data: { isDemoData: true },
  });
  const leads = await prisma.lead.updateMany({
    where: { ref: { startsWith: 'ENQ-DEMO' }, isDemoData: false },
    data: { isDemoData: true },
  });
  const testimonials = await prisma.testimonial.updateMany({
    where: {
      authorName: { in: ['Marcus Reid', 'Priya Shah', 'Tom Nowak'] },
      isDemoData: false,
    },
    data: { isDemoData: true },
  });

  console.log(`Flagged ${trucks.count} truck(s), ${leads.count} lead(s), ${testimonials.count} testimonial(s) as demo data.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
