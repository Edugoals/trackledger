import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getCalendarClient } from '../config/google.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

/** Lijst van Google-agenda's ophalen */
router.get('/', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
    });
    if (!user?.googleAccessToken) return res.status(400).json({ error: 'Geen Google-koppeling' });

    const calendar = getCalendarClient(user.googleAccessToken, user.googleRefreshToken);
    const { data } = await calendar.calendarList.list();
    const list = (data.items || []).map((cal) => ({
      id: cal.id,
      summary: cal.summary || cal.id,
      primary: cal.primary === true,
    }));
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Huidige gekozen agenda ophalen */
router.get('/selected', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { selectedCalendarId: true },
  });
  res.json({ calendarId: user?.selectedCalendarId ?? null });
});

/** Nieuwe agenda aanmaken in Google */
router.post('/', async (req, res) => {
  const { summary, description } = req.body;
  if (!summary || typeof summary !== 'string') return res.status(400).json({ error: 'summary verplicht' });

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
    });
    if (!user?.googleAccessToken) return res.status(400).json({ error: 'Geen Google-koppeling' });

    const calendar = getCalendarClient(user.googleAccessToken, user.googleRefreshToken);
    const { data } = await calendar.calendars.insert({
      requestBody: {
        summary: summary.trim(),
        description: description?.trim() || undefined,
        timeZone: 'Europe/Amsterdam',
      },
    });

    res.status(201).json({
      id: data.id,
      summary: data.summary || data.id,
      primary: false,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Agenda kiezen */
router.put('/selected', async (req, res) => {
  const { calendarId } = req.body;
  if (!calendarId || typeof calendarId !== 'string') return res.status(400).json({ error: 'calendarId verplicht' });

  await prisma.user.update({
    where: { id: req.session.userId },
    data: { selectedCalendarId: calendarId },
  });
  res.json({ calendarId });
});

export default router;
