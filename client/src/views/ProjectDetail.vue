<template>
  <div class="view project-detail">
    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <template v-else-if="project">
      <header class="header">
        <router-link to="/projects" class="back">← Projects</router-link>
        <h2>{{ project.name }}</h2>
        <p class="customer">{{ project.customer?.name || '—' }}</p>
      </header>
      <section class="tracks">
        <h3>Tracks</h3>
        <div v-if="!project.tracks?.length" class="empty">No tracks. Add one via Customers.</div>
        <div v-else class="track-list">
          <TrackRow
            v-for="t in project.tracks"
            :key="t.id"
            :track="t"
            @click="goToTrack(t)"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import { headerContext } from '../stores/headerContext'
import TrackRow from '../components/TrackRow.vue'

const route = useRoute()
const router = useRouter()
const project = ref(null)
const loading = ref(true)
const error = ref(null)

async function load() {
  const id = route.params.projectId
  if (!id) return
  loading.value = true
  error.value = null
  try {
    const r = await api(`/api/jobs/${id}`)
    if (r.ok) {
      project.value = await r.json()
      headerContext.selectedCustomerId = project.value.customer?.id ?? null
    } else error.value = 'Project not found'
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

function goToTrack(t) {
  router.push({ name: 'track', params: { projectId: route.params.projectId, trackId: t.id } })
}

onMounted(load)
watch(() => route.params.projectId, load)
</script>

<style scoped>
.project-detail .header { margin-bottom: 1.5rem; }
.back { display: inline-block; margin-bottom: 0.5rem; font-size: 0.9rem; color: #6b7280; }
.back:hover { color: #374151; }
.project-detail h2 { margin: 0 0 0.25rem; }
.customer { margin: 0; font-size: 0.95rem; color: #6b7280; }
.tracks h3 { margin: 0 0 0.75rem; font-size: 1rem; }
.track-list { display: flex; flex-direction: column; gap: 0.5rem; }
.loading, .error, .empty { padding: 2rem; color: #6b7280; }
.error { color: #dc2626; }
</style>
