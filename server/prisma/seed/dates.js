/**
 * Local date helpers for seed deadlines and calendar events (dev-friendly, not UTC-perfect).
 */
export function daysFromNow(dayOffset, hour = 12, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function windowOnDay(dayOffset, startHour, endHour) {
  const start = daysFromNow(dayOffset, startHour, 0);
  const end = daysFromNow(dayOffset, endHour, 0);
  return { start, end };
}

export function durationMinutes(start, end) {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}
