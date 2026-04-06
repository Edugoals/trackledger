<template>
  <section class="track-task-list">
    <div class="header">
      <h4>Track Plan</h4>
      <div class="header-actions">
        <button
          type="button"
          class="btn-sync"
          :disabled="syncing || !canSyncGoogle"
          @click="$emit('sync')"
          title="Haalt wijzigingen uit Google naar TrackLedger (events & deadline-events)"
        >
          {{ syncing ? '…' : 'Sync van Google' }}
        </button>
        <button
          type="button"
          class="btn-push"
          :disabled="pushing || !canPushDeadlines"
          @click="$emit('push-deadlines')"
          title="Zet deadlines die alleen in TrackLedger staan naar je Google-agenda"
        >
          {{ pushing ? '…' : 'Deadlines → Google' }}
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
    <div
      v-else
      ref="listRef"
      class="list"
      @dragover.prevent="onDragOver"
      @drop="onListDrop"
    >
      <div
        v-if="!trackTasks.length"
        class="drop-placeholder"
        @dragover.prevent="onDragOver"
        @drop="onListDrop"
      >
        No tasks yet. Drop a task here.
      </div>
      <div
        v-for="(tt, i) in trackTasks"
        v-else
        :key="tt.id"
        class="card-wrapper"
        :data-index="i"
      >
        <TrackTaskCard
          :track-task="tt"
          :mapped-events="(events || []).filter(e => e.assignedTrackTaskId === tt.id)"
          :google-connected="googleConnected"
          :customer-has-calendar="customerHasCalendar"
          @update="(patch) => $emit('update', tt, patch)"
          @edit-notes="$emit('edit-notes', tt)"
          @remove="$emit('remove', tt)"
          @unassign="$emit('unassign', $event)"
        />
      </div>
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
  /** Google OAuth + agenda voor klant: sync van Google mogelijk */
  canSyncGoogle: { type: Boolean, default: false },
  pushing: { type: Boolean, default: false },
  canPushDeadlines: { type: Boolean, default: false },
  googleConnected: { type: Boolean, default: false },
  customerHasCalendar: { type: Boolean, default: false },
})

const emit = defineEmits(['add-task', 'update', 'edit-notes', 'remove', 'unassign', 'sync', 'push-deadlines', 'reorder', 'insert-from-library'])

const listRef = ref(null)
let sortable = null

function destroySortable() {
  sortable?.destroy()
  sortable = null
}

function onDragOver(ev) {
  if (ev.dataTransfer?.types?.includes('application/x-trackledger-task')) {
    ev.dataTransfer.dropEffect = 'copy'
  }
}

function getInsertIndex(ev) {
  if (!props.trackTasks.length) return 0
  let el = ev.target
  while (el && el !== listRef.value) {
    const i = el.getAttribute?.('data-index')
    if (i != null) {
      const rect = el.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      return ev.clientY < midY ? parseInt(i, 10) : parseInt(i, 10) + 1
    }
    el = el.parentElement
  }
  return props.trackTasks.length
}

function onListDrop(ev) {
  const raw = ev.dataTransfer?.getData?.('application/x-trackledger-task')
  if (!raw) return
  ev.preventDefault()
  try {
    const { taskId, defaultEstimatedHours } = JSON.parse(raw)
    if (!taskId) return
    const insertIndex = getInsertIndex(ev)
    emit('insert-from-library', {
      taskId: parseInt(taskId, 10),
      defaultEstimatedHours: defaultEstimatedHours != null && !isNaN(defaultEstimatedHours)
        ? defaultEstimatedHours
        : null,
      insertIndex,
    })
  } catch (_) {}
}

function initSortable() {
  if (!listRef.value || sortable) return
  sortable = Sortable.create(listRef.value, {
    handle: '.drag-handle',
    filter: '.drop-placeholder',
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

watch(
  () => [props.loading, props.trackTasks.length],
  () => {
    if (props.loading) {
      destroySortable()
      return
    }
    nextTick(() => {
      initSortable()
      if (!sortable && listRef.value) {
        setTimeout(initSortable, 50)
      }
    })
  },
  { immediate: true, flush: 'post' }
)

onUnmounted(destroySortable)
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
.btn-push {
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  background: #fff;
  color: #213547;
  border: 1px solid #213547;
  border-radius: 6px;
  cursor: pointer;
}
.btn-push:hover:not(:disabled) { background: #f0f4f8; }
.btn-push:disabled { opacity: 0.5; cursor: not-allowed; }
.loading { font-size: 0.9rem; color: #6b7280; padding: 1rem 0; }
.list { display: flex; flex-direction: column; min-height: 80px; }
.drop-placeholder {
  padding: 1.5rem;
  text-align: center;
  color: #9ca3af;
  font-size: 0.9rem;
  border: 2px dashed #e5e7eb;
  border-radius: 8px;
  background: #fafafa;
}
.list :deep(.sortable-ghost) { opacity: 0.5; background: #f3f4f6; }
.list :deep(.sortable-chosen) { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
</style>
