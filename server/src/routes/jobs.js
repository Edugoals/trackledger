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
    where: { id, userId: req.session.userId },
    include: { customer: true },
  });
  if (!job) return res.status(404).json({ error: 'Opdracht niet gevonden' });
  req.job = job;
  next();
}

router.get('/', async (req, res) => {
  const { customerId } = req.query;
  try {
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: parseInt(customerId), userId: req.session.userId },
      });
      if (!customer) return res.status(404).json({ error: 'Klant niet gevonden' });
      const jobs = await prisma.job.findMany({
        where: { customerId: customer.id, userId: req.session.userId },
        include: { _count: { select: { tracks: true } }, customer: { select: { name: true } } },
        orderBy: { startDate: 'desc' },
      });
      const withStats = await addJobStats(jobs, req.session.userId);
      return res.json(withStats);
    }
    const jobs = await prisma.job.findMany({
      where: { userId: req.session.userId },
      include: { _count: { select: { tracks: true } }, customer: { select: { name: true } } },
      orderBy: { startDate: 'desc' },
    });
    const withStats = await addJobStats(jobs, req.session.userId);
    res.json(withStats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function addJobStats(jobs, currentUserId) {
  const result = [];
  for (const job of jobs) {
    const trackTasks = await prisma.trackTask.findMany({
      where: { track: { jobId: job.id }, userId: currentUserId },
      select: { estimatedHours: true, actualHours: true },
    });
    const totalEstimated = trackTasks.reduce((s, tt) => s + (parseFloat(tt.estimatedHours) || 0), 0);
    const totalActual = trackTasks.reduce((s, tt) => s + (parseFloat(tt.actualHours) || 0), 0);
    const hoursDifference = totalActual - totalEstimated;
    const overrunPercentage = totalEstimated > 0 ? (hoursDifference / totalEstimated) * 100 : null;
    result.push({
      ...job,
      totalEstimatedHours: totalEstimated,
      totalActualHours: totalActual,
      hoursDifference,
      overrunPercentage,
    });
  }
  return result;
}

router.get('/:id', ensureJobAccess, async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.job.id },
    include: {
      customer: true,
      tracks: {
        include: {
          trackTasks: {
            include: { task: true },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          },
        },
      },
    },
  });
  const tracksWithStats = (job.tracks || []).map((t) => {
    const totalEstimated = t.trackTasks.reduce((s, tt) => s + (parseFloat(tt.estimatedHours) || 0), 0);
    const totalActual = t.trackTasks.reduce((s, tt) => s + (parseFloat(tt.actualHours) || 0), 0);
    return {
      ...t,
      totalEstimatedHours: totalEstimated,
      totalActualHours: totalActual,
      hoursDifference: totalActual - totalEstimated,
      overrunPercentage: totalEstimated > 0 ? ((totalActual - totalEstimated) / totalEstimated) * 100 : null,
    };
  });
  res.json({ ...job, tracks: tracksWithStats });
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
        userId: customer.userId,
        name: name.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    res.status(201).json(job);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Projectnaam bestaat al voor deze klant' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', ensureJobAccess, async (req, res) => {
  const { name, startDate, endDate } = req.body;
  try {
    const updated = await prisma.job.update({
      where: { id: req.job.id, userId: req.session.userId },
      data: {
        ...(name != null && { name: name.trim() }),
        ...(startDate != null && { startDate: new Date(startDate) }),
        ...(endDate != null && { endDate: new Date(endDate) }),
      },
    });
    res.json(updated);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Projectnaam bestaat al voor deze klant' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', ensureJobAccess, async (req, res) => {
  try {
    await prisma.job.delete({ where: { id: req.job.id, userId: req.session.userId } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
