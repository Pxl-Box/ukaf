/**
 * CLI equivalent of switching the "Example data" toggle off on
 * /admin/settings — removes every row flagged `isDemoData`, leaving anything
 * a member of staff created by hand untouched. Delegates to
 * src/lib/demo-data.ts so this and the admin toggle can never drift apart.
 *
 *   npx tsx scripts/reset-demo-data.ts
 */

import { PrismaClient } from '@prisma/client';
// Relative import — see the note in prisma/seed.ts on why this file can't
// use the `@/lib/...` alias.
import { clearDemoData } from '../src/lib/demo-data';

const prisma = new PrismaClient();

async function main() {
  const result = await clearDemoData(prisma);

  console.log(`Removed ${result.trucksDeleted} example vehicle(s).`);
  console.log(`Removed ${result.leadsDeleted} example enquiry(ies).`);
  console.log(`Removed ${result.testimonialsDeleted} example testimonial(s).`);

  if (result.trucksKeptWithOrders.length > 0) {
    console.log(
      `\n${result.trucksKeptWithOrders.length} example vehicle(s) have real order history against them, ` +
        `so they were kept as ordinary listings instead of deleted: ${result.trucksKeptWithOrders.join(', ')}`,
    );
  }

  console.log('\nRun `npm run db:seed` to regenerate example data.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
