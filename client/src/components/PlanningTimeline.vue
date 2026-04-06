<template>
  <section class="planning-timeline">
    <p class="tl-hint">
      Tijdlijn op basis van project- en trackdata, deadlines en gekoppelde agenda-afspraken. Horizontaal scrollen bij veel weken.
    </p>

    <div v-if="!projects?.length" class="muted">Geen projecten om te tonen.</div>

    <div v-else class="tl-shell">
      <div class="tl-left">
        <div class="tl-corner" />
        <div
          v-for="row in flatRows"
          :key="row.key"
          class="tl-label"
          :class="'tl-label-' + row.kind"
        >
          <template v-if="row.kind === 'project'">
            <span class="tl-proj-title">{{ row.project.name }}</span>
            <span v-if="row.project.customerName" class="tl-sub">{{ row.project.customerName }}</span>
            <span class="tl-sub muted-sm">{{ row.project.trackCount }} tracks</span>
          </template>
          <template v-else>
            <router-link
              class="tl-track-link"
              :to="{ name: 'track', params: { projectId: row.project.id, trackId: row.track.id } }"
            >
              {{ row.track.name }}
            </router-link>
            <span class="tl-sub">{{ row.track.workflow?.label }} · {{ row.track.progress?.label }}</span>
          </template>
        </div>
      </div>

      <div ref="scrollRef" class="tl-scroll">
        <div
          class="tl-inner"
          :style="{ width: innerWidthPx + 'px', minHeight: innerMinHeightPx + 'px' }"
        >
          <div class="tl-weeks">
            <div
              v-for="(w, i) in weekTicks"
              :key="'w' + i"
              class="tl-week-col"
              :style="{ width: weekWidthPx + 'px' }"
            >
              <span class="tl-week-label">{{ w.label }}</span>
            </div>
          </div>

          <div
            class="tl-today"
            :style="{ left: todayLeftPx + 'px' }"
            title="Vandaag"
          />

          <div
            v-for="row in flatRows"
            :key="'r' + row.key"
            class="tl-row"
            :style="{ height: rowMinHeight + 'px' }"
          >
            <div class="tl-rail">
              <template v-if="row.kind === 'project'">
                <div
                  v-if="row.projectBar"
                  class="tl-bar tl-bar-project"
                  :class="{ 'tl-fallback': row.projectBar.fallback }"
                  :style="barStyle(row.projectBar.start, row.projectBar.end)"
                  :title="tooltipProject(row.project)"
                />
              </template>
              <template v-else>
                <div
                  v-if="row.trackBar"
                  class="tl-bar tl-bar-track"
                  :class="{ 'tl-fallback': row.trackBar.fallback }"
                  :style="barStyle(row.trackBar.start, row.trackBar.end)"
                  :title="tooltipTrack(row.track, row.trackBar)"
                />
                <template v-for="d in row.deadlineMarkers" :key="'d' + d.trackTaskId">
                  <router-link
                    class="tl-marker tl-marker-deadline"
                    :class="'m-' + d.bucket"
                    :style="{ left: markerLeftPx(d.deadlineAt) + 'px' }"
                    :to="{ name: 'track', params: { projectId: row.project.id, trackId: row.track.id } }"
                    :title="tooltipDeadline(d)"
                  >
                    ◆
                  </router-link>
                </template>
                <template v-for="a in row.appointmentMarkers" :key="'a' + a.id">
                  <router-link
                    class="tl-marker tl-marker-appt"
                    :style="{ left: markerLeftPx(a.start) + 'px' }"
                    :to="{ name: 'track', params: { projectId: row.project.id, trackId: row.track.id } }"
                    :title="tooltipAppt(a)"
                  >
                    ■
                  </router-link>
                </template>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  projects: { type: Array, default: () => [] },
})

const scrollRef = ref(null)
const weekWidthPx = 88
const rowMinHeight = 52

function startOfWeekMonday(d) {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

const range = computed(() => {
  let minT = Infinity
  let maxT = -Infinity
  const bump = (iso) => {
    if (!iso) return
    const t = new Date(iso).getTime()
    if (Number.isFinite(t)) {
      minT = Math.min(minT, t)
      maxT = Math.max(maxT, t)
    }
  }
  for (const p of props.projects || []) {
    bump(p.derivedStartDate)
    bump(p.derivedEndDate)
    for (const tr of p.tracks || []) {
      bump(tr.startDate)
      bump(tr.targetEndDate)
      for (const d of tr.deadlinesAll || []) bump(d.deadlineAt)
      for (const a of tr.appointmentsAll || []) {
        bump(a.start)
        bump(a.end)
      }
    }
  }
  const now = Date.now()
  if (minT === Infinity) {
    minT = now - 14 * 86400000
    maxT = now + 70 * 86400000
  } else {
    minT = Math.min(minT, now - 7 * 86400000)
    maxT = Math.max(maxT, now + 7 * 86400000)
  }
  const start = startOfWeekMonday(new Date(minT))
  start.setDate(start.getDate() - 7)
  let end = new Date(maxT)
  const minSpan = 12 * 7 * 86400000
  if (end.getTime() - start.getTime() < minSpan) {
    end = new Date(start.getTime() + minSpan)
  } else {
    end = new Date(end.getTime() + 7 * 86400000)
  }
  return { start, end }
})

const totalMs = computed(() => {
  const { start, end } = range.value
  return Math.max(1, end.getTime() - start.getTime())
})

const weekCount = computed(() => {
  const w = Math.ceil(totalMs.value / (7 * 86400000))
  return Math.max(w, 8)
})

const innerWidthPx = computed(() => weekCount.value * weekWidthPx)

const weekTicks = computed(() => {
  const { start } = range.value
  const out = []
  for (let i = 0; i < weekCount.value; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i * 7)
    out.push({
      label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    })
  }
  return out
})

function pxFromIso(iso) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  const { start, end } = range.value
  const p = (t - start.getTime()) / (end.getTime() - start.getTime())
  return p * innerWidthPx.value
}

function markerLeftPx(iso) {
  const x = pxFromIso(iso)
  if (x == null || Number.isNaN(x)) return 0
  return Math.max(0, Math.min(innerWidthPx.value - 2, x))
}

const todayLeftPx = computed(() => {
  const x = pxFromIso(new Date().toISOString())
  if (x == null) return 0
  return Math.max(0, Math.min(innerWidthPx.value - 1, x))
})

function barStyle(startIso, endIso) {
  const s = pxFromIso(startIso)
  const e = pxFromIso(endIso)
  if (s == null || e == null) return { display: 'none' }
  const left = Math.min(s, e)
  const w = Math.max(4, Math.abs(e - s))
  return {
    left: left + 'px',
    width: w + 'px',
  }
}

function projectBar(p) {
  if (!p.derivedStartDate || !p.derivedEndDate) return null
  const s = new Date(p.derivedStartDate)
  const e = new Date(p.derivedEndDate)
  if (e < s) return null
  return { start: p.derivedStartDate, end: p.derivedEndDate, fallback: false }
}

function trackBar(tr) {
  const dAll = tr.deadlinesAll || []
  const aAll = tr.appointmentsAll || []
  let s = tr.startDate ? new Date(tr.startDate) : null
  let e = tr.targetEndDate ? new Date(tr.targetEndDate) : null
  if (s && e && e >= s) {
    return { start: tr.startDate, end: tr.targetEndDate, fallback: false }
  }
  const times = []
  for (const d of dAll) {
    if (d.deadlineAt) times.push(new Date(d.deadlineAt).getTime())
  }
  for (const a of aAll) {
    if (a.start) times.push(new Date(a.start).getTime())
    if (a.end) times.push(new Date(a.end).getTime())
  }
  if (!times.length) return null
  const minT = Math.min(...times)
  const maxT = Math.max(...times)
  return {
    start: new Date(minT).toISOString(),
    end: new Date(maxT).toISOString(),
    fallback: !(tr.startDate && tr.targetEndDate),
  }
}

const flatRows = computed(() => {
  const rows = []
  for (const p of props.projects || []) {
    rows.push({
      kind: 'project',
      key: 'p-' + p.id,
      project: p,
      projectBar: projectBar(p),
      deadlineMarkers: [],
      appointmentMarkers: [],
    })
    for (const tr of p.tracks || []) {
      rows.push({
        kind: 'track',
        key: 't-' + tr.id,
        project: p,
        track: tr,
        trackBar: trackBar(tr),
        deadlineMarkers: tr.deadlinesAll || [],
        appointmentMarkers: tr.appointmentsAll || [],
      })
    }
  }
  return rows
})

const innerMinHeightPx = computed(() => 36 + rowMinHeight * flatRows.value.length)

function tooltipProject(p) {
  const a = p.derivedStartDate ? new Date(p.derivedStartDate).toLocaleDateString() : '—'
  const b = p.derivedEndDate ? new Date(p.derivedEndDate).toLocaleDateString() : '—'
  return `${p.name}\nProjectperiode (afgeleid): ${a} – ${b}`
}

function tooltipTrack(tr, bar) {
  const fb = bar?.fallback ? ' (afgeleid uit deadlines/agenda)' : ''
  const a = tr.startDate ? new Date(tr.startDate).toLocaleDateString() : '—'
  const b = tr.targetEndDate ? new Date(tr.targetEndDate).toLocaleDateString() : '—'
  return `${tr.name}\nTrack: ${a} – ${b}${fb}`
}

function tooltipDeadline(d) {
  const when = new Date(d.deadlineAt).toLocaleString(undefined, { dateStyle: 'medium' })
  return `Deadline: ${d.taskTitle}\n${when}\nStatus: ${d.status}`
}

function tooltipAppt(a) {
  const s = new Date(a.start).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return `Afspraak: ${a.title}\n${s}`
}
</script>

<style scoped>
.planning-timeline {
  margin-top: 0.5rem;
}
.tl-hint {
  font-size: 0.85rem;
  color: #6b7280;
  margin: 0 0 1rem;
  line-height: 1.4;
}
.muted {
  color: #9ca3af;
  font-size: 0.9rem;
}
.tl-shell {
  display: flex;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #fafafa;
}
.tl-left {
  flex: 0 0 220px;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  z-index: 3;
}
.tl-corner {
  height: 36px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}
.tl-label {
  min-height: 52px;
  padding: 0.35rem 0.65rem;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-size: 0.82rem;
}
.tl-label-project {
  background: linear-gradient(90deg, #f8fafc 0%, #fff 100%);
}
.tl-label-track {
  padding-left: 1rem;
}
.tl-proj-title {
  font-weight: 600;
  color: #111827;
}
.tl-sub {
  font-size: 0.72rem;
  color: #6b7280;
}
.muted-sm {
  opacity: 0.85;
}
.tl-track-link {
  font-weight: 600;
  color: #213547;
  text-decoration: none;
}
.tl-track-link:hover {
  text-decoration: underline;
}
.tl-scroll {
  flex: 1;
  overflow-x: auto;
  overflow-y: visible;
  min-width: 0;
}
.tl-inner {
  position: relative;
  background: #fff;
}
.tl-weeks {
  display: flex;
  height: 36px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}
.tl-week-col {
  flex-shrink: 0;
  border-right: 1px solid #f3f4f6;
  font-size: 0.7rem;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tl-week-label {
  white-space: nowrap;
}
.tl-today {
  position: absolute;
  top: 36px;
  bottom: 0;
  width: 2px;
  background: rgba(37, 99, 235, 0.45);
  z-index: 2;
  pointer-events: none;
}
.tl-row {
  position: relative;
  border-bottom: 1px solid #f3f4f6;
}
.tl-rail {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
}
.tl-bar {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 14px;
  border-radius: 6px;
  min-width: 4px;
}
.tl-bar-project {
  background: rgba(148, 163, 184, 0.55);
  border: 1px solid #94a3b8;
}
.tl-bar-track {
  background: rgba(33, 53, 71, 0.2);
  border: 1px solid #213547;
}
.tl-bar.tl-fallback {
  opacity: 0.65;
  border-style: dashed;
}
.tl-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  line-height: 1;
  text-decoration: none;
  z-index: 2;
  cursor: pointer;
}
.tl-marker-deadline {
  color: #b45309;
}
.tl-marker-deadline.m-overdue {
  color: #b91c1c;
}
.tl-marker-deadline.m-soon {
  color: #ca8a04;
}
.tl-marker-deadline.m-done {
  color: #059669;
}
.tl-marker-deadline.m-upcoming {
  color: #4f46e5;
}
.tl-marker-appt {
  color: #2563eb;
  font-size: 9px;
}
.tl-marker:hover {
  filter: brightness(1.15);
  z-index: 4;
}
</style>
