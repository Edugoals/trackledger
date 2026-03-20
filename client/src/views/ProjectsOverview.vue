<template>
  <div class="view projects-overview">
    <h2>Projects</h2>
    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="!projects.length" class="empty">No projects yet. Add one via Customers.</div>
    <div v-else class="grid">
      <ProjectCard
        v-for="p in projects"
        :key="p.id"
        :project="p"
        @click="goToProject(p)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import ProjectCard from '../components/ProjectCard.vue'

const router = useRouter()
const projects = ref([])
const loading = ref(true)
const error = ref(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const r = await api('/api/jobs')
    if (r.ok) projects.value = await r.json()
    else error.value = 'Failed to load projects'
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

function goToProject(p) {
  router.push({ name: 'project', params: { projectId: p.id } })
}

onMounted(load)
</script>

<style scoped>
.projects-overview h2 { margin: 0 0 1rem; font-size: 1.5rem; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
.loading, .error, .empty { padding: 2rem; color: #6b7280; }
.error { color: #dc2626; }
</style>
