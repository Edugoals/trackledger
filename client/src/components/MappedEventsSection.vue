<template>
  <section class="mapped-events">
    <h4>Actual time from calendar</h4>
    <p v-if="!events.length" class="empty">
      No calendar events for this customer. Sync in <router-link to="/customers">Customers</router-link>.
    </p>
    <template v-else>
      <div v-if="unassignedEvents.length" class="unassigned-block">
        <h5>Unassigned events</h5>
        <ul class="event-list">
          <li v-for="ev in unassignedEvents" :key="ev.id" class="event-row">
            <span class="event-title">{{ ev.title }}</span>
            <span class="event-meta">{{ formatDate(ev.start) }} · {{ formatDuration(ev.durationMinutes) }}</span>
            <div class="event-actions">
              <select
                :value="ev.assignedTrackTaskId || ''"
                @change="onAssign(ev, $event)"
                class="assign-select"
              >
                <option value="">— Assign to —</option>
                <option v-for="tt in trackTasks" :key="tt.id" :value="tt.id">
                  {{ tt.task?.name || 'Task' }}
                </option>
              </select>
              <button
                v-if="suggestedAssignments[ev.id]"
                type="button"
                class="btn-suggest"
                @click="applySuggestion(ev)"
                :title="`Suggested: ${suggestedAssignments[ev.id]?.taskName}`"
              >
                Apply suggestion
              </button>
            </div>
          </li>
        </ul>
      </div>
      <div v-if="assignedEvents.length && !unassignedOnly" class="assigned-summary">
        <h5>Mapped to tasks</h5>
        <p class="hint">{{ assignedEvents.length }} event(s) mapped to track tasks.</p>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { formatDate } from '../utils'

const props = defineProps({
  events: { type: Array, default: () => [] },
  suggestedAssignments: { type: Object, default: () => ({}) },
  trackTasks: { type: Array, default: () => [] },
  unassignedOnly: { type: Boolean, default: false },
})

const emit = defineEmits(['assign', 'refresh'])

const unassignedEvents = computed(() =>
  props.events.filter((e) => !e.assignedTrackTaskId)
)

const assignedEvents = computed(() =>
  props.events.filter((e) => e.assignedTrackTaskId)
)

function formatDuration(mins) {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function onAssign(ev, e) {
  const val = e.target.value
  const trackTaskId = val ? parseInt(val) : null
  emit('assign', { eventId: ev.id, assignedTrackTaskId: trackTaskId })
}

function applySuggestion(ev) {
  const s = props.suggestedAssignments[ev.id]
  if (s?.trackTaskId) emit('assign', { eventId: ev.id, assignedTrackTaskId: s.trackTaskId })
}
</script>

<style scoped>
.mapped-events {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.mapped-events h4 { margin: 0 0 0.75rem; font-size: 0.9rem; }
.mapped-events h5 { margin: 0.5rem 0 0.25rem; font-size: 0.85rem; color: #6b7280; }
.empty { font-size: 0.9rem; color: #6b7280; margin: 0; }
.hint { font-size: 0.85rem; color: #6b7280; margin: 0.25rem 0 0; }
.event-list { list-style: none; padding: 0; margin: 0; }
.event-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
  font-size: 0.9rem;
}
.event-row:last-child { border-bottom: none; }
.event-title { flex: 1; min-width: 0; }
.event-meta { font-size: 0.8rem; color: #6b7280; white-space: nowrap; }
.event-actions { display: flex; align-items: center; gap: 0.5rem; }
.assign-select {
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.85rem;
}
.btn-suggest {
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
  background: #dbeafe;
  color: #1d4ed8;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.btn-suggest:hover { background: #bfdbfe; }
</style>
