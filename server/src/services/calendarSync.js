import { PrismaClient } from '@prisma/client';
import { getCalendarClient } from '../config/google.js';

const prisma = new PrismaClient();

function toGoogleEvent(event) {
  return {
    summary: event.title,
    description: event.description || undefined,
    location: event.location || undefined,
    start: { dateTime: event.start.toISOString(), timeZone: 'Europe/Amsterdam' },
    end: { dateTime: event.end.toISOString(), timeZone: 'Europe/Amsterdam' },
  };
}

function computeDurationMinutes(start, end) {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  return Math.round((b - a) / 60000);
}

function fromGoogleEvent(g, calendarId) {
  const start = new Date(g.start?.dateTime || g.start?.date);
  const end = new Date(g.end?.dateTime || g.end?.date);
  return {
    googleEventId: g.id,
    calendarId,
    title: g.summary || '(Geen titel)',
    description: g.description || null,
    start,
    end,
    location: g.location || null,
    durationMinutes: computeDurationMinutes(start, end),
  };
}

export async function syncFromGoogle(userId, customerId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, userId },
  });
  if (!user?.googleAccessToken) throw new Error('Geen Google-koppeling');
  if (!customer?.selectedCalendarId) throw new Error('Kies eerst een agenda voor deze klant');

  const calendarId = customer.selectedCalendarId;
  const calendar = getCalendarClient(user.googleAccessToken, user.googleRefreshToken);

  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const { data } = await calendar.events.list({
    calendarId,
    timeMin: oneYearAgo.toISOString(),
    maxResults: 250,
    singleEvents: true,
  });

  const deadlineEventIds = new Set();
  const DEADLINE_PREFIX = 'DEADLINE – ';
  const TRACKTASK_ID_PATTERN = /TrackTask ID:\s*(\d+)/;

  function getDeadlineTrackTaskId(ge) {
    const priv = ge?.extendedProperties?.private;
    if (priv?.trackTaskId) return parseInt(priv.trackTaskId);
    const desc = ge?.description || '';
    const m = desc.match(TRACKTASK_ID_PATTERN);
    return m ? parseInt(m[1]) : null;
  }

  function isDeadlineEvent(ge) {
    if (ge?.extendedProperties?.private?.trackledgerType === 'deadline') return true;
    return (ge?.summary || '').startsWith(DEADLINE_PREFIX);
  }

  const syncedGoogleIds = new Set(
    (data.items || []).filter((ge) => !isDeadlineEvent(ge)).map((ge) => ge.id)
  );

  let count = 0;
  for (const ge of data.items || []) {
    if (isDeadlineEvent(ge)) {
      deadlineEventIds.add(ge.id);
      const trackTaskId = getDeadlineTrackTaskId(ge);
      const startDate = ge.start?.date || ge.start?.dateTime;
      if (trackTaskId && startDate) {
        const ttId = trackTaskId;
        const trackTask = await prisma.trackTask.findFirst({
          where: {
            id: ttId,
            userId,
            track: { customerId },
          },
        });
        if (trackTask) {
          const dateStr = typeof startDate === 'string' ? startDate.slice(0, 10) : String(startDate).slice(0, 10);
          const newDeadlineAt = new Date(dateStr + 'T12:00:00');
          await prisma.trackTask.update({
            where: { id: ttId },
            data: {
              deadlineAt: newDeadlineAt,
              deadlineGoogleEventId: ge.id,
              deadlineSyncStatus: 'SYNCED',
              deadlineLastSyncedAt: new Date(),
              deadlineSyncError: null,
            },
          });
        }
      }
      continue;
    }
    const payload = fromGoogleEvent(ge, calendarId);
    const existing = await prisma.calendarEvent.findFirst({
      where: { userId, customerId, calendarId, googleEventId: ge.id },
    });
    if (existing) {
      const { googleEventId: _g, ...updateFields } = payload;
      await prisma.calendarEvent.update({
        where: { id: existing.id },
        data: updateFields,
      });
    } else {
      await prisma.calendarEvent.create({ data: { ...payload, userId, customerId } });
    }
    count++;
  }

  const idsToKeep = Array.from(syncedGoogleIds).filter(Boolean);
  const deadlineIdsToKeep = Array.from(deadlineEventIds).filter(Boolean);

  const deadlineWhere =
    deadlineIdsToKeep.length > 0
      ? {
          userId,
          track: { customerId },
          AND: [
            { deadlineGoogleEventId: { not: null } },
            { deadlineGoogleEventId: { notIn: deadlineIdsToKeep } },
          ],
        }
      : { userId, track: { customerId }, deadlineGoogleEventId: { not: null } };
  const trackTasksWithDeletedDeadline = await prisma.trackTask.findMany({
    where: deadlineWhere,
  });

  for (const tt of trackTasksWithDeletedDeadline) {
    await prisma.trackTask.update({
      where: { id: tt.id },
      data: {
        deadlineAt: null,
        deadlineGoogleEventId: null,
        deadlineSyncStatus: 'DELETED',
        deadlineSyncError: null,
      },
    });
  }

  let deletedCount = 0;
  if (idsToKeep.length > 0) {
    const { count } = await prisma.calendarEvent.deleteMany({
      where: {
        userId,
        customerId,
        calendarId,
        AND: [
          { googleEventId: { not: null } },
          { googleEventId: { notIn: idsToKeep } },
        ],
      },
    });
    deletedCount = count;
  }

  return { synced: count, removed: deletedCount };
}

export async function syncToGoogle(userId, customerId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, userId },
  });
  if (!user?.googleAccessToken) throw new Error('Geen Google-koppeling');
  if (!customer?.selectedCalendarId) throw new Error('Kies eerst een agenda voor deze klant');

  const calendarId = customer.selectedCalendarId;
  const calendar = getCalendarClient(user.googleAccessToken, user.googleRefreshToken);

  const localEvents = await prisma.calendarEvent.findMany({
    where: { userId, customerId, calendarId, start: { gte: new Date() } },
  });

  for (const event of localEvents) {
    const body = toGoogleEvent(event);
    if (event.googleEventId) {
      await calendar.events.patch({ calendarId, eventId: event.googleEventId, requestBody: body });
    } else {
      const { data } = await calendar.events.insert({ calendarId, requestBody: body });
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: { googleEventId: data.id },
      });
    }
  }
  return { ok: true };
}
