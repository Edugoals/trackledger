<template>
  <div class="app">
    <h1>TrackLedger</h1>
    <p v-if="status">{{ status }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const status = ref('Laden...')

onMounted(async () => {
  try {
    const res = await fetch('/api/health')
    const data = await res.json()
    status.value = `Server: ${data.status} (${data.timestamp})`
  } catch (e) {
    status.value = 'Kon geen verbinding met server maken'
  }
})
</script>

<style>
.app {
  font-family: system-ui, sans-serif;
  max-width: 800px;
  margin: 2rem auto;
}
h1 { color: #213547; }
</style>
