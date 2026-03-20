import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const STATUS_VALUES = ['NOT_STARTED', 'IN_PROGRESS', 'DONE'];

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Login vereist' });
  next();
}

router.use(requireAuth);

async function ensureTrackAccess(req, res, next) {
  const trackId = parseInt(req.params.trackId);
  const track = await prisma.track.findFirst({
    where: { id: trackId },
    include: { job: { include: { customer: true } } },
  });
  if (!track || track.job.customer.userId !== req.session.userId) return res.status(404).json({ error: 'Track niet gevonden' });
  req.track = track;
  next();
}

async function ensureTrackTaskAccess(req, res, next) {
  const id = parseInt(req.params.id);
  const tt = await prisma.trackTask.findFirst({
    where: { id },
    include: { track: { include: { job: { include: { customer: true } } } } },
  });
  if (!tt || tt.track.job.customer.userId !== req.session.userId) return res.status(404).json({ error: 'TrackTask niet gevonden' });
  req.trackTask = tt;
  next();
}

function parseDecimal(val) {
  if (val == null) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function computeTrackAggregation(trackTasks) {
  const totalEstimated = trackTasks.reduce((s, tt) => s + (parseFloat(tt.estimatedHours) || 0), 0);
  const totalActual = trackTasks.reduce((s, tt) => s + (parseFloat(tt.actualHours) || 0), 0);
  const hoursDifference = totalActual - totalEstimated;
  const overrunPercentage = totalEstimated > 0 ? (hoursDifference / totalEstimated) * 100 : null;
  return { totalEstimatedHours: totalEstimated, totalActualHours: totalActual, hoursDifference, overrunPercentage };
}

router.get('/tracks/:trackId/tasks', ensureTrackAccess, async (req, res) => {
  try {
    const trackTasks = await prisma.trackTask.findMany({
      where: { trackId: req.track.id },
      include: { task: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    const aggregation = computeTrackAggregation(trackTasks);
    res.json({ trackTasks, aggregation });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tracks/:trackId/tasks', ensureTrackAccess, async (req, res) => {
  const { taskId, titleOverride, notes, estimatedHours } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId verplicht' });
  const task = await prisma.task.findFirst({
    where: { id: parseInt(taskId), userId: req.session.userId },
  });
  if (!task) return res.status(404).json({ error: 'Task niet gevonden' });
  const estHours = estimatedHours !== undefined ? parseDecimal(estimatedHours) : null;
  if (estHours !== null && estHours < 0) return res.status(400).json({ error: 'estimatedHours moet >= 0 zijn' });
  const hours = estHours ?? (task.defaultEstimatedHours ? parseFloat(task.defaultEstimatedHours) : null);
  try {
    const trackTask = await prisma.trackTask.create({
      data: {
        trackId: req.track.id,
        taskId: task.id,
        titleOverride: titleOverride?.trim() || null,
        notes: notes?.trim() || null,
        estimatedHours: hours,
      },
      include: { task: true },
    });
    res.status(201).json(trackTask);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Deze task is al gekoppeld aan dit track' });
    res.status(500).json({ error: e.message });
  }
});

router.patch('/track-tasks/:id', ensureTrackTaskAccess, async (req, res) => {
  const { titleOverride, notes, estimatedHours, actualHours, status, sortOrder } = req.body;
  const estHours = estimatedHours !== undefined ? parseDecimal(estimatedHours) : undefined;
  const actHours = actualHours !== undefined ? parseDecimal(actualHours) : undefined;
  if (estHours !== undefined && estHours !== null && estHours < 0) return res.status(400).json({ error: 'estimatedHours moet >= 0 zijn' });
  if (actHours !== undefined && (actHours < 0 || isNaN(actHours))) return res.status(400).json({ error: 'actualHours moet >= 0 zijn' });
  if (status !== undefined && !STATUS_VALUES.includes(status)) return res.status(400).json({ error: 'Ongeldige status' });
  try {
    const updated = await prisma.trackTask.update({
      where: { id: req.trackTask.id },
      data: {
        ...(titleOverride !== undefined && { titleOverride: titleOverride?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(estHours !== undefined && { estimatedHours: estHours }),
        ...(actHours !== undefined && { actualHours: actHours }),
        ...(status !== undefined && { status }),
        ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) || 0 }),
      },
      include: { task: true },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/track-tasks/:id', ensureTrackTaskAccess, async (req, res) => {
  try {
    await prisma.trackTask.delete({ where: { id: req.trackTask.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
