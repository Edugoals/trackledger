import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getCalendarClient } from '../config/google.js';
import { syncFromGoogle } from '../services/calendarSync.js';

const router = Router();
const prisma = new PrismaClient();

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Login vereist' });
  next();
}

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { selectedCalendarId: true },
    });
    if (!user?.selectedCalendarId) return res.json([]);
    const events = await prisma.calendarEvent.findMany({
      where: { userId: req.session.userId, calendarId: user.selectedCalendarId },
      orderBy: { start: 'asc' },
    });
    res.json(events);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function toAmsterdamISO(dateInput) {
  const d = new Date(dateInput);
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hour = pad(d.getHours());
  const min = pad(d.getMinutes());
  const sec = pad(d.getSeconds());
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(offset) / 60));
  const offsetMins = pad(Math.abs(offset) % 60);
  return `${year}-${month}-${day}T${hour}:${min}:${sec}${sign}${offsetHours}:${offsetMins}`;
}

router.post('/', async (req, res) => {
  const { title, description, start, end, location } = req.body;
  if (!title || !start || !end) return res.status(400).json({ error: 'title, start, end verplicht' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (!user?.selectedCalendarId) return res.status(400).json({ error: 'Kies eerst een agenda' });

    const startDate = new Date(start);
    const endDate = new Date(end);
    const calendarId = user.selectedCalendarId;
    const event = await prisma.calendarEvent.create({
      data: {
        userId: req.session.userId,
        calendarId,
        title,
        description: description || null,
        start: startDate,
        end: endDate,
        location: location || null,
      },
    });

    if (user?.googleAccessToken) {
      const calendar = getCalendarClient(user.googleAccessToken, user.googleRefreshToken);
      const { data } = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: title,
          description: description || undefined,
          location: location || undefined,
          start: { dateTime: toAmsterdamISO(startDate), timeZone: 'Europe/Amsterdam' },
          end: { dateTime: toAmsterdamISO(endDate), timeZone: 'Europe/Amsterdam' },
        },
      });
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: { googleEventId: data.id },
      });
    }

    res.json(await prisma.calendarEvent.findUnique({ where: { id: event.id } }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const { title, description, start, end, location } = req.body;
  const id = parseInt(req.params.id);
  const event = await prisma.calendarEvent.findFirst({ where: { id, userId: req.session.userId } });
  if (!event) return res.status(404).json({ error: 'Event niet gevonden' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (user?.googleAccessToken && event.googleEventId) {
      const calendar = getCalendarClient(user.googleAccessToken, user.googleRefreshToken);
      const startDate = start ? new Date(start) : event.start;
      const endDate = end ? new Date(end) : event.end;
      await calendar.events.patch({
        calendarId: event.calendarId,
        eventId: event.googleEventId,
        requestBody: {
          summary: title ?? event.title,
          description: description ?? event.description ?? undefined,
          location: location ?? event.location ?? undefined,
          start: { dateTime: toAmsterdamISO(startDate), timeZone: 'Europe/Amsterdam' },
          end: { dateTime: toAmsterdamISO(endDate), timeZone: 'Europe/Amsterdam' },
        },
      });
    }

    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(title != null && { title }),
        ...(description != null && { description }),
        ...(start != null && { start: new Date(start) }),
        ...(end != null && { end: new Date(end) }),
        ...(location != null && { location }),
      },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const event = await prisma.calendarEvent.findFirst({ where: { id, userId: req.session.userId } });
  if (!event) return res.status(404).json({ error: 'Event niet gevonden' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (user?.googleAccessToken && event.googleEventId) {
      const calendar = getCalendarClient(user.googleAccessToken, user.googleRefreshToken);
      await calendar.events.delete({ calendarId: event.calendarId, eventId: event.googleEventId });
    }
    await prisma.calendarEvent.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const result = await syncFromGoogle(req.session.userId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
