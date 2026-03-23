import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Login vereist' });
  next();
}

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

router.delete('/:id', ensureTrackAccess, async (req, res) => {
  try {
    await prisma.track.delete({ where: { id: req.track.id, userId: req.session.userId } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
