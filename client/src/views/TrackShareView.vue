<template>
  <div class="share-view">
    <div v-if="loading" class="muted">Laden…</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <template v-else-if="data">
      <header class="share-header">
        <p class="badge">Alleen-lezen · gedeeld plan</p>
        <h1>{{ data.trackName }}</h1>
        <p class="meta">
          <span>{{ data.jobName }}</span>
          <span class="sep">·</span>
          <span>{{ data.customerName }}</span>
        </p>
        <p class="period">{{ formatPeriod(data.period) }}</p>
      </header>

      <section class="section">
        <h2>Taken</h2>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Taak</th>
              <th>Status</th>
              <th>Est. uren</th>
              <th>Werkelijk</th>
              <th>Deadline</th>
              <th>Agenda-koppelingen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.items" :key="row.position">
              <td>{{ row.position }}</td>
              <td>{{ row.title }}</td>
              <td>{{ statusLabel(row.status) }}</td>
              <td>{{ row.estimatedHours != null ? row.estimatedHours : '—' }}</td>
              <td>{{ row.actualHours }}</td>
              <td>{{ row.deadlineAt ? formatDate(row.deadlineAt) : '—' }}</td>
              <td>{{ row.mappedCalendarEventCount }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="data.totalMappedCalendarEvents > 0" class="hint">
          Totaal gekoppelde agenda-items op dit track: {{ data.totalMappedCalendarEvents }}.
        </p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const loading = ref(true)
const error = ref(null)
const data = ref(null)

const STATUS_LABELS = {
  NOT_STARTED: 'Niet gestart',
  IN_PROGRESS: 'Bezig',
  DONE: 'Afgerond',
}

function statusLabel(s) {
  return STATUS_LABELS[s] || s
}

function formatPeriod(p) {
  if (!p?.start || !p?.end) return ''
  return `${formatDate(p.start)} – ${formatDate(p.end)}`
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

async function load() {
  const token = route.params.token
  if (!token) {
    error.value = 'Ongeldige link.'
    loading.value = false
    return
  }
  loading.value = true
  error.value = null
  data.value = null
  try {
    const r = await fetch(`/api/public/track-share/${encodeURIComponent(token)}`, {
      credentials: 'omit',
    })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) {
      error.value = body.error || 'Kon dit plan niet laden.'
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
watch(() => route.params.token, load)
</script>

<style scoped>
.share-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  font-family: system-ui, sans-serif;
}
.share-header h1 {
  margin: 0.25rem 0 0.5rem;
  font-size: 1.5rem;
  color: #111827;
}
.badge {
  display: inline-block;
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b7280;
}
.meta {
  margin: 0;
  color: #374151;
  font-size: 0.95rem;
}
.sep {
  margin: 0 0.35rem;
  color: #9ca3af;
}
.period {
  margin: 0.5rem 0 0;
  color: #6b7280;
  font-size: 0.9rem;
}
.section {
  margin-top: 2rem;
}
.section h2 {
  font-size: 1.1rem;
  margin: 0 0 0.75rem;
  color: #374151;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.table th,
.table td {
  padding: 0.5rem 0.6rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}
.table th {
  font-weight: 600;
  color: #4b5563;
  background: #f9fafb;
}
.muted {
  color: #6b7280;
}
.error {
  color: #b91c1c;
  padding: 1rem 0;
}
.hint {
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: #6b7280;
}
</style>
