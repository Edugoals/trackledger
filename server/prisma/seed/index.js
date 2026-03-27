/**
 * Development seed: demo users, templates, domain data, calendar events.
 * Run after `prisma db push` / reset. Uses same bcrypt cost as app auth.
 */
import { PrismaClient } from '@prisma/client';
import { removeDemoUsers, createDemoUsers } from './users.js';
import { seedDemoTasks, seedOtherUserTasks } from './tasks.js';
import { seedDemoCustomerJobAndTracks, seedOtherUserMinimal } from './domain.js';
import { seedDemoCalendarEvents, seedOtherUserCalendarEvent } from './calendar.js';
import { DEMO_USER, OTHER_USER } from './config.js';

const prisma = new PrismaClient();

async function main() {
  console.log('TrackLedger dev seed — start');

  await removeDemoUsers(prisma);
  const { demo, other } = await createDemoUsers(prisma);

  const { bySlug } = await seedDemoTasks(prisma, demo.id);

  await seedOtherUserTasks(prisma, other.id);

  const { customer: demoCustomer } = await seedDemoCustomerJobAndTracks(prisma, {
    userId: demo.id,
    taskBySlug: bySlug,
  });

  await seedDemoCalendarEvents(prisma, {
    userId: demo.id,
    customerId: demoCustomer.id,
  });

  const { customer: otherCustomer } = await seedOtherUserMinimal(prisma, { userId: other.id });
  await seedOtherUserCalendarEvent(prisma, { userId: other.id, customerId: otherCustomer.id });

  console.log('');
  console.log('Done. Login (demo):');
  console.log(`  Email: ${DEMO_USER.email}`);
  console.log(`  Password: ${DEMO_USER.password}`);
  console.log('');
  console.log('Second user (tenancy):');
  console.log(`  Email: ${OTHER_USER.email}`);
  console.log(`  Password: ${OTHER_USER.password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
