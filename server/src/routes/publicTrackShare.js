import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * Public read-only track plan for customers (no auth, token in URL).
 * Does not expose internal ids, user data, or internal notes.
 */
router.get('/track-share/:token', async (req, res) => {
  const raw = req.params.token;
  if (!raw?.trim()) return res.status(400).json({ error: 'Token ontbreekt' });

  try {
    const share = await prisma.trackShare.findFirst({
      where: { token: raw.trim(), isActive: true },
      include: {
        track: {
          include: {
            job: true,
            customer: true,
            trackTasks: {
              include: { task: { select: { name: true } } },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });

    if (!share) {
      return res.status(404).json({ error: 'Deze link bestaat niet of is uitgeschakeld.' });
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Deze link is verlopen.' });
    }

    const track = share.track;
    const ttIds = track.trackTasks.map((tt) => tt.id);
    const counts =
      ttIds.length === 0
        ? []
        : await Promise.all(
            ttIds.map(async (id) => ({
              id,
              count: await prisma.calendarEvent.count({ where: { assignedTrackTaskId: id } }),
            }))
          );
    const countByTtId = Object.fromEntries(counts.map((c) => [c.id, c.count]));

    const items = track.trackTasks.map((tt, i) => ({
      position: i + 1,
      title: (tt.titleOverride && tt.titleOverride.trim()) || tt.task.name,
      status: tt.status,
      estimatedHours: tt.estimatedHours != null ? Number(tt.estimatedHours) : null,
      actualHours: Number(tt.actualHours),
      deadlineAt: tt.deadlineAt ? tt.deadlineAt.toISOString() : null,
      mappedCalendarEventCount: countByTtId[tt.id] ?? 0,
    }));

    const totalMapped = items.reduce((s, it) => s + it.mappedCalendarEventCount, 0);

    res.json({
      trackName: track.name,
      jobName: track.job.name,
      period: {
        start: track.job.startDate.toISOString(),
        end: track.job.endDate.toISOString(),
      },
      customerName: track.customer.name,
      items,
      totalMappedCalendarEvents: totalMapped,
    });
  } catch (e) {
    console.error('publicTrackShare:', e);
    res.status(500).json({ error: 'Kon plan niet laden.' });
  }
});

export default router;
