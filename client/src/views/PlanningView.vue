<template>
  <div class="view planning-view">
    <header class="page-head">
      <h2>Planning</h2>
      <p class="sub">Studio-overzicht van projecten, tracks, deadlines en afspraken.</p>
    </header>

    <section class="filters">
      <label class="filter-item">
        Zoeken
        <input v-model="q" type="search" placeholder="Project of track…" @input="scheduleLoad" />
      </label>
      <label class="filter-item">
        Projectstatus
        <select v-model="status" @change="load">
          <option value="all">Alle</option>
          <option value="active">Actief (einddatum ≥ vandaag)</option>
          <option value="completed">Afgerond (einddatum verstreken)</option>
        </select>
      </label>
      <label class="filter-item">
        Sortering
        <select v-model="sort" @change="load">
          <option value="deadline">Eerstvolgende deadline</option>
          <option value="name">Projectnaam</option>
        </select>
      </label>
    </section>

    <div v-if="loading" class="muted">Laden…</div>
    <div v-else-if="error" class="err">{{ error }}</div>
    <template v-else>
      <section class="card upcoming">
        <h3>Upcoming</h3>
        <p class="window-note">Venster: komende {{ planning?.upcomingDays ?? 14 }} dagen · plus openstaande verlopen deadlines</p>

        <div v-if="!hasUpcoming" class="muted">Niets in dit venster (of geen resultaten na filter).</div>

        <div v-else class="upcoming-cols">
          <div v-if="planning.upcoming.overdueDeadlines?.length" class="up-col">
            <h4>Verlopen deadlines</h4>
            <ul class="up-list">
              <li v-for="(row, i) in planning.upcoming.overdueDeadlines" :key="'o' + i">
                <router-link
                  class="up-link"
                  :to="{ name: 'track', params: { projectId: row.projectId, trackId: row.trackId } }"
                >
                  <span class="up-title">{{ row.title }}</span>
                  <span class="up-meta">{{ row.projectName }} · {{ row.trackName }}</span>
                  <time class="up-time overdue">{{ formatWhen(row.at) }}</time>
                </router-link>
              </li>
            </ul>
          </div>
          <div v-if="planning.upcoming.upcomingDeadlines?.length" class="up-col">
            <h4>Deadlines (binnen venster)</h4>
            <ul class="up-list">
              <li v-for="(row, i) in planning.upcoming.upcomingDeadlines" :key="'d' + i">
                <router-link
                  class="up-link"
                  :to="{ name: 'track', params: { projectId: row.projectId, trackId: row.trackId } }"
                >
                  <span class="up-title">{{ row.title }}</span>
                  <span class="up-meta">{{ row.projectName }} · {{ row.trackName }}</span>
                  <time class="up-time">{{ formatWhen(row.at) }}</time>
                </router-link>
              </li>
            </ul>
          </div>
          <div v-if="planning.upcoming.upcomingAppointments?.length" class="up-col">
            <h4>Afspraken (binnen venster)</h4>
            <ul class="up-list">
              <li v-for="(row, i) in planning.upcoming.upcomingAppointments" :key="'a' + i">
                <router-link
                  class="up-link"
                  :to="{ name: 'track', params: { projectId: row.projectId, trackId: row.trackId } }"
                >
                  <span class="up-title">{{ row.title }}</span>
                  <span class="up-meta">{{ row.projectName }} · {{ row.trackName }}</span>
                  <time class="up-time">{{ formatWhen(row.at) }}</time>
                </router-link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section class="card projects">
        <h3>Alle projecten</h3>
        <p v-if="!planning.projects?.length" class="muted">Geen projecten (of geen resultaat na filter).</p>
        <div v-for="proj in planning.projects" :key="proj.id" class="project-block">
          <header class="project-head">
            <div>
              <h4>{{ proj.name }}</h4>
              <p class="proj-meta">
                <span v-if="proj.customerName">{{ proj.customerName }} · </span>
                {{ proj.trackCount }} track(s)
              </p>
            </div>
            <div class="proj-dates">
              <span v-if="proj.derivedStartDate || proj.derivedEndDate" class="pill">
                {{ formatDateOnly(proj.derivedStartDate) }} – {{ formatDateOnly(proj.derivedEndDate) }}
              </span>
              <span v-if="proj.nextDeadline" class="pill">Eerste deadline: {{ formatDateOnly(proj.nextDeadline) }}</span>
              <span v-if="proj.nextAppointment" class="pill">Eerste afspraak: {{ formatWhen(proj.nextAppointment) }}</span>
            </div>
            <router-link class="proj-link" :to="{ name: 'project', params: { projectId: proj.id } }">Project →</router-link>
          </header>

          <div v-for="tr in proj.tracks" :key="tr.id" class="track-block">
            <div class="track-head">
              <router-link
                class="track-name"
                :to="{ name: 'track', params: { projectId: proj.id, trackId: tr.id } }"
              >
                {{ tr.name }}
              </router-link>
              <span class="wf">{{ tr.workflow.label }}</span>
              <span class="prog">{{ tr.progress.label }}</span>
              <span v-if="tr.startDate || tr.targetEndDate" class="track-dates">
                {{ formatDateOnly(tr.startDate) }} – {{ formatDateOnly(tr.targetEndDate) }}
              </span>
              <span v-if="tr.nextDeadline" class="pill sm">Deadline: {{ formatDateOnly(tr.nextDeadline) }}</span>
              <span v-if="tr.appointmentCount" class="pill sm">{{ tr.appointmentCount }} afspraak/agenda</span>
            </div>

            <div v-if="tr.deadlines?.length" class="deadlines-row">
              <span
                v-for="d in tr.deadlines"
                :key="d.trackTaskId"
                class="dl-badge"
                :class="'dl-' + d.bucket"
              >
                {{ d.taskTitle }} · {{ formatDateOnly(d.deadlineAt) }}
              </span>
              <span v-if="tr.deadlinesHidden > 0" class="more">+{{ tr.deadlinesHidden }} meer</span>
            </div>
            <div v-if="tr.appointmentsPreview?.length" class="appt-row">
              <span v-for="a in tr.appointmentsPreview" :key="a.id" class="appt-pill">{{ a.title }} · {{ formatWhen(a.start) }}</span>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api'

const loading = ref(true)
const error = ref(null)
const planning = ref({
  upcomingDays: 14,
  upcoming: { overdueDeadlines: [], upcomingDeadlines: [], upcomingAppointments: [] },
  projects: [],
})
const q = ref('')
const status = ref('all')
const sort = ref('deadline')

let debounceTimer = null

const hasUpcoming = computed(() => {
  const u = planning.value?.upcoming
  if (!u) return false
  return (
    (u.overdueDeadlines?.length || 0) +
      (u.upcomingDeadlines?.length || 0) +
      (u.upcomingAppointments?.length || 0) >
    0
  )
})

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function formatDateOnly(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return '—'
  }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams()
    if (q.value.trim()) params.set('q', q.value.trim())
    if (status.value !== 'all') params.set('status', status.value)
    params.set('sort', sort.value)
    params.set('days', '14')
    const r = await api(`/api/planning?${params.toString()}`)
    const body = await r.json().catch(() => ({}))
    if (!r.ok) {
      error.value = body.error || 'Kon planning niet laden.'
      return
    }
    planning.value = body
  } catch (e) {
    error.value = e.message || 'Netwerkfout'
  } finally {
    loading.value = false
  }
}

function scheduleLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(load, 300)
}

onMounted(load)
watch([status, sort], load)
</script>

<style scoped>
.planning-view {
  max-width: 960px;
  margin: 0 auto;
}
.page-head h2 {
  margin: 0 0 0.25rem;
}
.sub {
  margin: 0 0 1rem;
  color: #6b7280;
  font-size: 0.95rem;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.25rem;
  align-items: flex-end;
}
.filter-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: #374151;
}
.filter-item input,
.filter-item select {
  padding: 0.4rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  min-width: 12rem;
}
.card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
}
.card h3 {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
}
.window-note {
  margin: 0 0 1rem;
  font-size: 0.8rem;
  color: #6b7280;
}
.upcoming-cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}
.up-col h4 {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: #4b5563;
}
.up-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.up-list li {
  margin-bottom: 0.5rem;
}
.up-link {
  display: block;
  text-decoration: none;
  color: inherit;
  padding: 0.45rem 0.5rem;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  font-size: 0.85rem;
}
.up-link:hover {
  background: #f9fafb;
}
.up-title {
  font-weight: 600;
  display: block;
  color: #111827;
}
.up-meta {
  font-size: 0.75rem;
  color: #6b7280;
}
.up-time {
  font-size: 0.75rem;
  color: #374151;
}
.up-time.overdue {
  color: #b91c1c;
  font-weight: 600;
}
.project-block {
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem 0;
}
.project-block:last-child {
  border-bottom: none;
}
.project-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.project-head h4 {
  margin: 0;
  font-size: 1rem;
}
.proj-meta {
  margin: 0.15rem 0 0;
  font-size: 0.85rem;
  color: #6b7280;
}
.proj-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.pill {
  font-size: 0.75rem;
  padding: 0.15rem 0.45rem;
  background: #f3f4f6;
  border-radius: 4px;
  color: #374151;
}
.pill.sm {
  font-size: 0.7rem;
}
.proj-link {
  font-size: 0.85rem;
  color: #213547;
}
.track-block {
  margin-left: 0.5rem;
  padding-left: 0.75rem;
  border-left: 2px solid #e5e7eb;
  margin-top: 0.75rem;
}
.track-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.88rem;
}
.track-name {
  font-weight: 600;
  color: #213547;
  text-decoration: none;
}
.track-name:hover {
  text-decoration: underline;
}
.wf {
  font-size: 0.75rem;
  color: #6b7280;
}
.prog {
  font-size: 0.75rem;
  color: #059669;
}
.track-dates {
  font-size: 0.75rem;
  color: #6b7280;
}
.deadlines-row,
.appt-row {
  margin-top: 0.4rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.dl-badge {
  font-size: 0.7rem;
  padding: 0.12rem 0.35rem;
  border-radius: 4px;
  background: #e5e7eb;
  color: #374151;
}
.dl-overdue {
  background: #fee2e2;
  color: #991b1b;
}
.dl-soon {
  background: #fef3c7;
  color: #92400e;
}
.dl-done {
  background: #d1fae5;
  color: #065f46;
}
.dl-upcoming {
  background: #e0e7ff;
  color: #3730a3;
}
.appt-pill {
  font-size: 0.68rem;
  padding: 0.1rem 0.3rem;
  background: #eff6ff;
  color: #1e40af;
  border-radius: 4px;
}
.more {
  font-size: 0.7rem;
  color: #6b7280;
}
.muted {
  color: #6b7280;
  font-size: 0.9rem;
}
.err {
  color: #b91c1c;
}
</style>
