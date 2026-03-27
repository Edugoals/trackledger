import { DEMO_USER, OTHER_USER } from './config.js';
import { hashPassword } from './hash.js';

/**
 * Remove prior demo users (cascade clears owned data).
 */
export async function removeDemoUsers(prisma) {
  const deleted = await prisma.user.deleteMany({
    where: { email: { in: [DEMO_USER.email, OTHER_USER.email] } },
  });
  if (deleted.count > 0) {
    console.log(`Removed ${deleted.count} prior demo user(s).`);
  }
}

export async function createDemoUsers(prisma) {
  const demoHash = await hashPassword(DEMO_USER.password);
  const otherHash = await hashPassword(OTHER_USER.password);

  const demo = await prisma.user.create({
    data: {
      email: DEMO_USER.email,
      name: DEMO_USER.name,
      passwordHash: demoHash,
    },
  });

  const other = await prisma.user.create({
    data: {
      email: OTHER_USER.email,
      name: OTHER_USER.name,
      passwordHash: otherHash,
    },
  });

  console.log(`Created users: demo id=${demo.id}, other id=${other.id}`);
  return { demo, other };
}
