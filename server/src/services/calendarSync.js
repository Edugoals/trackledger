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

  const { data } = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    maxResults: 100,
  });

  let count = 0;
  for (const ge of data.items || []) {
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
  return { synced: count };
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
