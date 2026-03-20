<template>
  <article class="track-task-card" :class="statusClass">
    <div class="card-header">
      <span class="task-title">{{ displayName }}</span>
      <span :class="['diff-badge', diffBadgeClass]">{{ diffBadgeText }}</span>
    </div>
    <p v-if="trackTask.notes" class="notes">{{ trackTask.notes }}</p>
    <div class="meta">
      <span class="est">
        Est: <input
          type="number"
          step="0.5"
          min="0"
          :value="trackTask.estimatedHours ?? ''"
          @change="onEstChange"
          class="inline-input"
        />h
      </span>
      <span class="act">
        Act: <input
          type="number"
          step="0.5"
          min="0"
          :value="trackTask.actualHours ?? ''"
          @change="onActChange"
          class="inline-input"
        />h
      </span>
      <select :value="trackTask.status" @change="onStatusChange" class="status-select">
        <option value="NOT_STARTED">Not started</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="DONE">Done</option>
      </select>
    </div>
    <div class="actions">
      <button type="button" class="btn-small" @click="$emit('edit-notes')">Notes</button>
      <button type="button" class="btn-small danger" @click="$emit('remove')">Remove</button>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { formatHours, overrunStatus } from '../utils'

const props = defineProps({
  trackTask: { type: Object, required: true },
})

const emit = defineEmits(['update', 'edit-notes', 'remove'])

const displayName = computed(() =>
  props.trackTask.titleOverride?.trim() || props.trackTask.task?.name || 'Task'
)

const status = computed(() =>
  overrunStatus(props.trackTask.estimatedHours, props.trackTask.actualHours)
)

const statusClass = computed(() => `status-${status.value}`)

const diffBadgeClass = computed(() => {
  if (status.value === 'ok') return 'ok'
  if (status.value === 'warning') return 'warning'
  return 'overrun'
})

const diffBadgeText = computed(() => {
  const est = parseFloat(props.trackTask.estimatedHours)
  const act = parseFloat(props.trackTask.actualHours)
  if (isNaN(est) || isNaN(act)) return ''
  const d = act - est
  if (d === 0) return ''
  return d > 0 ? `+${d.toFixed(1)}h` : `${d.toFixed(1)}h`
})

function onEstChange(e) {
  const v = e.target.value
  const n = v === '' ? null : parseFloat(v)
  if (n !== null && (isNaN(n) || n < 0)) return
  emit('update', { estimatedHours: n })
}

function onActChange(e) {
  const v = e.target.value
  const n = v === '' ? null : parseFloat(v)
  if (n !== null && (isNaN(n) || n < 0)) return
  emit('update', { actualHours: n })
}

function onStatusChange(e) {
  emit('update', { status: e.target.value })
}
</script>

<style scoped>
.track-task-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 0.75rem;
  background: white;
}
.track-task-card.status-overrun { border-left: 3px solid #ef4444; }
.track-task-card.status-warning { border-left: 3px solid #f59e0b; }
.track-task-card.status-ok { border-left: 3px solid #10b981; }
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}
.task-title { font-weight: 600; font-size: 0.95rem; }
.diff-badge {
  font-size: 0.75rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  flex-shrink: 0;
}
.diff-badge.ok { background: #d1fae5; color: #065f46; }
.diff-badge.warning { background: #fef3c7; color: #92400e; }
.diff-badge.overrun { background: #fee2e2; color: #991b1b; }
.notes { font-size: 0.85rem; color: #6b7280; margin: 0.5rem 0; }
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  margin-top: 0.5rem;
  font-size: 0.875rem;
}
.inline-input {
  width: 52px;
  padding: 0.2rem 0.4rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.85rem;
}
.status-select {
  padding: 0.2rem 0.4rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.85rem;
}
.actions { margin-top: 0.75rem; display: flex; gap: 0.5rem; }
.btn-small {
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  cursor: pointer;
}
.btn-small:hover { background: #e5e7eb; }
.btn-small.danger { background: #fee2e2; border-color: #fecaca; color: #991b1b; }
</style>
