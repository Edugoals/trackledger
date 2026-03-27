import { daysFromNow } from './dates.js';
import { DEV_CALENDAR_ID } from './config.js';

/**
 * Demo customer → job → tracks → track tasks (all owned by demo user).
 */
export async function seedDemoCustomerJobAndTracks(prisma, { userId, taskBySlug }) {
  const customer = await prisma.customer.create({
    data: {
      userId,
      name: 'Studio North',
      email: 'contact@studionorth.example',
      phone: '+31 20 000 0000',
      selectedCalendarId: DEV_CALENDAR_ID,
    },
  });

  const job = await prisma.job.create({
    data: {
      userId,
      customerId: customer.id,
      name: 'Summer EP',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T23:59:59.000Z'),
    },
  });

  const trackNames = ['Vocals & takes', 'Production & mix', 'Master & delivery'];
  const tracks = [];
  for (const name of trackNames) {
    tracks.push(
      await prisma.track.create({
        data: { userId, customerId: customer.id, jobId: job.id, name },
      })
    );
  }

  const [t0, t1, t2] = tracks;

  /** Per-track rows: slug, status, sortOrder, est hours, deadline day offset (null = none), actualHours override */
  const specs = [
    {
      trackId: t0.id,
      rows: [
        {
          slug: 'recording-vocals',
          status: 'NOT_STARTED',
          sortOrder: 0,
          est: 2,
          deadlineDays: 5,
          actualHours: 0,
        },
        {
          slug: 'production',
          status: 'IN_PROGRESS',
          sortOrder: 1,
          est: 4,
          deadlineDays: 0,
          actualHours: 2.5,
        },
        {
          slug: 'editing',
          status: 'DONE',
          sortOrder: 2,
          est: 1,
          deadlineDays: -4,
          actualHours: 1.1,
        },
      ],
    },
    {
      trackId: t1.id,
      rows: [
        {
          slug: 'mixing',
          status: 'IN_PROGRESS',
          sortOrder: 0,
          est: 3,
          deadlineDays: 10,
          actualHours: 0,
        },
        {
          slug: 'mastering',
          status: 'NOT_STARTED',
          sortOrder: 1,
          est: 1,
          deadlineDays: null,
          actualHours: 0,
        },
      ],
    },
    {
      trackId: t2.id,
      rows: [
        {
          slug: 'rendering-stems',
          status: 'NOT_STARTED',
          sortOrder: 0,
          est: 0.5,
          deadlineDays: -1,
          actualHours: 0,
        },
        {
          slug: 'production',
          status: 'IN_PROGRESS',
          sortOrder: 1,
          est: 2,
          deadlineDays: 14,
          actualHours: 0.5,
        },
      ],
    },
  ];

  const trackTasks = [];
  for (const spec of specs) {
    for (const row of spec.rows) {
      const task = taskBySlug[row.slug];
      if (!task) throw new Error(`Missing task template slug: ${row.slug}`);

      const deadlineAt =
        row.deadlineDays != null
          ? daysFromNow(row.deadlineDays, 18, 0)
          : null;

      const tt = await prisma.trackTask.create({
        data: {
          userId,
          trackId: spec.trackId,
          taskId: task.id,
          estimatedHours: row.est,
          actualHours: row.actualHours,
          status: row.status,
          sortOrder: row.sortOrder,
          deadlineAt,
          deadlineSyncStatus: deadlineAt ? 'SYNCED' : null,
          deadlineGoogleEventId: null,
          notes: row.status === 'DONE' ? 'Seed: afgerond voor demo.' : null,
        },
      });
      trackTasks.push(tt);
    }
  }

  console.log(
    `Seeded customer "${customer.name}", job "${job.name}", ${tracks.length} tracks, ${trackTasks.length} track tasks.`
  );

  return { customer, job, tracks, trackTasks };
}

export async function seedOtherUserMinimal(prisma, { userId }) {
  const customer = await prisma.customer.create({
    data: {
      userId,
      name: 'Private Client',
      email: 'private@example.com',
      selectedCalendarId: 'other-dev-calendar',
    },
  });
  console.log(`Seeded other user customer "${customer.name}".`);
  return { customer };
}
