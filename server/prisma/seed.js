import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TASKS = [
  { name: 'Recording Vocals', slug: 'recording-vocals', defaultEstimatedHours: 2 },
  { name: 'Production', slug: 'production', defaultEstimatedHours: 4 },
  { name: 'Editing', slug: 'editing', defaultEstimatedHours: 1 },
  { name: 'Mixing', slug: 'mixing', defaultEstimatedHours: 3 },
  { name: 'Mastering', slug: 'mastering', defaultEstimatedHours: 1 },
  { name: 'Rendering Stems', slug: 'rendering-stems', defaultEstimatedHours: 0.5 },
];

async function main() {
  const users = await prisma.user.findMany();
  for (const user of users) {
    const existing = await prisma.task.count({ where: { userId: user.id } });
    if (existing > 0) continue;
    for (const t of DEFAULT_TASKS) {
      await prisma.task.create({
        data: { name: t.name, slug: t.slug, defaultEstimatedHours: t.defaultEstimatedHours, userId: user.id },
      });
    }
    console.log(`Seeded ${DEFAULT_TASKS.length} tasks for user ${user.id}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
