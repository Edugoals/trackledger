import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth.js';
import { buildPlanningOverview } from '../services/planningOverview.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const data = await buildPlanningOverview(prisma, req.session.userId, {
      upcomingDays: req.query.days,
      q: req.query.q,
      status: req.query.status,
      sort: req.query.sort,
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
