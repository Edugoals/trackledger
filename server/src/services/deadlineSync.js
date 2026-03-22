import { PrismaClient } from '@prisma/client';
import { getCalendarClient } from '../config/google.js';

const prisma = new PrismaClient();

const DEADLINE_EVENT_PREFIX = 'DEADLINE – ';
const TRACKLEDGER_TYPE = 'trackledgerType';
const TRACKLEDGER_DEADLINE = 'deadline';
const TRACKTASK_ID_KEY = 'trackTaskId';

function toDateString(d) {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nextDateStr(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return toDateString(d);
}

function buildDeadlineEventBody(tt, taskName, trackName) {
  const summary = `${DEADLINE_EVENT_PREFIX}${taskName} – ${trackName}`;
  const dateStr = toDateString(tt.deadlineAt);
  return {
    summary,
    description: `TrackLedger deadline for task "${taskName}" on track "${trackName}". TrackTask ID: ${tt.id}`,
    start: { date: dateStr },
    end: { date: nextDateStr(dateStr) },
    extendedProperties: {
      private: {
        [TRACKLEDGER_TYPE]: TRACKLEDGER_DEADLINE,
        [TRACKTASK_ID_KEY]: String(tt.id),
      },
    },
  };
}

export function isDeadlineEvent(ge) {
  const priv = ge?.extendedProperties?.private;
  return priv && priv[TRACKLEDGER_TYPE] === TRACKLEDGER_DEADLINE;
}

export async function syncDeadlineToGoogle(tt) {
  const trackTask = await prisma.trackTask.findUnique({
    where: { id: tt.id },
    include: { task: true, track: { include: { job: { include: { customer: true } } } } },
  });
  if (!trackTask?.deadlineAt) return { status: 'DELETED' };

  const customer = trackTask.track?.job?.customer;
  const calendarId = customer?.selectedCalendarId;
  if (!calendarId) {
    await prisma.trackTask.update({
      where: { id: tt.id },
      data: {
        deadlineSyncStatus: 'ERROR',
        deadlineSyncError: 'Geen agenda gekoppeld aan klant',
      },
    });
    return { status: 'ERROR', error: 'Geen agenda gekoppeld aan klant' };
  }

  const user = await prisma.user.findUnique({
    where: { id: customer.userId },
  });
  if (!user?.googleAccessToken) {
    await prisma.trackTask.update({
      where: { id: tt.id },
      data: {
        deadlineSyncStatus: 'ERROR',
        deadlineSyncError: 'Geen Google-koppeling',
      },
    });
    return { status: 'ERROR', error: 'Geen Google-koppeling' };
  }

  const calendar = getCalendarClient(user.googleAccessToken, user.googleRefreshToken);
  const taskName = trackTask.task?.name || 'Task';
  const trackName = trackTask.track?.name || 'Track';
  const body = buildDeadlineEventBody(trackTask, taskName, trackName);

  try {
    if (trackTask.deadlineGoogleEventId) {
      await calendar.events.patch({
        calendarId,
        eventId: trackTask.deadlineGoogleEventId,
        requestBody: body,
      });
      await prisma.trackTask.update({
        where: { id: tt.id },
        data: {
          deadlineSyncStatus: 'SYNCED',
          deadlineLastSyncedAt: new Date(),
          deadlineSyncError: null,
        },
      });
      return { status: 'SYNCED' };
    } else {
      const { data } = await calendar.events.insert({
        calendarId,
        requestBody: body,
      });
      await prisma.trackTask.update({
        where: { id: tt.id },
        data: {
          deadlineGoogleEventId: data.id,
          deadlineSyncStatus: 'SYNCED',
          deadlineLastSyncedAt: new Date(),
          deadlineSyncError: null,
        },
      });
      return { status: 'SYNCED', googleEventId: data.id };
    }
  } catch (e) {
    const errMsg = e?.message || String(e);
    await prisma.trackTask.update({
      where: { id: tt.id },
      data: {
        deadlineSyncStatus: 'ERROR',
        deadlineSyncError: errMsg,
      },
    });
    return { status: 'ERROR', error: errMsg };
  }
}

export async function removeDeadlineFromGoogle(tt) {
  if (!tt.deadlineGoogleEventId) return { status: 'DELETED' };

  const trackTask = await prisma.trackTask.findUnique({
    where: { id: tt.id },
    include: { track: { include: { job: { include: { customer: true } } } } },
  });

  const customer = trackTask?.track?.job?.customer;
  const calendarId = customer?.selectedCalendarId;
  if (!calendarId) {
    await prisma.trackTask.update({
      where: { id: tt.id },
      data: {
        deadlineGoogleEventId: null,
        deadlineSyncStatus: 'DELETED',
        deadlineSyncError: null,
      },
    });
    return { status: 'DELETED' };
  }

  const user = await prisma.user.findUnique({
    where: { id: customer.userId },
  });
  if (!user?.googleAccessToken) {
    await prisma.trackTask.update({
      where: { id: tt.id },
      data: {
        deadlineGoogleEventId: null,
        deadlineSyncStatus: 'DELETED',
        deadlineSyncError: null,
      },
    });
    return { status: 'DELETED' };
  }

  try {
    const calendar = getCalendarClient(user.googleAccessToken, user.googleRefreshToken);
    await calendar.events.delete({
      calendarId,
      eventId: tt.deadlineGoogleEventId,
    });
  } catch (e) {
    // Event may already be deleted in Google - treat as removed
  }

  await prisma.trackTask.update({
    where: { id: tt.id },
    data: {
      deadlineGoogleEventId: null,
      deadlineSyncStatus: 'DELETED',
      deadlineSyncError: null,
    },
  });
  return { status: 'DELETED' };
}
