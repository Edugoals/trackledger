import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const activeOnly = req.query.activeOnly === '1' || req.query.activeOnly === 'true';
  try {
    const tasks = await prisma.task.findMany({
      where: {
        userId: req.session.userId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    res.json(tasks);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const { name, slug, description, defaultEstimatedHours, isActive } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name verplicht' });
  const hours = defaultEstimatedHours != null && defaultEstimatedHours !== '' ? parseFloat(defaultEstimatedHours) : null;
  if (hours != null && (isNaN(hours) || hours < 0)) return res.status(400).json({ error: 'defaultEstimatedHours moet >= 0 zijn' });
  const active = isActive === undefined ? true : !!isActive;
  try {
    const task = await prisma.task.create({
      data: {
        userId: req.session.userId,
        name: name.trim(),
        slug: slug?.trim() || null,
        description: description?.trim() || null,
        defaultEstimatedHours: hours,
        isActive: active,
      },
    });
    res.status(201).json(task);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Slug bestaat al' });
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const task = await prisma.task.findFirst({ where: { id, userId: req.session.userId } });
  if (!task) return res.status(404).json({ error: 'Task niet gevonden' });
  const { name, slug, description, defaultEstimatedHours, isActive } = req.body;

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name mag niet leeg zijn' });
    }
  }

  let hours;
  if (defaultEstimatedHours === undefined) {
    hours = undefined;
  } else if (defaultEstimatedHours === null || defaultEstimatedHours === '') {
    hours = null;
  } else {
    const h = parseFloat(defaultEstimatedHours);
    if (isNaN(h) || h < 0) return res.status(400).json({ error: 'defaultEstimatedHours moet >= 0 zijn' });
    hours = h;
  }

  try {
    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(slug !== undefined && { slug: slug?.trim() || null }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(hours !== undefined && { defaultEstimatedHours: hours }),
        ...(isActive !== undefined && { isActive: !!isActive }),
      },
    });
    res.json(updated);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Slug bestaat al' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const task = await prisma.task.findFirst({ where: { id, userId: req.session.userId } });
  if (!task) return res.status(404).json({ error: 'Task niet gevonden' });

  const inUse = await prisma.trackTask.count({ where: { taskId: id } });
  if (inUse > 0) {
    return res.status(409).json({
      error:
        'Deze template wordt nog gebruikt op een track. Verwijder of wijzig die koppelingen eerst, of deactiveer de template.',
      code: 'TASK_IN_USE',
    });
  }

  try {
    await prisma.task.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
