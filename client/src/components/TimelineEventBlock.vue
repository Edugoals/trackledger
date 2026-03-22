<template>
  <div
    ref="blockRef"
    class="event-block"
    :style="blockStyle"
    @mouseenter="onMouseEnter"
    @mouseleave="showTooltip = false"
  >
    <Teleport to="body">
      <div
        v-if="showTooltip"
        class="timeline-tooltip"
        :style="tooltipStyle"
        ref="tooltipRef"
      >
        <div class="tooltip-title">{{ event.title || 'Untitled' }}</div>
        <div class="tooltip-row">{{ formatDate(event.start) }} → {{ formatDate(event.end) }}</div>
        <div class="tooltip-row">{{ formatDuration(event.durationMinutes) }}</div>
        <div v-if="mappedTaskName" class="tooltip-row mapped">Task: {{ mappedTaskName }}</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { formatDate, formatDuration } from '../utils'

const props = defineProps({
  event: { type: Object, required: true },
  left: { type: Number, required: true },
  width: { type: Number, required: true },
  color: { type: Object, required: true },
})

const showTooltip = ref(false)
const blockRef = ref(null)
const tooltipRef = ref(null)
const tooltipPos = ref({ left: 0, top: 0 })

const mappedTaskName = computed(() =>
  props.event?.assignedTrackTask?.task?.name ?? null
)

const blockStyle = computed(() => ({
  left: `${props.left * 100}%`,
  width: `${props.width * 100}%`,
  backgroundColor: props.color?.bg ?? '#dbeafe',
  borderColor: props.color?.border ?? '#93c5fd',
}))

const tooltipStyle = computed(() => ({
  left: `${tooltipPos.value.left}px`,
  top: `${tooltipPos.value.top}px`,
}))

function onMouseEnter() {
  showTooltip.value = true
  nextTick(() => {
    const rect = blockRef.value?.getBoundingClientRect()
    if (rect && typeof window !== 'undefined') {
      const centerX = rect.left + rect.width / 2
      const top = rect.bottom + 8
      tooltipPos.value = {
        left: centerX,
        top: Math.min(top, window.innerHeight - 130),
      }
    }
  })
}
</script>

<style scoped>
.event-block {
  position: absolute;
  top: 4px;
  bottom: 4px;
  min-width: 4px;
  border-radius: 4px;
  border: 1px solid;
  cursor: default;
}
.event-block:hover { filter: brightness(0.95); }

.timeline-tooltip {
  position: fixed;
  z-index: 100;
  transform: translateX(-50%);
  min-width: 160px;
  max-width: 280px;
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
.tooltip-row.mapped { color: #374151; margin-top: 0.2rem; }
</style>
