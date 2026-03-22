<template>
  <aside class="task-library">
    <h4>Task Library</h4>
    <ul v-if="tasks.length" class="task-list">
      <li v-for="t in tasks" :key="t.id" class="task-item">
        <span class="task-name">{{ t.name }}</span>
      </li>
    </ul>
    <p v-else-if="!loading" class="empty">No tasks yet. Create one in <router-link to="/tasks">Task Library</router-link>.</p>
    <p v-else class="empty">Loading…</p>
    <button v-if="showCustomTask" type="button" class="btn-custom" @click="$emit('create-custom')">+ Custom task</button>
  </aside>
</template>

<script setup>
defineProps({
  tasks: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  showCustomTask: { type: Boolean, default: false },
})

defineEmits(['add', 'create-custom'])
</script>

<style scoped>
.task-library {
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  min-width: 220px;
}
.task-library h4 {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #374151;
}
.task-list { list-style: none; padding: 0; margin: 0; }
.task-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid #eee;
  font-size: 0.875rem;
}
.task-item:last-child { border-bottom: none; }
.task-name { flex: 1; }
.empty { font-size: 0.85rem; color: #6b7280; margin: 0.5rem 0 0; }
.btn-custom {
  margin-top: 0.75rem;
  padding: 0.35rem 0.6rem;
  font-size: 0.8rem;
  background: transparent;
  border: 1px dashed #9ca3af;
  border-radius: 4px;
  color: #6b7280;
  cursor: pointer;
}
.btn-custom:hover { border-color: #374151; color: #374151; }
</style>
