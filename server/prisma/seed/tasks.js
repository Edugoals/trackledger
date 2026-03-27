import { DEMO_TASK_TEMPLATES, OTHER_USER_TASK_TEMPLATES } from './taskTemplates.js';

export async function createTaskTemplatesForUser(prisma, userId, templates) {
  for (const t of templates) {
    await prisma.task.create({
      data: {
        userId,
        name: t.name,
        slug: t.slug ?? null,
        description: t.description ?? null,
        defaultEstimatedHours: t.defaultEstimatedHours ?? null,
        isActive: t.isActive !== false,
      },
    });
  }
  const tasks = await prisma.task.findMany({ where: { userId }, orderBy: { name: 'asc' } });
  const bySlug = {};
  for (const task of tasks) {
    if (task.slug) bySlug[task.slug] = task;
  }
  return { tasks, bySlug };
}

export async function seedDemoTasks(prisma, demoUserId) {
  const { bySlug } = await createTaskTemplatesForUser(prisma, demoUserId, DEMO_TASK_TEMPLATES);
  console.log(`Seeded ${DEMO_TASK_TEMPLATES.length} task templates for demo user.`);
  return { bySlug };
}

export async function seedOtherUserTasks(prisma, otherUserId) {
  await createTaskTemplatesForUser(prisma, otherUserId, OTHER_USER_TASK_TEMPLATES);
  console.log(`Seeded ${OTHER_USER_TASK_TEMPLATES.length} task templates for other user.`);
}
