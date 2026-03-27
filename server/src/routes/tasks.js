import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
const prisma = new PrismaClient();

const STATUS_VALUES = ['NOT_STARTED', 'IN_PROGRESS', 'DONE'];

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: req.session.userId, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json(tasks);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const { name, slug, description, defaultEstimatedHours } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name verplicht' });
  const hours = defaultEstimatedHours != null ? parseFloat(defaultEstimatedHours) : null;
  if (hours != null && (isNaN(hours) || hours < 0)) return res.status(400).json({ error: 'defaultEstimatedHours moet >= 0 zijn' });
  try {
    const task = await prisma.task.create({
      data: {
        userId: req.session.userId,
        name: name.trim(),
        slug: slug?.trim() || null,
        description: description?.trim() || null,
        defaultEstimatedHours: hours,
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
  const hours = defaultEstimatedHours !== undefined ? parseFloat(defaultEstimatedHours) : undefined;
  if (hours !== undefined && (isNaN(hours) || hours < 0)) return res.status(400).json({ error: 'defaultEstimatedHours moet >= 0 zijn' });
  try {
    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(name != null && { name: name.trim() }),
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
  try {
    await prisma.task.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
