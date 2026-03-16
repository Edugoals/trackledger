import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Login vereist' });
  next();
}

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { userId: req.session.userId },
      include: { _count: { select: { jobs: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(customers);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const customer = await prisma.customer.findFirst({
    where: { id, userId: req.session.userId },
    include: { jobs: { orderBy: { startDate: 'desc' } } },
  });
  if (!customer) return res.status(404).json({ error: 'Klant niet gevonden' });
  res.json(customer);
});

router.post('/', async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Naam verplicht' });
  try {
    const customer = await prisma.customer.create({
      data: {
        userId: req.session.userId,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
      },
    });
    res.status(201).json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, email, phone, selectedCalendarId } = req.body;
  const customer = await prisma.customer.findFirst({ where: { id, userId: req.session.userId } });
  if (!customer) return res.status(404).json({ error: 'Klant niet gevonden' });
  try {
    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(name != null && { name: name.trim() }),
        ...(email != null && { email: email?.trim() || null }),
        ...(phone != null && { phone: phone?.trim() || null }),
        ...(selectedCalendarId !== undefined && { selectedCalendarId: selectedCalendarId || null }),
      },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/calendar', async (req, res) => {
  const id = parseInt(req.params.id);
  const { calendarId } = req.body;
  const customer = await prisma.customer.findFirst({ where: { id, userId: req.session.userId } });
  if (!customer) return res.status(404).json({ error: 'Klant niet gevonden' });
  try {
    const updated = await prisma.customer.update({
      where: { id },
      data: { selectedCalendarId: calendarId || null },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const customer = await prisma.customer.findFirst({ where: { id, userId: req.session.userId } });
  if (!customer) return res.status(404).json({ error: 'Klant niet gevonden' });
  try {
    await prisma.customer.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
