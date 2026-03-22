export function formatDate(d) {
  return new Date(d).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatShortDate(d) {
  return d ? new Date(d).toLocaleDateString('nl-NL', { dateStyle: 'short' }) : ''
}

export function formatHours(h) {
  if (h == null || h === '') return '—'
  const n = parseFloat(h)
  return isNaN(n) ? '—' : n.toFixed(1)
}

export function formatDuration(mins) {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function overrunStatus(totalEstimated, totalActual) {
  if (totalEstimated == null || totalEstimated <= 0) return 'neutral'
  const diff = (totalActual || 0) - totalEstimated
  const pct = (diff / totalEstimated) * 100
  if (pct <= 0) return 'ok'
  if (pct <= 15) return 'warning'
  return 'overrun'
}
