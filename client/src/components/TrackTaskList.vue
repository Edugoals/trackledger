<template>
  <section class="track-task-list">
    <div class="header">
      <h4>Track Plan</h4>
      <button type="button" class="btn-add" @click="$emit('add-task')">+ Add Task</button>
    </div>
    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="!trackTasks.length" class="empty">
      No tasks yet. Add from the library or create a custom one.
    </div>
    <div v-else class="list">
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
import TrackTaskCard from './TrackTaskCard.vue'

defineProps({
  trackTasks: { type: Array, default: () => [] },
  events: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

defineEmits(['add-task', 'update', 'edit-notes', 'remove', 'unassign'])
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
.loading, .empty { font-size: 0.9rem; color: #6b7280; padding: 1rem 0; }
.list { display: flex; flex-direction: column; }
</style>
