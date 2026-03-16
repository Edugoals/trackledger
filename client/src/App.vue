<template>
  <div class="app">
    <h1>TrackLedger</h1>

    <template v-if="loading">Laden...</template>

    <template v-else-if="!user">
      <p>Log in met Google om je agenda te synchroniseren.</p>
      <a :href="loginUrl" class="btn">Inloggen met Google</a>
    </template>

    <!-- Ingelogd: hoofdscherm -->
    <template v-else-if="user">
      <header class="header">
        <span>Hallo, {{ user.name || user.email }}</span>
        <div class="header-actions">
          <button
            @click="sync"
            :disabled="syncing || !selectedCustomer?.selectedCalendarId"
            class="btn btn-small"
            title="Sync agenda van geselecteerde klant"
          >
            {{ syncing ? 'Sync...' : 'Sync van Google' }}
          </button>
          <button @click="logout" class="btn btn-small">Uitloggen</button>
        </div>
      </header>

      <!-- Klanten -->
      <section class="customers-section">
        <h2>Klanten</h2>
        <template v-if="!selectedCustomer">
          <button type="button" class="btn" @click="openCustomerForm()">+ Nieuwe klant</button>
          <ul class="list">
            <li v-for="c in customers" :key="c.id" class="list-item">
              <button type="button" class="btn btn-block" @click="selectCustomer(c)">
                {{ c.name }} <span v-if="c.email" class="meta">({{ c.email }})</span>
                <span class="badge">{{ c._count?.jobs ?? 0 }} opdrachten</span>
                <span v-if="c.selectedCalendarId" class="badge calendar-badge">📅</span>
              </button>
              <div class="item-actions">
                <button type="button" class="btn-small" @click.stop="selectCustomer(c)">Open</button>
                <button type="button" class="btn-small danger" @click.stop="deleteCustomer(c.id)">Verwijder</button>
              </div>
            </li>
          </ul>
          <p v-if="customers.length === 0">Geen klanten. Voeg er één toe.</p>
        </template>
        <template v-else>
          <button type="button" class="btn btn-small" @click="backFromCustomer">← Terug</button>
          <h3>{{ selectedCustomer.name }}</h3>

          <nav class="customer-tabs">
            <button type="button" :class="['tab', { active: customerTab === 'klantinfo' }]" @click="customerTab = 'klantinfo'">Klantinfo</button>
            <button type="button" :class="['tab', { active: customerTab === 'opdrachten' }]" @click="customerTab = 'opdrachten'">Opdrachten</button>
            <button type="button" :class="['tab', { active: customerTab === 'agenda' }]" @click="customerTab = 'agenda'">Agenda</button>
          </nav>

          <!-- Tab: Klantinfo -->
          <div v-show="customerTab === 'klantinfo'" class="tab-panel">
            <div class="info-section">
              <h4>Gegevens</h4>
              <form @submit.prevent="saveCustomerInline" class="inline-form">
                <label>Naam <input v-model="customerForm.name" required /></label>
                <label>E-mail <input v-model="customerForm.email" type="email" /></label>
                <label>Telefoon <input v-model="customerForm.phone" /></label>
                <button type="submit" class="btn btn-small" :disabled="savingCustomer">Opslaan</button>
                <button type="button" class="btn btn-small danger" @click="deleteCustomer(selectedCustomer.id)">Klant verwijderen</button>
              </form>
            </div>
            <div class="info-section">
              <h4>Gekoppelde agenda</h4>
              <p class="form-hint">Kies of maak een Google-agenda voor deze klant.</p>
              <div class="calendar-controls">
                <select
                  :value="selectedCustomer.selectedCalendarId || ''"
                  @change="onCustomerCalendarChange"
                  class="select"
                >
                  <option value="">— Geen agenda gekozen —</option>
                  <option v-for="cal in calendars" :key="cal.id" :value="cal.id">
                    {{ cal.summary }}{{ cal.primary ? ' (standaard)' : '' }}
                  </option>
                </select>
                <button type="button" class="btn btn-small" @click="openNewCalendarForm">+ Nieuwe agenda</button>
              </div>
            </div>
          </div>

          <!-- Tab: Opdrachten (twee kolommen) -->
          <div v-show="customerTab === 'opdrachten'" class="tab-panel two-cols">
            <div class="col">
              <h4>Opdrachten</h4>
              <button type="button" class="btn btn-small" @click="openJobForm()">+ Nieuwe opdracht</button>
              <ul class="list">
                <li v-for="j in jobs" :key="j.id" class="list-item" :class="{ active: selectedJob?.id === j.id }">
                  <button type="button" class="btn btn-block" @click="selectJob(j)">
                    {{ j.name }}
                    <span class="meta">{{ formatShortDate(j.startDate) }} – {{ formatShortDate(j.endDate) }}</span>
                    <span class="badge">{{ j._count?.tracks ?? 0 }} tracks</span>
                  </button>
                  <div class="item-actions">
                    <button type="button" class="btn-small" @click.stop="openJobForm(j)">Bewerk</button>
                    <button type="button" class="btn-small danger" @click.stop="deleteJob(j.id)">Verwijder</button>
                  </div>
                </li>
              </ul>
              <p v-if="jobs.length === 0">Geen opdrachten. Voeg er één toe.</p>
            </div>
            <div class="col">
              <h4>Tracks <span v-if="selectedJob" class="meta">– {{ selectedJob.name }}</span></h4>
              <template v-if="selectedJob">
                <button type="button" class="btn btn-small" @click="openTrackForm()">+ Nieuwe track</button>
                <ul class="list">
                  <li v-for="t in tracks" :key="t.id" class="list-item">
                    <span>{{ t.name }}</span>
                    <div class="item-actions">
                      <button type="button" class="btn-small" @click="openTrackForm(t)">Bewerk</button>
                      <button type="button" class="btn-small danger" @click="deleteTrack(t.id)">Verwijder</button>
                    </div>
                  </li>
                </ul>
                <p v-if="tracks.length === 0">Geen tracks. Voeg er één toe.</p>
              </template>
              <p v-else class="form-hint">Selecteer een opdracht links om de tracks te zien.</p>
            </div>
          </div>

          <!-- Tab: Agenda -->
          <div v-show="customerTab === 'agenda'" class="tab-panel">
            <div v-if="selectedCustomer.selectedCalendarId">
              <div class="calendar-controls">
                <button @click="sync" :disabled="syncing" class="btn btn-small">
                  {{ syncing ? 'Sync...' : 'Sync van Google' }}
                </button>
                <button type="button" class="btn btn-small" @click="showForm = true">+ Nieuw event</button>
              </div>
              <ul v-if="events.length" class="event-list">
                <li v-for="e in events" :key="e.id" class="event">
                  <div>
                    <strong>{{ e.title }}</strong>
                    <span class="meta">{{ formatDate(e.start) }} – {{ formatDate(e.end) }}</span>
                  </div>
                  <div class="actions">
                    <button @click="editEvent(e)" class="btn-small">Bewerk</button>
                    <button @click="deleteEvent(e.id)" class="btn-small danger">Verwijder</button>
                  </div>
                </li>
              </ul>
              <p v-else>Geen events. Klik op Sync van Google of maak een nieuw event.</p>
            </div>
            <p v-else class="form-hint">Koppel eerst een agenda in het tabblad Klantinfo.</p>
          </div>
        </template>
      </section>

      <div v-if="showForm" class="modal">
        <form @submit.prevent="saveEvent" class="form">
          <h3>{{ editing ? 'Event bewerken' : 'Nieuw event' }} – {{ selectedCustomer?.name }}</h3>
          <label>Titel <input v-model="form.title" required /></label>
          <label>Start <input v-model="form.start" type="datetime-local" required /></label>
          <label>Einde <input v-model="form.end" type="datetime-local" required /></label>
          <label>Omschrijving <input v-model="form.description" /></label>
          <div class="form-actions">
            <button type="submit" class="btn">Opslaan</button>
            <button type="button" @click="closeForm" class="btn">Annuleren</button>
          </div>
        </form>
      </div>

    </template>

    <!-- Modal: nieuwe agenda (geldt voor picker en hoofdscherm) -->
    <div v-if="user && showCalendarForm" class="modal">
      <form @submit.prevent="createCalendar" class="form">
        <h3>Nieuwe agenda</h3>
        <p class="form-hint">De agenda wordt aangemaakt in je Google-account.</p>
        <label>Naam <input v-model="newCalendarName" required placeholder="bv. Werk" /></label>
        <label>Omschrijving <input v-model="newCalendarDesc" placeholder="optioneel" /></label>
        <div class="form-actions">
          <button type="submit" class="btn" :disabled="creatingCalendar">{{ creatingCalendar ? 'Aanmaken...' : 'Aanmaken' }}</button>
          <button type="button" @click="closeCalendarForm" class="btn">Annuleren</button>
        </div>
      </form>
    </div>

    <!-- Modal: klant -->
    <div v-if="showCustomerForm" class="modal">
      <form @submit.prevent="saveCustomer" class="form">
        <h3>{{ editingCustomer ? 'Klant bewerken' : 'Nieuwe klant' }}</h3>
        <label>Naam <input v-model="customerForm.name" required /></label>
        <label>E-mail <input v-model="customerForm.email" type="email" /></label>
        <label>Telefoon <input v-model="customerForm.phone" /></label>
        <div class="form-actions">
          <button type="submit" class="btn" :disabled="savingCustomer">Opslaan</button>
          <button type="button" @click="closeCustomerForm" class="btn">Annuleren</button>
        </div>
      </form>
    </div>

    <!-- Modal: opdracht -->
    <div v-if="showJobForm" class="modal">
      <form @submit.prevent="saveJob" class="form">
        <h3>{{ editingJob ? 'Opdracht bewerken' : 'Nieuwe opdracht' }}</h3>
        <label>Naam <input v-model="jobForm.name" required placeholder="uniek" /></label>
        <label>Startdatum <input v-model="jobForm.startDate" type="date" required /></label>
        <label>Einddatum <input v-model="jobForm.endDate" type="date" required /></label>
        <div class="form-actions">
          <button type="submit" class="btn" :disabled="savingJob">Opslaan</button>
          <button type="button" @click="closeJobForm" class="btn">Annuleren</button>
        </div>
      </form>
    </div>

    <!-- Modal: track -->
    <div v-if="showTrackForm" class="modal">
      <form @submit.prevent="saveTrack" class="form">
        <h3>{{ editingTrack ? 'Track bewerken' : 'Nieuwe track' }}</h3>
        <label>Naam <input v-model="trackForm.name" required placeholder="uniek per klant" /></label>
        <div class="form-actions">
          <button type="submit" class="btn" :disabled="savingTrack">Opslaan</button>
          <button type="button" @click="closeTrackForm" class="btn">Annuleren</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const loading = ref(true)
const user = ref(null)
const calendars = ref([])
const calendarsLoading = ref(false)
const events = ref([])
const syncing = ref(false)
const showForm = ref(false)
const showCalendarForm = ref(false)
const creatingCalendar = ref(false)
const newCalendarName = ref('')
const newCalendarDesc = ref('')
const editing = ref(null)
const form = ref({ title: '', start: '', end: '', description: '' })
const customers = ref([])
const jobs = ref([])
const tracks = ref([])
const selectedCustomer = ref(null)
const customerTab = ref('klantinfo')
const selectedJob = ref(null)
const showCustomerForm = ref(false)
const showJobForm = ref(false)
const showTrackForm = ref(false)
const editingCustomer = ref(null)
const editingJob = ref(null)
const editingTrack = ref(null)
const savingCustomer = ref(false)
const savingJob = ref(false)
const savingTrack = ref(false)
const customerForm = ref({ name: '', email: '', phone: '' })
const jobForm = ref({ name: '', startDate: '', endDate: '' })
const trackForm = ref({ name: '' })

const loginUrl = '/api/auth/google'

const api = (path, opts = {}) =>
  fetch(path, { ...opts, credentials: 'include' })

function formatDate(d) {
  return new Date(d).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })
}
function formatShortDate(d) {
  return new Date(d).toLocaleDateString('nl-NL', { dateStyle: 'short' })
}
function toLocalInput(iso) {
  const d = new Date(iso)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

async function loadUser() {
  const r = await api('/api/auth/me')
  if (r.ok) user.value = await r.json()
}

async function loadCalendars() {
  calendarsLoading.value = true
  const r = await api('/api/calendars')
  if (r.ok) calendars.value = await r.json()
  calendarsLoading.value = false
}

async function loadEvents() {
  if (!selectedCustomer.value?.id) return
  const r = await api(`/api/events?customerId=${selectedCustomer.value.id}`)
  if (r.ok) events.value = await r.json()
}

async function onCustomerCalendarChange(e) {
  const calendarId = e.target.value || null
  if (!selectedCustomer.value) return
  await api(`/api/customers/${selectedCustomer.value.id}/calendar`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ calendarId: calendarId || null }),
  })
  selectedCustomer.value.selectedCalendarId = calendarId
  await loadEvents()
}

async function sync() {
  if (!selectedCustomer.value?.id) return
  syncing.value = true
  try {
    await api('/api/events/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: selectedCustomer.value.id }),
    })
    await loadEvents()
  } catch (e) {
    console.error(e)
  }
  syncing.value = false
}

function backFromCustomer() {
  selectedCustomer.value = null
  selectedJob.value = null
  events.value = []
}

async function logout() {
  await api('/api/auth/logout')
  user.value = null
  selectedCustomer.value = null
  selectedJob.value = null
  calendars.value = []
  customers.value = []
  events.value = []
}

function editEvent(e) {
  editing.value = e
  form.value = {
    title: e.title,
    start: toLocalInput(e.start),
    end: toLocalInput(e.end),
    description: e.description || ''
  }
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editing.value = null
  form.value = { title: '', start: '', end: '', description: '' }
}

async function saveEvent() {
  const body = { ...form.value }
  if (body.start) body.start = new Date(body.start).toISOString()
  if (body.end) body.end = new Date(body.end).toISOString()
  if (!selectedCustomer.value?.id) return
  body.customerId = selectedCustomer.value.id
  if (editing.value) {
    await api(`/api/events/${editing.value.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } else {
    await api('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  }
  closeForm()
  await loadEvents()
}

function openNewCalendarForm() {
  newCalendarName.value = ''
  newCalendarDesc.value = ''
  showCalendarForm.value = true
}

function closeCalendarForm() {
  showCalendarForm.value = false
  newCalendarName.value = ''
  newCalendarDesc.value = ''
}

async function createCalendar() {
  creatingCalendar.value = true
  try {
    const r = await api('/api/calendars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: newCalendarName.value, description: newCalendarDesc.value || undefined }),
    })
    if (r.ok && selectedCustomer.value) {
      const cal = await r.json()
      calendars.value.push(cal)
      closeCalendarForm()
      await api(`/api/customers/${selectedCustomer.value.id}/calendar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: cal.id }),
      })
      selectedCustomer.value.selectedCalendarId = cal.id
      await loadEvents()
    } else if (r.ok) {
      const cal = await r.json()
      calendars.value.push(cal)
      closeCalendarForm()
    }
  } catch (e) {
    console.error(e)
  }
  creatingCalendar.value = false
}

async function loadCustomers() {
  const r = await api('/api/customers')
  if (r.ok) customers.value = await r.json()
}
async function loadJobs() {
  if (!selectedCustomer.value) return
  const r = await api(`/api/jobs?customerId=${selectedCustomer.value.id}`)
  if (r.ok) jobs.value = await r.json()
}
async function loadTracks() {
  if (!selectedJob.value) return
  const r = await api(`/api/tracks?jobId=${selectedJob.value.id}`)
  if (r.ok) tracks.value = await r.json()
}
async function selectCustomer(c) {
  selectedCustomer.value = c
  selectedJob.value = null
  customerTab.value = 'klantinfo'
  customerForm.value = { name: c.name, email: c.email || '', phone: c.phone || '' }
  events.value = []
  await loadCalendars()
  await loadJobs()
  await loadEvents()
}

async function saveCustomerInline() {
  if (!selectedCustomer.value) return
  savingCustomer.value = true
  try {
    await api(`/api/customers/${selectedCustomer.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerForm.value),
    })
    selectedCustomer.value = { ...selectedCustomer.value, ...customerForm.value }
    const idx = customers.value.findIndex((x) => x.id === selectedCustomer.value.id)
    if (idx >= 0) customers.value[idx] = { ...customers.value[idx], ...customerForm.value }
  } catch (e) {
    console.error(e)
  }
  savingCustomer.value = false
}
function selectJob(j) {
  selectedJob.value = j
  loadTracks()
}
function openCustomerForm(c = null) {
  editingCustomer.value = c
  customerForm.value = c ? { name: c.name, email: c.email || '', phone: c.phone || '' } : { name: '', email: '', phone: '' }
  showCustomerForm.value = true
}
function closeCustomerForm() {
  showCustomerForm.value = false
  editingCustomer.value = null
}
async function saveCustomer() {
  savingCustomer.value = true
  try {
    if (editingCustomer.value) {
      await api(`/api/customers/${editingCustomer.value.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(customerForm.value) })
    } else {
      await api('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(customerForm.value) })
    }
    closeCustomerForm()
    await loadCustomers()
  } catch (e) { console.error(e) }
  savingCustomer.value = false
}
async function deleteCustomer(id) {
  if (!confirm('Klant en alle opdrachten/tracks verwijderen?')) return
  await api(`/api/customers/${id}`, { method: 'DELETE' })
  selectedCustomer.value = null
  await loadCustomers()
}
function openJobForm(j = null) {
  editingJob.value = j
  jobForm.value = j ? { name: j.name, startDate: j.startDate.slice(0, 10), endDate: j.endDate.slice(0, 10) } : { name: '', startDate: '', endDate: '' }
  showJobForm.value = true
}
function closeJobForm() {
  showJobForm.value = false
  editingJob.value = null
}
async function saveJob() {
  savingJob.value = true
  try {
    if (editingJob.value) {
      await api(`/api/jobs/${editingJob.value.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(jobForm.value) })
    } else {
      await api('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...jobForm.value, customerId: selectedCustomer.value.id }) })
    }
    closeJobForm()
    await loadJobs()
  } catch (e) { console.error(e) }
  savingJob.value = false
}
async function deleteJob(id) {
  if (!confirm('Opdracht en alle tracks verwijderen?')) return
  await api(`/api/jobs/${id}`, { method: 'DELETE' })
  selectedJob.value = null
  await loadJobs()
}
function openTrackForm(t = null) {
  editingTrack.value = t
  trackForm.value = t ? { name: t.name } : { name: '' }
  showTrackForm.value = true
}
function closeTrackForm() {
  showTrackForm.value = false
  editingTrack.value = null
}
async function saveTrack() {
  savingTrack.value = true
  try {
    if (editingTrack.value) {
      await api(`/api/tracks/${editingTrack.value.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(trackForm.value) })
    } else {
      await api('/api/tracks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...trackForm.value, jobId: selectedJob.value.id }) })
    }
    closeTrackForm()
    await loadTracks()
  } catch (e) { console.error(e) }
  savingTrack.value = false
}
async function deleteTrack(id) {
  if (!confirm('Track verwijderen?')) return
  await api(`/api/tracks/${id}`, { method: 'DELETE' })
  await loadTracks()
}
async function deleteEvent(id) {
  if (!confirm('Event verwijderen?')) return
  await api(`/api/events/${id}`, { method: 'DELETE' })
  await loadEvents()
}

onMounted(async () => {
  await loadUser()
  if (user.value) await loadCustomers()
  loading.value = false
})
</script>

<style>
.app { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; }
h1 { color: #213547; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 0.5rem; }
.header-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.select { padding: 0.35rem 0.6rem; border-radius: 6px; border: 1px solid #ccc; font-size: 0.9rem; }
.btn { padding: 0.5rem 1rem; background: #213547; color: white; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-block; }
.btn:hover { background: #3a4f63; }
.btn-block { width: 100%; text-align: left; }
.btn-small { font-size: 0.9rem; padding: 0.3rem 0.6rem; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn.danger { background: #c44; }
.btn-outline { background: transparent; color: #213547; border: 1px solid #213547; }
.btn-outline:hover { background: #eee; }
.btn-small.btn-outline { padding: 0.3rem 0.6rem; }
.form-hint { font-size: 0.9rem; color: #666; margin-bottom: 1rem; }
.badge { font-size: 0.75rem; opacity: 0.9; margin-left: 0.5rem; }
.calendars { margin-top: 1rem; }
.calendar-list { list-style: none; padding: 0; }
.calendar-item { margin-bottom: 0.5rem; }
.calendar-item .btn { display: flex; align-items: center; justify-content: space-between; }
.customers-section { margin-top: 1rem; }
.customer-tabs { display: flex; gap: 0.25rem; margin: 1.5rem 0 1rem; border-bottom: 1px solid #ddd; }
.customer-tabs .tab { padding: 0.5rem 1rem; border: none; background: transparent; cursor: pointer; border-radius: 4px 4px 0 0; }
.customer-tabs .tab.active { background: #213547; color: white; }
.customer-tabs .tab:hover:not(.active) { background: #eee; }
.tab-panel { padding: 1rem 0; }
.tab-panel.two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
@media (max-width: 600px) { .tab-panel.two-cols { grid-template-columns: 1fr; } }
.info-section { margin-bottom: 2rem; }
.info-section h4 { margin: 0 0 0.75rem; }
.inline-form { display: flex; flex-direction: column; gap: 1rem; max-width: 400px; }
.inline-form label { display: block; }
.inline-form label input { width: 100%; padding: 0.5rem; margin-top: 0.25rem; }
.list-item.active { background: #e8f0fe; }
.calendar-controls { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
.calendar-badge { margin-left: 0.25rem; }
.customers-section h3 { margin: 1rem 0 0.5rem; }
.list { list-style: none; padding: 0; }
.list-item { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #eee; gap: 0.5rem; }
.list-item .btn-block { flex: 1; text-align: left; }
.item-actions { display: flex; gap: 0.25rem; }
.event-list { list-style: none; padding: 0; }
.event { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-bottom: 1px solid #eee; }
.meta { display: block; font-size: 0.9rem; color: #666; }
.actions { display: flex; gap: 0.5rem; }
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; }
.form { background: white; padding: 2rem; border-radius: 8px; width: 100%; max-width: 400px; }
.form label { display: block; margin-bottom: 1rem; }
.form label input { width: 100%; padding: 0.5rem; margin-top: 0.25rem; }
.form-actions { margin-top: 1.5rem; display: flex; gap: 1rem; }
</style>
