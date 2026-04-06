import { syncDeadlineToGoogle } from './deadlineSync.js';

/**
 * Pushes all track tasks on this track that have a deadline but no Google event yet.
 * Does not create duplicates: syncDeadlineToGoogle inserts only when deadlineGoogleEventId is null.
 */
export async function pushMissingDeadlinesToTrackGoogle(prisma, { userId, trackId }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.googleAccessToken) {
    const err = new Error('Geen Google-koppeling');
    err.code = 'NO_GOOGLE';
    throw err;
  }

  const track = await prisma.track.findFirst({
    where: { id: trackId, userId },
    include: { job: { include: { customer: true } } },
  });
  if (!track) {
    const err = new Error('Track niet gevonden');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const customer = track.job?.customer;
  if (!customer?.selectedCalendarId) {
    const err = new Error('Kies eerst een agenda voor deze klant');
    err.code = 'NO_CALENDAR';
    throw err;
  }

  const tasks = await prisma.trackTask.findMany({
    where: {
      trackId,
      userId,
      deadlineAt: { not: null },
      deadlineGoogleEventId: null,
    },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  let pushed = 0;
  const failures = [];

  for (const tt of tasks) {
    const result = await syncDeadlineToGoogle(tt);
    if (result.status === 'SYNCED') {
      pushed += 1;
    } else {
      failures.push({
        trackTaskId: tt.id,
        error: result.error || result.status || 'Onbekend',
      });
    }
  }

  return { pushed, failed: failures.length, failures, attempted: tasks.length };
}
