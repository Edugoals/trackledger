import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { suggestTrackTaskFromTitle } from '../services/eventAssignment.js';
import { syncDeadlineToGoogle, removeDeadlineFromGoogle } from '../services/deadlineSync.js';

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

function computeDurationMinutes(event) {
  if (event.durationMinutes != null) return event.durationMinutes;
  if (event.start && event.end) return Math.round((new Date(event.end) - new Date(event.start)) / 60000);
  return 0;
}

function computeTrackAggregation(trackTasks, eventDerivedActuals = {}, unmappedMinutes = 0) {
  const totalEstimated = trackTasks.reduce((s, tt) => s + (parseFloat(tt.estimatedHours) || 0), 0);
  const totalActualFromEvents = Object.values(eventDerivedActuals).reduce((s, h) => s + h, 0);
  const totalActualManual = trackTasks.reduce((s, tt) => s + (parseFloat(tt.actualHours) || 0), 0);
  const totalActual = totalActualFromEvents > 0 ? totalActualFromEvents : totalActualManual;
  const hoursDifference = totalActual - totalEstimated;
  const overrunPercentage = totalEstimated > 0 ? (hoursDifference / totalEstimated) * 100 : null;
  const unassignedHours = unmappedMinutes / 60;
  return {
    totalEstimatedHours: totalEstimated,
    totalActualHours: totalActual,
    hoursDifference,
    overrunPercentage,
    unassignedEventHours: unassignedHours,
    unassignedEventMinutes: unmappedMinutes,
  };
}

router.get('/tracks/:trackId/tasks', ensureTrackAccess, async (req, res) => {
  try {
    const track = req.track;
    const customer = track.job?.customer || (await prisma.track.findUnique({ where: { id: track.id }, include: { job: { include: { customer: true } } } }))?.job?.customer;
    const calendarId = customer?.selectedCalendarId;

    const trackTasks = await prisma.trackTask.findMany({
      where: { trackId: track.id },
      include: { task: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    const eventDerivedActuals = {};
    let unmappedMinutes = 0;
    const mappedCounts = {};

    if (calendarId && track.customerId) {
      const events = await prisma.calendarEvent.findMany({
        where: { customerId: track.customerId, calendarId, userId: req.session.userId },
        include: { assignedTrackTask: true },
      });
      for (const ev of events) {
        const mins = computeDurationMinutes(ev);
        if (ev.assignedTrackTaskId && ev.assignedTrackTask?.trackId === track.id) {
          eventDerivedActuals[ev.assignedTrackTaskId] = (eventDerivedActuals[ev.assignedTrackTaskId] || 0) + mins / 60;
          mappedCounts[ev.assignedTrackTaskId] = (mappedCounts[ev.assignedTrackTaskId] || 0) + 1;
        } else if (!ev.assignedTrackTaskId) {
          unmappedMinutes += mins;
        }
      }
    }

    const outTrackTasks = trackTasks.map((tt) => {
      const fromEvents = eventDerivedActuals[tt.id] ?? 0;
      const manual = parseFloat(tt.actualHours) || 0;
      const actualHours = fromEvents > 0 ? fromEvents : manual;
      return {
        ...tt,
        actualHoursFromEvents: fromEvents,
        actualHours,
        mappedEventCount: mappedCounts[tt.id] ?? 0,
      };
    });

    const aggregation = computeTrackAggregation(trackTasks, eventDerivedActuals, unmappedMinutes);
    res.json({ trackTasks: outTrackTasks, aggregation });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/tracks/:trackId/events', ensureTrackAccess, async (req, res) => {
  try {
    const track = req.track;
    const customer = track.job?.customer || (await prisma.track.findUnique({ where: { id: track.id }, include: { job: { include: { customer: true } } } }))?.job?.customer;
    const calendarId = customer?.selectedCalendarId;
    if (!calendarId || !track.customerId) return res.json({ events: [], suggestedAssignments: {} });

    const events = await prisma.calendarEvent.findMany({
      where: { customerId: track.customerId, calendarId, userId: req.session.userId },
      include: { assignedTrackTask: { include: { task: true } } },
      orderBy: { start: 'asc' },
    });

    const trackTasks = await prisma.trackTask.findMany({
      where: { trackId: track.id },
      include: { task: true },
    });

    const suggestedAssignments = {};
    const outEvents = events.map((ev) => {
      const durationMinutes = computeDurationMinutes(ev);
      const item = {
        id: ev.id,
        title: ev.title,
        start: ev.start,
        end: ev.end,
        durationMinutes,
        assignedTrackTaskId: ev.assignedTrackTaskId,
        assignmentSource: ev.assignmentSource,
        assignedTrackTask: ev.assignedTrackTask ? { id: ev.assignedTrackTask.id, task: ev.assignedTrackTask.task } : null,
      };
      if (!ev.assignedTrackTaskId && ev.title) {
        const suggestion = suggestTrackTaskFromTitle(ev.title, trackTasks);
        if (suggestion) suggestedAssignments[ev.id] = suggestion;
      }
      return item;
    });

    res.json({ events: outEvents, suggestedAssignments });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/tracks/:trackId/tasks/reorder', ensureTrackAccess, async (req, res) => {
  const { trackTaskIds } = req.body;
  if (!Array.isArray(trackTaskIds) || trackTaskIds.length === 0) {
    return res.status(400).json({ error: 'trackTaskIds array verplicht' });
  }
  const ids = trackTaskIds.map((id) => parseInt(id)).filter((n) => !isNaN(n));
  if (ids.length !== trackTaskIds.length) {
    return res.status(400).json({ error: 'Ongeldige trackTaskIds' });
  }
  try {
    const existing = await prisma.trackTask.findMany({
      where: { id: { in: ids }, trackId: req.track.id },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((tt) => tt.id));
    if (existingIds.size !== ids.length) {
      return res.status(400).json({ error: 'Niet alle tasks behoren tot dit track' });
    }
    const updates = ids.map((id, index) =>
      prisma.trackTask.update({
        where: { id },
        data: { sortOrder: index },
      })
    );
    await prisma.$transaction(updates);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tracks/:trackId/tasks', ensureTrackAccess, async (req, res) => {
  const { taskId, notes, estimatedHours, insertIndex } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId verplicht' });
  const task = await prisma.task.findFirst({
    where: { id: parseInt(taskId), userId: req.session.userId },
  });
  if (!task) return res.status(404).json({ error: 'Task niet gevonden' });
  const estHours = estimatedHours !== undefined ? parseDecimal(estimatedHours) : null;
  if (estHours !== null && estHours < 0) return res.status(400).json({ error: 'estimatedHours moet >= 0 zijn' });
  const hours = estHours ?? (task.defaultEstimatedHours ? parseFloat(task.defaultEstimatedHours) : null);
  try {
    let sortOrder;
    if (insertIndex !== undefined && insertIndex !== null && insertIndex !== '') {
      const idx = parseInt(insertIndex);
      if (isNaN(idx) || idx < 0) return res.status(400).json({ error: 'insertIndex moet >= 0 zijn' });
      await prisma.trackTask.updateMany({
        where: { trackId: req.track.id, sortOrder: { gte: idx } },
        data: { sortOrder: { increment: 1 } },
      });
      sortOrder = idx;
    } else {
      const maxOrder = await prisma.trackTask
        .aggregate({
          where: { trackId: req.track.id },
          _max: { sortOrder: true },
        })
        .then((r) => (r._max.sortOrder ?? -1) + 1);
      sortOrder = maxOrder;
    }
    const trackTask = await prisma.trackTask.create({
      data: {
        trackId: req.track.id,
        taskId: task.id,
        notes: notes?.trim() || null,
        estimatedHours: hours,
        sortOrder,
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
  const { notes, estimatedHours, actualHours, status, sortOrder, deadlineAt } = req.body;
  const estHours = estimatedHours !== undefined ? parseDecimal(estimatedHours) : undefined;
  const actHours = actualHours !== undefined ? parseDecimal(actualHours) : undefined;
  if (estHours !== undefined && estHours !== null && estHours < 0) return res.status(400).json({ error: 'estimatedHours moet >= 0 zijn' });
  if (actHours !== undefined && (actHours < 0 || isNaN(actHours))) return res.status(400).json({ error: 'actualHours moet >= 0 zijn' });
  if (status !== undefined && !STATUS_VALUES.includes(status)) return res.status(400).json({ error: 'Ongeldige status' });

  const deadlineValue = deadlineAt !== undefined
    ? (deadlineAt === null || deadlineAt === '' ? null : new Date(deadlineAt))
    : undefined;

  try {
    const prevTask = await prisma.trackTask.findUnique({
      where: { id: req.trackTask.id },
      select: { id: true, deadlineAt: true, deadlineGoogleEventId: true },
    });

    const updated = await prisma.trackTask.update({
      where: { id: req.trackTask.id },
      data: {
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(estHours !== undefined && { estimatedHours: estHours }),
        ...(actHours !== undefined && { actualHours: actHours }),
        ...(status !== undefined && { status }),
        ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) || 0 }),
        ...(deadlineValue !== undefined && {
          deadlineAt: deadlineValue,
          deadlineSyncStatus: deadlineValue ? 'PENDING' : null,
          deadlineSyncError: null,
        }),
      },
      include: { task: true, track: true },
    });

    if (deadlineValue !== undefined) {
      if (deadlineValue) {
        await syncDeadlineToGoogle(updated);
      } else if (prevTask?.deadlineGoogleEventId) {
        await removeDeadlineFromGoogle(prevTask);
      }
      const fresh = await prisma.trackTask.findUnique({
        where: { id: req.trackTask.id },
        include: { task: true },
      });
      return res.json(fresh);
    }
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
