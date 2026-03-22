<template>
  <section class="track-task-list">
    <div class="header">
      <h4>Track Plan</h4>
      <div class="header-actions">
        <button
          type="button"
          class="btn-sync"
          :disabled="syncing || !canSync"
          @click="$emit('sync')"
          title="Sync Google-agenda van deze klant"
        >
          {{ syncing ? 'Sync...' : 'Sync Google' }}
        </button>
        <button type="button" class="btn-add" @click="$emit('add-task')">+ Add Task</button>
      </div>
    </div>
    <TrackTimeline
      v-if="!loading"
      :events="events"
      :track-tasks="trackTasks"
    />
    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="!trackTasks.length" class="empty">
      No tasks yet. Add from the library or create a custom one.
    </div>
    <div v-else ref="listRef" class="list">
      <TrackTaskCard
        v-for="tt in trackTasks"
        :key="tt.id"
        :track-task="tt"
        :mapped-events="(events || []).filter(e => e.assignedTrackTaskId === tt.id)"
        @update="(patch) => $emit('update', tt, patch)"
        @edit-notes="$emit('edit-notes', tt)"
        @remove="$emit('remove', tt)"
        @unassign="$emit('unassign', $event)"
      />
    </div>
  </section>
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue'
import Sortable from 'sortablejs'
import TrackTaskCard from './TrackTaskCard.vue'
import TrackTimeline from './TrackTimeline.vue'

const props = defineProps({
  trackTasks: { type: Array, default: () => [] },
  events: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  syncing: { type: Boolean, default: false },
  canSync: { type: Boolean, default: false },
})

const emit = defineEmits(['add-task', 'update', 'edit-notes', 'remove', 'unassign', 'sync', 'reorder'])

const listRef = ref(null)
let sortable = null

watch(
  () => [props.loading, props.trackTasks.length],
  () => {
    if (props.trackTasks.length === 0) {
      sortable?.destroy()
      sortable = null
      return
    }
    if (props.loading) return
    nextTick(() => {
      if (listRef.value && !sortable) {
        sortable = Sortable.create(listRef.value, {
          handle: '.drag-handle',
          animation: 150,
          ghostClass: 'sortable-ghost',
          chosenClass: 'sortable-chosen',
          onEnd(evt) {
            const items = [...props.trackTasks]
            const [moved] = items.splice(evt.oldIndex, 1)
            items.splice(evt.newIndex, 0, moved)
            emit('reorder', items)
          },
        })
      }
    })
  },
  { immediate: true }
)

onUnmounted(() => {
  sortable?.destroy()
})
</script>

<style scoped>
.track-task-list {
  flex: 1;
  min-width: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.header h4 { margin: 0; font-size: 0.95rem; font-weight: 600; }
.btn-add {
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  background: #213547;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-add:hover { background: #3a4f63; }
.header-actions { display: flex; gap: 0.5rem; align-items: center; }
.btn-sync {
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  background: transparent;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
}
.btn-sync:hover:not(:disabled) { background: #f3f4f6; border-color: #9ca3af; }
.btn-sync:disabled { opacity: 0.5; cursor: not-allowed; }
.loading, .empty { font-size: 0.9rem; color: #6b7280; padding: 1rem 0; }
.list { display: flex; flex-direction: column; }
.list :deep(.sortable-ghost) { opacity: 0.5; background: #f3f4f6; }
.list :deep(.sortable-chosen) { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
</style>
