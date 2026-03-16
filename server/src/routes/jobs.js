import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Login vereist' });
  next();
}

router.use(requireAuth);

async function ensureJobAccess(req, res, next) {
  const id = parseInt(req.params.id);
  const job = await prisma.job.findFirst({
    where: { id },
    include: { customer: true },
  });
  if (!job || job.customer.userId !== req.session.userId) return res.status(404).json({ error: 'Opdracht niet gevonden' });
  req.job = job;
  next();
}

router.get('/', async (req, res) => {
  const { customerId } = req.query;
  if (!customerId) return res.status(400).json({ error: 'customerId verplicht' });
  const customer = await prisma.customer.findFirst({
    where: { id: parseInt(customerId), userId: req.session.userId },
  });
  if (!customer) return res.status(404).json({ error: 'Klant niet gevonden' });
  try {
    const jobs = await prisma.job.findMany({
      where: { customerId: customer.id },
      include: { _count: { select: { tracks: true } } },
      orderBy: { startDate: 'desc' },
    });
    res.json(jobs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', ensureJobAccess, async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.job.id },
    include: { customer: true, tracks: true },
  });
  res.json(job);
});

router.post('/', async (req, res) => {
  const { customerId, name, startDate, endDate } = req.body;
  if (!customerId || !name?.trim() || !startDate || !endDate) {
    return res.status(400).json({ error: 'customerId, name, startDate, endDate verplicht' });
  }
  const customer = await prisma.customer.findFirst({
    where: { id: parseInt(customerId), userId: req.session.userId },
  });
  if (!customer) return res.status(404).json({ error: 'Klant niet gevonden' });
  try {
    const job = await prisma.job.create({
      data: {
        customerId: customer.id,
        name: name.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    res.status(201).json(job);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Opdrachtnaam bestaat al' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', ensureJobAccess, async (req, res) => {
  const { name, startDate, endDate } = req.body;
  try {
    const updated = await prisma.job.update({
      where: { id: req.job.id },
      data: {
        ...(name != null && { name: name.trim() }),
        ...(startDate != null && { startDate: new Date(startDate) }),
        ...(endDate != null && { endDate: new Date(endDate) }),
      },
    });
    res.json(updated);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Opdrachtnaam bestaat al' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', ensureJobAccess, async (req, res) => {
  try {
    await prisma.job.delete({ where: { id: req.job.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
