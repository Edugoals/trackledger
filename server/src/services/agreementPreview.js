function computeDurationMinutes(event) {
  if (event.durationMinutes != null) return event.durationMinutes;
  if (event.start && event.end) return Math.round((new Date(event.end) - new Date(event.start)) / 60000);
  return null;
}

/**
 * Normalized agreement payload for preview, future PDF, and optional snapshots.
 * Bump `schemaVersion` when the shape changes for stored snapshots.
 */
export async function buildAgreementPreviewData(prisma, { userId, trackId }) {
  const track = await prisma.track.findFirst({
    where: { id: trackId, userId },
    include: {
      job: { include: { customer: true } },
    },
  });

  if (!track) return null;

  const producer = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const trackTasks = await prisma.trackTask.findMany({
    where: { trackId, userId },
    include: { task: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  const ttIds = trackTasks.map((tt) => tt.id);

  let planningEvents = [];
  if (ttIds.length > 0 && track.customerId) {
    const rawEvents = await prisma.calendarEvent.findMany({
      where: {
        userId,
        customerId: track.customerId,
        assignedTrackTaskId: { in: ttIds },
      },
      include: {
        assignedTrackTask: { include: { task: true } },
      },
      orderBy: { start: 'asc' },
    });

    planningEvents = rawEvents.map((ev) => {
      const taskTitle =
        ev.assignedTrackTask?.titleOverride?.trim() ||
        ev.assignedTrackTask?.task?.name ||
        null;
      return {
        title: ev.title,
        start: ev.start.toISOString(),
        end: ev.end.toISOString(),
        durationMinutes: computeDurationMinutes(ev),
        assignedToTaskTitle: taskTitle,
        location: ev.location || null,
      };
    });
  }

  const scopeItems = trackTasks.map((tt, index) => ({
    position: index + 1,
    title: (tt.titleOverride && tt.titleOverride.trim()) || tt.task.name,
    status: tt.status,
    deadlineAt: tt.deadlineAt ? tt.deadlineAt.toISOString() : null,
    estimatedHours: tt.estimatedHours != null ? Number(tt.estimatedHours) : null,
    notes: tt.notes?.trim() || null,
  }));

  const customer = track.job.customer;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    producer: {
      name: producer?.name?.trim() || null,
      email: producer?.email?.trim() || null,
    },
    customer: {
      name: customer.name,
      email: customer.email?.trim() || null,
    },
    job: {
      name: track.job.name,
      periodStart: track.job.startDate.toISOString(),
      periodEnd: track.job.endDate.toISOString(),
    },
    track: {
      name: track.name,
      financial: {
        agreedPrice: track.agreedPrice != null ? Number(track.agreedPrice) : null,
        currency: track.currency || 'EUR',
        pricingNotes: track.pricingNotes?.trim() || null,
        isPriceFinal: !!track.isPriceFinal,
      },
    },
    scopeItems,
    planningEvents,
    generalNotes: null,
  };
}
