/** Timeline helper utilities: date→position mapping and duration→color intensity. */

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Default visible range: 7 days back, 56 days (8 weeks) forward */
const BUFFER_DAYS_BACK = 7
const PLANNING_WEEKS = 8
const PLANNING_DAYS_FORWARD = PLANNING_WEEKS * 7

/**
 * Returns { start, end } as Date objects for the timeline range.
 * @param {Date} [from] - Optional anchor date (default: today)
 */
export function getTimelineRange(from = new Date()) {
  const today = new Date(from)
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - BUFFER_DAYS_BACK)
  const end = new Date(today)
  end.setDate(end.getDate() + PLANNING_DAYS_FORWARD)
  return { start, end }
}

/**
 * Maps a date to an x position (0–1) within the timeline range.
 * @param {Date|string} date
 * @param {{ start: Date, end: Date }} range
 * @returns {number} 0–1 normalized position
 */
export function dateToPosition(date, range) {
  const d = new Date(date)
  const t = d.getTime()
  const s = range.start.getTime()
  const e = range.end.getTime()
  if (t <= s) return 0
  if (t >= e) return 1
  return (t - s) / (e - s)
}

/**
 * Maps start + end dates to left position and width (0–1).
 * @param {Date|string} start
 * @param {Date|string} end
 * @param {{ start: Date, end: Date }} range
 * @returns {{ left: number, width: number }} both 0–1
 */
export function eventToLayout(start, end, range) {
  const left = dateToPosition(start, range)
  const right = dateToPosition(end, range)
  const width = Math.max(0.002, right - left) // min visible sliver
  return { left, width }
}

/**
 * Duration → color intensity mapping.
 * <= 1h → very light
 * >1h and <= 3h → medium-light
 * >3h and <= 6h → medium
 * >6h → darker
 */
const BLUE_SCALE = [
  { maxMinutes: 60, bg: '#dbeafe', border: '#93c5fd' },   // very light
  { maxMinutes: 180, bg: '#93c5fd', border: '#60a5fa' }, // medium-light
  { maxMinutes: 360, bg: '#60a5fa', border: '#3b82f6' }, // medium
  { maxMinutes: Infinity, bg: '#2563eb', border: '#1d4ed8' }, // darker
]

export function durationToColor(durationMinutes) {
  const mins = durationMinutes ?? 0
  for (const tier of BLUE_SCALE) {
    if (mins <= tier.maxMinutes) return tier
  }
  return BLUE_SCALE[BLUE_SCALE.length - 1]
}

/**
 * Deadline status for styling and tooltip.
 * @param {Date|string} deadlineAt
 * @returns {'upcoming'|'today'|'overdue'}
 */
export function getDeadlineStatus(deadlineAt) {
  if (!deadlineAt) return 'upcoming'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(deadlineAt)
  d.setHours(0, 0, 0, 0)
  if (d.getTime() < today.getTime()) return 'overdue'
  if (d.getTime() === today.getTime()) return 'today'
  return 'upcoming'
}
