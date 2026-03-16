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

function fromGoogleEvent(g, calendarId) {
  return {
    googleEventId: g.id,
    calendarId,
    title: g.summary || '(Geen titel)',
    description: g.description || null,
    start: new Date(g.start?.dateTime || g.start?.date),
    end: new Date(g.end?.dateTime || g.end?.date),
    location: g.location || null,
  };
}

export async function syncFromGoogle(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user?.googleAccessToken) throw new Error('Geen Google-koppeling');
  if (!user?.selectedCalendarId) throw new Error('Kies eerst een agenda');

  const calendarId = user.selectedCalendarId;
  const calendar = getCalendarClient(user.googleAccessToken, user.googleRefreshToken);

  const { data } = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    maxResults: 100,
  });

  let count = 0;
  for (const ge of data.items || []) {
    const payload = fromGoogleEvent(ge, calendarId);
    const existing = await prisma.calendarEvent.findFirst({
      where: { userId, calendarId, googleEventId: ge.id },
    });
    if (existing) {
      await prisma.calendarEvent.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.calendarEvent.create({ data: { ...payload, userId } });
    }
    count++;
  }
  return { synced: count };
}

export async function syncToGoogle(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.googleAccessToken) throw new Error('Geen Google-koppeling');
  if (!user?.selectedCalendarId) throw new Error('Kies eerst een agenda');

  const calendarId = user.selectedCalendarId;
  const calendar = getCalendarClient(user.googleAccessToken, user.googleRefreshToken);

  const localEvents = await prisma.calendarEvent.findMany({
    where: { userId, calendarId, start: { gte: new Date() } },
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
