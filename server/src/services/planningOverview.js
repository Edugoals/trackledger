/**
 * Studio planning dashboard: samengestelde dataset voor GET /api/planning
 */

function toISO(d) {
  if (!d) return null;
  return new Date(d).toISOString();
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function minDate(...dates) {
  const t = dates.filter(Boolean).map((d) => new Date(d).getTime());
  if (!t.length) return null;
  return new Date(Math.min(...t));
}

function maxDate(...dates) {
  const t = dates.filter(Boolean).map((d) => new Date(d).getTime());
  if (!t.length) return null;
  return new Date(Math.max(...t));
}

function taskTitle(tt) {
  return (tt.titleOverride && tt.titleOverride.trim()) || tt.task?.name || 'Taak';
}

function progressSummary(trackTasks) {
  const total = trackTasks.length;
  const done = trackTasks.filter((t) => t.status === 'DONE').length;
  const open = total - done;
  return {
    total,
    done,
    open,
    label: total === 0 ? 'Geen taken' : `${done}/${total} afgerond`,
  };
}

function trackWorkflowStatus(trackTasks) {
  if (!trackTasks.length) return { key: 'empty', label: 'Geen taken' };
  const allDone = trackTasks.every((t) => t.status === 'DONE');
  if (allDone) return { key: 'done', label: 'Afgerond' };
  const anyProgress = trackTasks.some((t) => t.status === 'IN_PROGRESS' || t.status === 'DONE');
  if (anyProgress) return { key: 'active', label: 'Lopend' };
  return { key: 'not_started', label: 'Nog niet gestart' };
}

function nextDeadlineForTrack(trackTasks, now) {
  const sod = startOfDay(now);
  const candidates = trackTasks.filter((tt) => tt.status !== 'DONE' && tt.deadlineAt);
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => new Date(a.deadlineAt) - new Date(b.deadlineAt));
  return sorted[0] ? toISO(sorted[0].deadlineAt) : null;
}

function nextAppointmentForTrack(eventsForTrack, now) {
  const future = eventsForTrack.filter((e) => new Date(e.start) >= now);
  if (!future.length) return null;
  return toISO(future[0].start);
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {number} userId
 * @param {{ upcomingDays?: number, q?: string, status?: string, sort?: string }} opts
 */
export async function buildPlanningOverview(prisma, userId, opts = {}) {
  const upcomingDays = Math.min(Math.max(parseInt(opts.upcomingDays, 10) || 14, 1), 90);
  const q = (opts.q || '').trim().toLowerCase();
  const statusFilter = opts.status || 'all'; // all | active | completed
  const sort = opts.sort === 'name' ? 'name' : 'deadline';

  const now = new Date();
  const sod = startOfDay(now);
  const horizon = new Date(sod);
  horizon.setDate(horizon.getDate() + upcomingDays);
  const horizonEnd = endOfDay(horizon);

  const jobs = await prisma.job.findMany({
    where: { userId },
    include: {
      customer: true,
      tracks: {
        include: {
          trackTasks: {
            include: { task: true },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          },
        },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { startDate: 'desc' },
  });

  const customerIds = [...new Set(jobs.flatMap((j) => j.tracks.map((t) => t.customerId)))];
  const events =
    customerIds.length === 0
      ? []
      : await prisma.calendarEvent.findMany({
          where: {
            userId,
            customerId: { in: customerIds },
            assignedTrackTaskId: { not: null },
          },
          include: {
            assignedTrackTask: { select: { trackId: true } },
          },
          orderBy: { start: 'asc' },
        });

  const eventsByTrackId = new Map();
  for (const ev of events) {
    const tid = ev.assignedTrackTask?.trackId;
    if (tid == null) continue;
    if (!eventsByTrackId.has(tid)) eventsByTrackId.set(tid, []);
    eventsByTrackId.get(tid).push(ev);
  }

  const overdueDeadlines = [];
  const windowDeadlines = [];
  const windowAppointments = [];

  const projects = [];

  for (const job of jobs) {
    const customerName = job.customer?.name || null;
    const trackStarts = job.tracks.map((t) => t.startDate).filter(Boolean);
    const trackEnds = job.tracks.map((t) => t.targetEndDate).filter(Boolean);
    const allDeadlines = job.tracks.flatMap((t) =>
      t.trackTasks.map((tt) => tt.deadlineAt).filter(Boolean)
    );

    let derivedStart = minDate(job.startDate, ...trackStarts);
    if (!derivedStart && allDeadlines.length) derivedStart = minDate(...allDeadlines);
    if (!derivedStart) derivedStart = job.startDate;

    let derivedEnd = maxDate(job.endDate, ...trackEnds);
    if (!derivedEnd && allDeadlines.length) derivedEnd = maxDate(...allDeadlines);
    if (!derivedEnd) derivedEnd = job.endDate;

    const jobEndDay = startOfDay(job.endDate);
    const isCompletedByJob = jobEndDay < sod;

    const tracksOut = [];
    let projectNextDeadline = null;
    let projectNextAppt = null;

    for (const track of job.tracks) {
      const tEvents = eventsByTrackId.get(track.id) || [];
      const wf = trackWorkflowStatus(track.trackTasks);
      const prog = progressSummary(track.trackTasks);
      const nd = nextDeadlineForTrack(track.trackTasks, now);
      const na = nextAppointmentForTrack(tEvents, now);

      if (nd) {
        const tNd = new Date(nd).getTime();
        if (!projectNextDeadline || tNd < new Date(projectNextDeadline).getTime()) {
          projectNextDeadline = nd;
        }
      }
      if (na) {
        const tNa = new Date(na).getTime();
        if (!projectNextAppt || tNa < new Date(projectNextAppt).getTime()) {
          projectNextAppt = na;
        }
      }

      const deadlinesDetailed = track.trackTasks
        .filter((tt) => tt.deadlineAt)
        .map((tt) => {
          const d = new Date(tt.deadlineAt);
          let bucket = 'upcoming';
          if (tt.status === 'DONE') bucket = 'done';
          else if (d < sod) bucket = 'overdue';
          else if (d <= horizonEnd) bucket = 'soon';
          return {
            trackTaskId: tt.id,
            taskTitle: taskTitle(tt),
            deadlineAt: toISO(tt.deadlineAt),
            status: tt.status,
            bucket,
          };
        })
        .sort((a, b) => new Date(a.deadlineAt) - new Date(b.deadlineAt));

      const appointmentsDetailed = tEvents
        .filter((e) => new Date(e.start) >= new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000))
        .slice(0, 8)
        .map((e) => ({
          id: e.id,
          title: e.title,
          start: toISO(e.start),
          end: toISO(e.end),
        }));

      const appointmentsAll = tEvents.map((e) => ({
        id: e.id,
        title: e.title,
        start: toISO(e.start),
        end: toISO(e.end),
      }));

      const visibleCap = 5;
      const deadlinesVisible = deadlinesDetailed.slice(0, visibleCap);
      const deadlinesHidden = Math.max(0, deadlinesDetailed.length - visibleCap);

      for (const tt of track.trackTasks) {
        if (!tt.deadlineAt || tt.status === 'DONE') continue;
        const d = new Date(tt.deadlineAt);
        const row = {
          kind: 'deadline',
          projectId: job.id,
          projectName: job.name,
          trackId: track.id,
          trackName: track.name,
          customerName,
          title: taskTitle(tt),
          at: toISO(tt.deadlineAt),
          trackTaskId: tt.id,
        };
        if (d < sod) overdueDeadlines.push(row);
        else if (d >= sod && d <= horizonEnd) windowDeadlines.push(row);
      }

      for (const e of tEvents) {
        const st = new Date(e.start);
        if (st >= sod && st <= horizonEnd) {
          windowAppointments.push({
            kind: 'appointment',
            projectId: job.id,
            projectName: job.name,
            trackId: track.id,
            trackName: track.name,
            customerName,
            title: e.title,
            at: toISO(e.start),
            eventId: e.id,
          });
        }
      }

      tracksOut.push({
        id: track.id,
        name: track.name,
        jobId: job.id,
        customerId: track.customerId,
        startDate: toISO(track.startDate),
        targetEndDate: toISO(track.targetEndDate),
        workflow: wf,
        progress: prog,
        nextDeadline: nd,
        nextAppointment: na,
        appointmentCount: tEvents.length,
        deadlines: deadlinesVisible,
        deadlinesHidden,
        deadlinesTotal: deadlinesDetailed.length,
        appointmentsPreview: appointmentsDetailed,
        deadlinesAll: deadlinesDetailed,
        appointmentsAll,
      });
    }

    const projRow = {
      id: job.id,
      name: job.name,
      customerName,
      jobStartDate: toISO(job.startDate),
      jobEndDate: toISO(job.endDate),
      derivedStartDate: toISO(derivedStart),
      derivedEndDate: toISO(derivedEnd),
      trackCount: job.tracks.length,
      nextDeadline: projectNextDeadline,
      nextAppointment: projectNextAppt,
      isCompletedByJob,
      tracks: tracksOut,
    };

    projects.push(projRow);
  }

  function matchesSearch(p) {
    if (!q) return true;
    if (p.name.toLowerCase().includes(q)) return true;
    if (p.customerName && p.customerName.toLowerCase().includes(q)) return true;
    return p.tracks.some((t) => t.name.toLowerCase().includes(q));
  }

  function matchesStatus(p) {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'completed') return p.isCompletedByJob;
    if (statusFilter === 'active') return !p.isCompletedByJob;
    return true;
  }

  let filtered = projects.filter((p) => matchesSearch(p) && matchesStatus(p));

  if (sort === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  } else {
    filtered.sort((a, b) => {
      const ta = a.nextDeadline ? new Date(a.nextDeadline).getTime() : Infinity;
      const tb = b.nextDeadline ? new Date(b.nextDeadline).getTime() : Infinity;
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name, 'nl');
    });
  }

  const allowedJobIds = new Set(filtered.map((p) => p.id));
  const filterByProjects = (list) => list.filter((row) => allowedJobIds.has(row.projectId));

  const overdueF = filterByProjects(overdueDeadlines);
  const windowF = filterByProjects(windowDeadlines);
  const apptF = filterByProjects(windowAppointments);

  overdueF.sort((a, b) => new Date(a.at) - new Date(b.at));
  windowF.sort((a, b) => new Date(a.at) - new Date(b.at));
  apptF.sort((a, b) => new Date(a.at) - new Date(b.at));

  return {
    upcomingDays,
    upcoming: {
      overdueDeadlines: overdueF,
      upcomingDeadlines: windowF,
      upcomingAppointments: apptF,
    },
    projects: filtered,
  };
}
