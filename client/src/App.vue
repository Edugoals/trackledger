<template>
  <div class="app">
    <h1>TrackLedger</h1>

    <template v-if="loading">Laden...</template>

    <template v-else-if="!user">
      <p>Log in met Google om je agenda te synchroniseren.</p>
      <a :href="loginUrl" class="btn">Inloggen met Google</a>
    </template>

    <!-- Geen agenda gekozen: toon keuzelijst -->
    <template v-else-if="user && !selectedCalendarId && calendars.length">
      <header class="header">
        <span>Hallo, {{ user.name || user.email }}</span>
        <button @click="logout" class="btn btn-small">Uitloggen</button>
      </header>
      <section class="calendars">
        <h2>Kies een agenda</h2>
        <p>Selecteer de agenda die je wilt synchroniseren, of maak een nieuwe aan.</p>
        <button type="button" class="btn btn-outline" @click="showCalendarForm = true">+ Nieuwe agenda</button>
        <ul class="calendar-list">
          <li
            v-for="cal in calendars"
            :key="cal.id"
            class="calendar-item"
            :class="{ primary: cal.primary }"
          >
            <button type="button" class="btn btn-block" @click="selectCalendar(cal.id)">
              {{ cal.summary }}
              <span v-if="cal.primary" class="badge">Standaard</span>
            </button>
          </li>
        </ul>
      </section>
    </template>

    <!-- Agenda laden… -->
    <template v-else-if="user && !selectedCalendarId && calendarsLoading">
      <p>Agenda's laden...</p>
    </template>

    <!-- Agenda gekozen: events + sync -->
    <template v-else-if="user && selectedCalendarId">
      <header class="header">
        <span>Hallo, {{ user.name || user.email }}</span>
        <div class="header-actions">
          <select v-model="selectedCalendarId" @change="onCalendarChange" class="select">
            <option v-for="cal in calendars" :key="cal.id" :value="cal.id">
              {{ cal.summary }}{{ cal.primary ? ' (standaard)' : '' }}
            </option>
          </select>
          <button type="button" class="btn btn-small" @click="openNewCalendarForm" title="Nieuwe agenda aanmaken">+ Nieuwe agenda</button>
          <button @click="sync" :disabled="syncing" class="btn btn-small">
            {{ syncing ? 'Sync...' : 'Sync van Google' }}
          </button>
          <button @click="logout" class="btn btn-small">Uitloggen</button>
        </div>
      </header>

      <section class="events">
        <h2>Agenda</h2>
        <button @click="showForm = true" class="btn">+ Nieuw event</button>

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
      </section>

      <div v-if="showForm" class="modal">
        <form @submit.prevent="saveEvent" class="form">
          <h3>{{ editing ? 'Event bewerken' : 'Nieuw event' }}</h3>
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const loading = ref(true)
const user = ref(null)
const calendars = ref([])
const calendarsLoading = ref(false)
const selectedCalendarId = ref(null)
const events = ref([])
const syncing = ref(false)
const showForm = ref(false)
const showCalendarForm = ref(false)
const creatingCalendar = ref(false)
const newCalendarName = ref('')
const newCalendarDesc = ref('')
const editing = ref(null)
const form = ref({ title: '', start: '', end: '', description: '' })

const loginUrl = '/api/auth/google'

const api = (path, opts = {}) =>
  fetch(path, { ...opts, credentials: 'include' })

function formatDate(d) {
  return new Date(d).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })
}
function toLocalInput(iso) {
  const d = new Date(iso)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

async function loadUser() {
  const r = await api('/api/auth/me')
  if (r.ok) {
    user.value = await r.json()
    selectedCalendarId.value = user.value?.selectedCalendarId ?? null
  }
}

async function loadCalendars() {
  calendarsLoading.value = true
  const r = await api('/api/calendars')
  if (r.ok) calendars.value = await r.json()
  calendarsLoading.value = false
}

async function loadEvents() {
  const r = await api('/api/events')
  if (r.ok) events.value = await r.json()
}

async function selectCalendar(calendarId) {
  await api('/api/calendars/selected', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ calendarId }),
  })
  selectedCalendarId.value = calendarId
  if (user.value) user.value.selectedCalendarId = calendarId
  await loadEvents()
}

async function onCalendarChange() {
  await api('/api/calendars/selected', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ calendarId: selectedCalendarId.value }),
  })
  if (user.value) user.value.selectedCalendarId = selectedCalendarId.value
  await loadEvents()
}

async function sync() {
  syncing.value = true
  try {
    await api('/api/events/sync', { method: 'POST' })
    await loadEvents()
  } catch (e) {
    console.error(e)
  }
  syncing.value = false
}

async function logout() {
  await api('/api/auth/logout')
  user.value = null
  selectedCalendarId.value = null
  calendars.value = []
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
    if (r.ok) {
      const cal = await r.json()
      calendars.value.push(cal)
      closeCalendarForm()
      selectedCalendarId.value = cal.id
      if (user.value) user.value.selectedCalendarId = cal.id
      await api('/api/calendars/selected', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: cal.id }),
      })
      await loadEvents()
    }
  } catch (e) {
    console.error(e)
  }
  creatingCalendar.value = false
}

async function deleteEvent(id) {
  if (!confirm('Event verwijderen?')) return
  await api(`/api/events/${id}`, { method: 'DELETE' })
  await loadEvents()
}

onMounted(async () => {
  await loadUser()
  if (user.value) {
    await loadCalendars()
    if (selectedCalendarId.value) await loadEvents()
  }
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
