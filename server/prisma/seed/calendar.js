import { daysFromNow, durationMinutes, windowOnDay } from './dates.js';
import { DEV_CALENDAR_ID } from './config.js';

/**
 * CalendarEvent rows for demo user (no Google API; local UI/testing only).
 */
export async function seedDemoCalendarEvents(prisma, { userId, customerId }) {
  const ttByTrackName = new Map();
  const tts = await prisma.trackTask.findMany({
    where: { userId },
    include: { track: true, task: true },
  });
  for (const tt of tts) {
    const key = `${tt.track.name}::${tt.task.slug || tt.task.name}`;
    ttByTrackName.set(key, tt);
  }

  const pick = (trackName, slug) => {
    const tt = ttByTrackName.get(`${trackName}::${slug}`);
    return tt?.id ?? null;
  };

  const rows = [
    {
      title: 'Past vocal session',
      ...windowOnDay(-10, 14, 17),
      assignedId: pick('Vocals & takes', 'recording-vocals'),
    },
    {
      title: 'Mix review (unassigned)',
      ...windowOnDay(-3, 19, 20),
      assignedId: null,
    },
    {
      title: 'Upcoming mastering slot',
      ...windowOnDay(12, 11, 12),
      assignedId: pick('Production & mix', 'mastering'),
    },
    {
      title: 'Planning call',
      ...windowOnDay(2, 9, 10),
      assignedId: null,
    },
    {
      title: 'DEADLINE – Stems – Master & delivery',
      start: daysFromNow(7, 9, 0),
      end: daysFromNow(7, 10, 0),
      assignedId: pick('Master & delivery', 'rendering-stems'),
      isDeadlineStyle: true,
    },
  ];

  for (const row of rows) {
    const dm = durationMinutes(row.start, row.end);
    await prisma.calendarEvent.create({
      data: {
        userId,
        customerId,
        calendarId: DEV_CALENDAR_ID,
        title: row.title,
        description:
          row.isDeadlineStyle === true
            ? 'Seed: deadline-style summary for timeline tests.'
            : 'Seed: demo calendar event.',
        start: row.start,
        end: row.end,
        durationMinutes: dm > 0 ? dm : 60,
        googleEventId: null,
        assignedTrackTaskId: row.assignedId,
        assignmentSource: row.assignedId ? 'MANUAL' : 'UNASSIGNED',
      },
    });
  }

  console.log(`Seeded ${rows.length} calendar events for demo user.`);
}

export async function seedOtherUserCalendarEvent(prisma, { userId, customerId }) {
  const { start, end } = windowOnDay(3, 15, 16);
  await prisma.calendarEvent.create({
    data: {
      userId,
      customerId,
      calendarId: 'other-dev-calendar',
      title: 'Other user session',
      description: 'Seed: tenancy isolation check.',
      start,
      end,
      durationMinutes: durationMinutes(start, end),
      googleEventId: null,
      assignedTrackTaskId: null,
      assignmentSource: 'UNASSIGNED',
    },
  });
  console.log('Seeded 1 calendar event for other user.');
}
