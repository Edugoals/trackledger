<template>
  <div class="track-row" @click="$emit('click')">
    <span class="track-name">{{ track.name }}</span>
    <div class="stats">
      <span>{{ formatHours(track.totalEstimatedHours) }}h est</span>
      <span>{{ formatHours(track.totalActualHours) }}h act</span>
      <span v-if="hasOverrun" :class="['badge', statusClass]">{{ overrunText }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatHours, overrunStatus } from '../utils'

const props = defineProps({
  track: { type: Object, required: true },
})

defineEmits(['click'])

const status = computed(() =>
  overrunStatus(props.track.totalEstimatedHours, props.track.totalActualHours)
)

const statusClass = computed(() => {
  if (status.value === 'ok') return 'badge-ok'
  if (status.value === 'warning') return 'badge-warning'
  return 'badge-overrun'
})

const hasOverrun = computed(() => status.value !== 'ok' && status.value !== 'neutral')

const overrunText = computed(() => {
  const pct = props.track.overrunPercentage
  if (pct == null || pct <= 0) return ''
  return `+${pct.toFixed(0)}%`
})
</script>

<style scoped>
.track-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.track-row:hover {
  background: #f9fafb;
}
.track-name { font-weight: 500; }
.stats {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
}
.badge {
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
}
.badge-ok { background: #d1fae5; color: #065f46; }
.badge-warning { background: #fef3c7; color: #92400e; }
.badge-overrun { background: #fee2e2; color: #991b1b; }
</style>
