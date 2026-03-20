<template>
  <aside class="insights-panel">
    <h4>Track summary</h4>
    <div class="stat-row">
      <span>Estimated</span>
      <strong>{{ formatHours(aggregation.totalEstimatedHours) }}h</strong>
    </div>
    <div class="stat-row">
      <span>Actual</span>
      <strong>{{ formatHours(aggregation.totalActualHours) }}h</strong>
    </div>
    <div class="stat-row">
      <span>Difference</span>
      <strong :class="diffClass">{{ diffText }}</strong>
    </div>
    <div v-if="aggregation.overrunPercentage != null" class="stat-row">
      <span>Overrun</span>
      <span :class="['status-indicator', statusClass]">{{ overrunPct }}%</span>
    </div>
    <div :class="['status-bar', statusClass]" :title="statusLabel"></div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { formatHours, overrunStatus } from '../utils'

const props = defineProps({
  aggregation: {
    type: Object,
    default: () => ({ totalEstimatedHours: 0, totalActualHours: 0, hoursDifference: 0, overrunPercentage: null }),
  },
})

const status = computed(() =>
  overrunStatus(props.aggregation.totalEstimatedHours, props.aggregation.totalActualHours)
)

const statusClass = computed(() => {
  if (status.value === 'ok') return 'ok'
  if (status.value === 'warning') return 'warning'
  return 'overrun'
})

const diffText = computed(() => {
  const d = props.aggregation.hoursDifference
  if (d == null) return '—'
  const n = parseFloat(d)
  if (isNaN(n)) return '—'
  return n >= 0 ? `+${n.toFixed(1)}h` : `${n.toFixed(1)}h`
})

const diffClass = computed(() => {
  const d = props.aggregation.hoursDifference
  if (d == null || parseFloat(d) <= 0) return ''
  return statusClass.value
})

const overrunPct = computed(() => {
  const p = props.aggregation.overrunPercentage
  return p != null ? p.toFixed(1) : '—'
})

const statusLabel = computed(() => {
  if (status.value === 'ok') return 'On track'
  if (status.value === 'warning') return 'Slightly over'
  return 'Significantly over'
})
</script>

<style scoped>
.insights-panel {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  min-width: 200px;
}
.insights-panel h4 {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #374151;
}
.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}
.stat-row span { color: #6b7280; }
.status-indicator.ok { color: #059669; }
.status-indicator.warning { color: #d97706; }
.status-indicator.overrun { color: #dc2626; }
.stat-row strong.ok { color: #059669; }
.stat-row strong.warning { color: #d97706; }
.stat-row strong.overrun { color: #dc2626; }
.status-bar {
  margin-top: 1rem;
  height: 6px;
  border-radius: 3px;
}
.status-bar.ok { background: #10b981; }
.status-bar.warning { background: #f59e0b; }
.status-bar.overrun { background: #ef4444; }
</style>
