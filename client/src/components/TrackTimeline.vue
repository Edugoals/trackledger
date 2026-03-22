<template>
  <section class="track-timeline">
    <div class="timeline-header">
      <span class="range-label">{{ rangeLabel }}</span>
      <span class="legend">
        <span class="legend-item"><span class="legend-block"></span> work session</span>
        <span class="legend-item"><span class="legend-marker"></span> deadline</span>
      </span>
    </div>
    <div class="timeline-rail" ref="railRef">
      <div class="today-line" :style="todayLineStyle"></div>
      <div class="events-band">
        <TimelineEventBlock
          v-for="ev in timelineEvents"
          :key="ev.id"
          :event="ev"
          :left="eventLayout[ev.id]?.left ?? 0"
          :width="eventLayout[ev.id]?.width ?? 0.01"
          :color="durationToColor(ev.durationMinutes)"
        />
      </div>
      <div class="deadlines-band">
        <TimelineDeadlineMarker
          v-for="d in timelineDeadlines"
          :key="d.id"
          :deadline="d"
          :left="deadlinePositions[d.id] ?? 0"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import TimelineEventBlock from './TimelineEventBlock.vue'
import TimelineDeadlineMarker from './TimelineDeadlineMarker.vue'
import { getTimelineRange, eventToLayout, dateToPosition, durationToColor } from '../utils/timelineUtils'
import { formatShortDate } from '../utils'

const props = defineProps({
  events: { type: Array, default: () => [] },
  trackTasks: { type: Array, default: () => [] },
  trackId: { type: [Number, String], default: null },
})

const railRef = ref(null)
const range = ref(getTimelineRange())

const rangeLabel = computed(() => {
  const { start, end } = range.value
  return `${formatShortDate(start)} – ${formatShortDate(end)}`
})

/** Events relevant to this track: unassigned or assigned to a track task on this track */
const timelineEvents = computed(() => {
  const trackTaskIds = new Set(props.trackTasks.map(tt => tt.id))
  return props.events.filter(ev => {
    if (!ev.start || !ev.end) return false
    const evStart = new Date(ev.start)
    const evEnd = new Date(ev.end)
    const rangeEnd = range.value.end.getTime()
    const rangeStart = range.value.start.getTime()
    if (evEnd.getTime() < rangeStart || evStart.getTime() > rangeEnd) return false
    if (!ev.assignedTrackTaskId) return true
    return trackTaskIds.has(ev.assignedTrackTaskId)
  })
})

const timelineDeadlines = computed(() =>
  props.trackTasks
    .filter(tt => tt.deadlineAt)
    .map(tt => ({
      id: tt.id,
      deadlineAt: tt.deadlineAt,
      task: tt.task,
      taskName: tt.task?.name,
    }))
)

const eventLayout = computed(() => {
  const out = {}
  for (const ev of timelineEvents.value) {
    const { left, width } = eventToLayout(ev.start, ev.end, range.value)
    out[ev.id] = { left, width }
  }
  return out
})

const deadlinePositions = computed(() => {
  const out = {}
  for (const d of timelineDeadlines.value) {
    out[d.id] = dateToPosition(d.deadlineAt, range.value)
  }
  return out
})

const todayPosition = computed(() => dateToPosition(new Date(), range.value))

const todayLineStyle = computed(() => ({
  left: `${todayPosition.value * 100}%`,
}))

watch(() => [props.events, props.trackTasks], () => {
  range.value = getTimelineRange()
}, { deep: true })
</script>

<style scoped>
.track-timeline {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
  color: #6b7280;
}

.range-label {
  font-weight: 500;
  color: #374151;
}

.legend {
  display: flex;
  gap: 1rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.legend-block {
  display: inline-block;
  width: 12px;
  height: 8px;
  border-radius: 2px;
  background: #93c5fd;
}

.legend-marker {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6b7280;
}

.timeline-rail {
  position: relative;
  height: 48px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.today-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #9ca3af;
  opacity: 0.7;
  z-index: 2;
}

.today-line::before {
  content: 'Today';
  position: absolute;
  left: 4px;
  top: -18px;
  font-size: 0.7rem;
  color: #9ca3af;
}

.events-band {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 24px;
}

.deadlines-band {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 24px;
}

.deadlines-band .deadline-marker {
  top: 0;
  bottom: 0;
}
</style>
