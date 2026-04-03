<template>
  <div class="agreement-view">
    <nav class="nav-back">
      <router-link :to="{ name: 'track', params: { projectId, trackId } }" class="back-link">
        ← Terug naar track
      </router-link>
    </nav>

    <div v-if="loading" class="state muted">Laden…</div>
    <div v-else-if="error" class="state error">{{ error }}</div>
    <AgreementPreview v-else-if="data" :agreement="data" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import AgreementPreview from '../components/AgreementPreview.vue'

const route = useRoute()
const projectId = computed(() => route.params.projectId)
const trackId = computed(() => route.params.trackId)

const loading = ref(true)
const error = ref(null)
const data = ref(null)

async function load() {
  const tid = trackId.value
  if (!tid) return
  loading.value = true
  error.value = null
  data.value = null
  try {
    const r = await api(`/api/tracks/${tid}/agreement-preview`)
    const body = await r.json().catch(() => ({}))
    if (!r.ok) {
      error.value = body.error || 'Kon overeenkomst niet laden.'
      return
    }
    data.value = body
  } catch (e) {
    error.value = e.message || 'Netwerkfout'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(trackId, load)
</script>

<style scoped>
.agreement-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 1rem 1rem 2rem;
}
.nav-back {
  margin-bottom: 1rem;
}
.back-link {
  font-size: 0.9rem;
  color: #6b7280;
  text-decoration: none;
}
.back-link:hover {
  color: #374151;
  text-decoration: underline;
}
.state {
  padding: 2rem;
  text-align: center;
}
.muted {
  color: #6b7280;
}
.error {
  color: #b91c1c;
}
</style>
