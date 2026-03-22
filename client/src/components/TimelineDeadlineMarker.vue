<template>
  <div
    ref="markerRef"
    class="deadline-marker"
    :class="statusClass"
    :style="markerStyle"
    @mouseenter="onMouseEnter"
    @mouseleave="showTooltip = false"
  >
    <Teleport to="body">
      <div
        v-if="showTooltip"
        class="timeline-tooltip"
        :style="tooltipStyle"
      >
        <div class="tooltip-title">{{ taskName }}</div>
        <div class="tooltip-row">{{ formatShortDate(deadline.deadlineAt) }}</div>
        <div :class="['tooltip-row', 'status', statusClass]">{{ statusLabel }}</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { formatShortDate } from '../utils'
import { getDeadlineStatus } from '../utils/timelineUtils'

const props = defineProps({
  deadline: { type: Object, required: true },
  left: { type: Number, required: true },
})

const showTooltip = ref(false)
const markerRef = ref(null)
const tooltipPos = ref({ left: 0, top: 0 })

const taskName = computed(() =>
  props.deadline?.task?.name ?? props.deadline?.taskName ?? 'Task'
)

const status = computed(() => getDeadlineStatus(props.deadline?.deadlineAt))
const statusClass = computed(() => status.value)
const statusLabel = computed(() => {
  if (status.value === 'overdue') return 'Overdue'
  if (status.value === 'today') return 'Due today'
  return 'Upcoming'
})

const markerStyle = computed(() => ({
  left: `${props.left * 100}%`,
}))

const tooltipStyle = computed(() => ({
  left: `${tooltipPos.value.left}px`,
  top: `${tooltipPos.value.top}px`,
}))

function onMouseEnter() {
  showTooltip.value = true
  nextTick(() => {
    const rect = markerRef.value?.getBoundingClientRect()
    if (rect && typeof window !== 'undefined') {
      const centerX = rect.left + rect.width / 2
      const top = rect.bottom + 8
      tooltipPos.value = {
        left: centerX,
        top: Math.min(top, window.innerHeight - 100),
      }
    }
  })
}
</script>

<style scoped>
.deadline-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}
.deadline-marker::before {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6b7280;
  box-shadow: 0 0 0 2px white;
}
.deadline-marker.upcoming::before { background: #60a5fa; }
.deadline-marker.today::before { background: #f59e0b; }
.deadline-marker.overdue::before { background: #dc2626; }

.timeline-tooltip {
  position: fixed;
  transform: translateX(-50%);
  z-index: 100;
  min-width: 140px;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  font-size: 0.85rem;
  pointer-events: none;
}
.tooltip-title { font-weight: 500; margin-bottom: 0.25rem; }
.tooltip-row { color: #6b7280; font-size: 0.8rem; }
.tooltip-row.status { font-weight: 500; margin-top: 0.2rem; }
.tooltip-row.status.upcoming { color: #3b82f6; }
.tooltip-row.status.today { color: #f59e0b; }
.tooltip-row.status.overdue { color: #dc2626; }
</style>
