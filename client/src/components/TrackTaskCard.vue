<template>
  <article class="track-task-card" :class="statusClass">
    <div class="card-header">
      <span class="task-title">{{ displayName }}</span>
      <span :class="['diff-badge', diffBadgeClass]">{{ diffBadgeText }}</span>
    </div>
    <p v-if="trackTask.notes" class="notes">{{ trackTask.notes }}</p>
    <div class="deadline-section">
      <template v-if="trackTask.deadlineAt">
        <span :class="['deadline-badge', deadlineStatusClass]" :title="deadlineStatusLabel">📅 {{ formatDeadline(trackTask.deadlineAt) }}</span>
        <button type="button" class="btn-deadline" @click="showDeadlinePicker = true">Edit</button>
        <button type="button" class="btn-deadline" @click="$emit('update', { deadlineAt: null })">Remove</button>
        <span v-if="trackTask.deadlineSyncStatus === 'ERROR'" class="sync-error" :title="trackTask.deadlineSyncError">⚠</span>
      </template>
      <template v-else>
        <button type="button" class="btn-add-deadline" @click="showDeadlinePicker = !showDeadlinePicker">
          {{ showDeadlinePicker ? 'Cancel' : 'Add deadline' }}
        </button>
      </template>
      <div v-if="showDeadlinePicker" class="deadline-picker">
        <input
          type="date"
          :value="deadlineInputValue"
          @change="onDeadlineChange"
          class="deadline-input"
        />
        <button type="button" class="btn-small" @click="saveDeadline">Save</button>
      </div>
    </div>
    <div v-if="mappedEventCount > 0" class="mapped-events-inline">
      <button type="button" class="btn-expand" @click="expanded = !expanded">
        {{ mappedEventCount }} event{{ mappedEventCount !== 1 ? 's' : '' }} from calendar
      </button>
      <div v-if="expanded" class="event-list">
        <div v-for="ev in mappedEvents" :key="ev.id" class="event-item">
          <span class="ev-title">{{ ev.title }}</span>
          <span class="ev-meta">{{ formatDate(ev.start) }} · {{ formatDuration(ev.durationMinutes) }}</span>
          <span :class="['ev-source', ev.assignmentSource?.toLowerCase()]">{{ ev.assignmentSource }}</span>
          <button type="button" class="btn-unassign" @click="$emit('unassign', ev)">Unassign</button>
        </div>
      </div>
    </div>
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
          :value="displayActualHours"
          @change="onActChange"
          class="inline-input"
          :readonly="hasEventDerivedActuals"
          :title="hasEventDerivedActuals ? 'From calendar events (sync in Customers)' : 'Manual'"
        />h
        <span v-if="hasEventDerivedActuals" class="from-calendar" title="From calendar">📅</span>
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
import { ref, computed, watch } from 'vue'
import { formatHours, formatDate, formatShortDate, overrunStatus } from '../utils'

const props = defineProps({
  trackTask: { type: Object, required: true },
  mappedEvents: { type: Array, default: () => [] },
})

const emit = defineEmits(['update', 'edit-notes', 'remove', 'unassign'])

const expanded = ref(false)
const showDeadlinePicker = ref(false)
const deadlineInputValue = ref('')

const deadlineStatusClass = computed(() => {
  const d = props.trackTask.deadlineAt
  if (!d) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadline = new Date(d)
  deadline.setHours(0, 0, 0, 0)
  if (deadline.getTime() < today.getTime()) return 'overdue'
  if (deadline.getTime() === today.getTime()) return 'today'
  return 'future'
})

const deadlineStatusLabel = computed(() => {
  if (deadlineStatusClass.value === 'overdue') return 'Overdue'
  if (deadlineStatusClass.value === 'today') return 'Due today'
  return 'Upcoming'
})

function formatDeadline(d) {
  return formatShortDate(d) || ''
}

function onDeadlineChange(e) {
  deadlineInputValue.value = e.target.value
}

function saveDeadline() {
  const v = deadlineInputValue.value
  if (v) emit('update', { deadlineAt: v })
  showDeadlinePicker.value = false
}

watch(showDeadlinePicker, (visible) => {
  if (visible && props.trackTask.deadlineAt) {
    const d = new Date(props.trackTask.deadlineAt)
    deadlineInputValue.value = d.toISOString().slice(0, 10)
  } else if (!visible) {
    deadlineInputValue.value = ''
  }
})

const mappedEventCount = computed(() => props.mappedEvents?.length ?? props.trackTask.mappedEventCount ?? 0)

const displayActualHours = computed(() => props.trackTask.actualHours ?? props.trackTask.actualHoursFromEvents ?? '')

const hasEventDerivedActuals = computed(() => (props.trackTask.actualHoursFromEvents ?? 0) > 0)

function formatDuration(mins) {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const displayName = computed(() =>
  props.trackTask.task?.name || 'Task'
)

const status = computed(() =>
  overrunStatus(props.trackTask.estimatedHours, props.trackTask.actualHours ?? props.trackTask.actualHoursFromEvents)
)

const statusClass = computed(() => `status-${status.value}`)

const diffBadgeClass = computed(() => {
  if (status.value === 'ok') return 'ok'
  if (status.value === 'warning') return 'warning'
  return 'overrun'
})

const diffBadgeText = computed(() => {
  const est = parseFloat(props.trackTask.estimatedHours)
  const act = parseFloat(props.trackTask.actualHours ?? props.trackTask.actualHoursFromEvents)
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
.mapped-events-inline { margin-top: 0.5rem; }
.btn-expand {
  font-size: 0.8rem;
  padding: 0.2rem 0;
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  text-decoration: underline;
}
.btn-expand:hover { color: #374151; }
.event-list { margin-top: 0.5rem; padding-left: 0.5rem; border-left: 2px solid #e5e7eb; }
.event-item { font-size: 0.8rem; margin-bottom: 0.25rem; }
.ev-title { font-weight: 500; }
.ev-meta { color: #6b7280; margin-left: 0.5rem; }
.ev-source {
  margin-left: 0.5rem;
  font-size: 0.7rem;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}
.ev-source.auto { background: #dbeafe; color: #1d4ed8; }
.ev-source.manual { background: #d1fae5; color: #065f46; }
.btn-unassign { font-size: 0.7rem; padding: 0.1rem 0.3rem; margin-left: 0.25rem; background: #fef3c7; border: none; border-radius: 3px; cursor: pointer; }
.btn-unassign:hover { background: #fde68a; }
.from-calendar { font-size: 0.75rem; margin-left: 0.25rem; }
.deadline-section { margin-top: 0.5rem; font-size: 0.85rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; }
.deadline-badge { padding: 0.2rem 0.5rem; border-radius: 4px; }
.deadline-badge.future { background: #e5e7eb; color: #374151; }
.deadline-badge.today { background: #fef3c7; color: #92400e; }
.deadline-badge.overdue { background: #fee2e2; color: #991b1b; }
.btn-deadline, .btn-add-deadline { font-size: 0.75rem; padding: 0.15rem 0.4rem; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; }
.btn-deadline:hover, .btn-add-deadline:hover { background: #e5e7eb; }
.deadline-picker { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.35rem; }
.deadline-input { padding: 0.25rem 0.4rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.85rem; }
.sync-error { color: #dc2626; font-size: 0.9rem; }
</style>
