<template>
  <div class="view tasks-view">
    <h2>Task Library</h2>
    <p class="hint">Reusable task templates. Use them when planning tracks.</p>
    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <ul v-else class="task-list">
      <li v-for="t in tasks" :key="t.id" class="task-item">
        <span class="name">{{ t.name }}</span>
        <span v-if="t.defaultEstimatedHours != null" class="hours">{{ formatHours(t.defaultEstimatedHours) }}h default</span>
        <span v-else class="hours">—</span>
      </li>
    </ul>
    <p v-if="!loading && !tasks.length" class="empty">No tasks. They are created from seed data or when you add a custom task on a track.</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'
import { formatHours } from '../utils'

const tasks = ref([])
const loading = ref(true)
const error = ref(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const r = await api('/api/tasks')
    if (r.ok) tasks.value = await r.json()
    else error.value = 'Failed to load'
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

onMounted(load)
</script>

<style scoped>
.tasks-view h2 { margin: 0 0 0.5rem; }
.hint { font-size: 0.9rem; color: #6b7280; margin-bottom: 1rem; }
.task-list { list-style: none; padding: 0; margin: 0; }
.task-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid #eee;
  font-size: 0.95rem;
}
.task-item .name { font-weight: 500; }
.task-item .hours { color: #6b7280; font-size: 0.875rem; }
.loading, .error, .empty { padding: 1rem 0; color: #6b7280; }
.error { color: #dc2626; }
</style>
