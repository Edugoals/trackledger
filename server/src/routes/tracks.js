import { Router } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

async function ensureTrackAccess(req, res, next) {
  const id = parseInt(req.params.id);
  const track = await prisma.track.findFirst({
    where: { id, userId: req.session.userId },
    include: { job: { include: { customer: true } } },
  });
  if (!track) return res.status(404).json({ error: 'Track niet gevonden' });
  req.track = track;
  next();
}

router.get('/', async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: 'jobId verplicht' });
  const job = await prisma.job.findFirst({
    where: { id: parseInt(jobId), userId: req.session.userId },
    include: { customer: true },
  });
  if (!job) return res.status(404).json({ error: 'Opdracht niet gevonden' });
  try {
    const tracks = await prisma.track.findMany({
      where: { jobId: job.id },
      orderBy: { name: 'asc' },
    });
    res.json(tracks);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const { jobId, name } = req.body;
  if (!jobId || !name?.trim()) return res.status(400).json({ error: 'jobId en name verplicht' });
  const job = await prisma.job.findFirst({
    where: { id: parseInt(jobId), userId: req.session.userId },
    include: { customer: true },
  });
  if (!job) return res.status(404).json({ error: 'Opdracht niet gevonden' });
  try {
    const track = await prisma.track.create({
      data: {
        jobId: job.id,
        customerId: job.customerId,
        userId: job.userId,
        name: name.trim(),
      },
    });
    res.status(201).json(track);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Tracknaam bestaat al voor deze klant' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', ensureTrackAccess, async (req, res) => {
  const { name } = req.body;
  if (name == null) return res.status(400).json({ error: 'name verplicht' });
  try {
    const updated = await prisma.track.update({
      where: { id: req.track.id, userId: req.session.userId },
      data: { name: name.trim() },
    });
    res.json(updated);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Tracknaam bestaat al voor deze klant' });
    res.status(500).json({ error: e.message });
  }
});

/** Partial update: pricing fields (and optional name). */
router.patch('/:id', ensureTrackAccess, async (req, res) => {
  const { name, agreedPrice, currency, pricingNotes, isPriceFinal } = req.body || {};
  const data = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name mag niet leeg zijn' });
    }
    data.name = name.trim();
  }

  if (agreedPrice !== undefined) {
    if (agreedPrice === null || agreedPrice === '') {
      data.agreedPrice = null;
    } else {
      const n = parseFloat(agreedPrice);
      if (isNaN(n) || n < 0) return res.status(400).json({ error: 'agreedPrice moet een getal ≥ 0 zijn' });
      data.agreedPrice = n;
    }
  }

  if (currency !== undefined) {
    const c = String(currency || 'EUR').trim().toUpperCase();
    if (c.length > 8) return res.status(400).json({ error: 'currency te lang' });
    data.currency = c || 'EUR';
  }

  if (pricingNotes !== undefined) {
    data.pricingNotes =
      pricingNotes == null || pricingNotes === '' ? null : String(pricingNotes).trim();
  }

  if (isPriceFinal !== undefined) {
    data.isPriceFinal = !!isPriceFinal;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Geen velden om bij te werken' });
  }

  try {
    const updated = await prisma.track.update({
      where: { id: req.track.id, userId: req.session.userId },
      data,
    });
    res.json(updated);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Tracknaam bestaat al voor deze klant' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', ensureTrackAccess, async (req, res) => {
  try {
    await prisma.track.delete({ where: { id: req.track.id, userId: req.session.userId } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Create or rotate read-only customer share link for this track. */
router.post('/:id/share', ensureTrackAccess, async (req, res) => {
  const clientBase = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  const token = crypto.randomBytes(24).toString('base64url');

  try {
    await prisma.trackShare.upsert({
      where: { trackId: req.track.id },
      create: {
        trackId: req.track.id,
        token,
        createdByUserId: req.session.userId,
      },
      update: {
        token,
        isActive: true,
        expiresAt: null,
      },
    });

    const shareUrl = `${clientBase}/share/track/${encodeURIComponent(token)}`;
    res.status(201).json({ token, shareUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
