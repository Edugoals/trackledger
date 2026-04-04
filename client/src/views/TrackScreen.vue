<template>
  <div class="view track-screen">
    <div v-if="loading && !track" class="loading">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <template v-else-if="track">
      <header class="header">
        <router-link :to="{ name: 'project', params: { projectId: projectId } }" class="back">← Project</router-link>
        <div class="header-main">
          <div>
            <h2>{{ track.name }}</h2>
            <p class="project-name">{{ projectName }}</p>
          </div>
          <div class="share-actions">
            <router-link
              :to="{ name: 'trackAgreement', params: { projectId: projectId, trackId: trackId } }"
              class="btn-agreement"
            >
              Preview overeenkomst
            </router-link>
            <button
              type="button"
              class="btn-agreement-solid"
              :disabled="agreementBusy"
              @click="createAgreementVersion"
            >
              {{ agreementBusy ? 'Bezig…' : 'Versie vastleggen' }}
            </button>
            <button type="button" class="btn-share" :disabled="shareBusy" @click="createCustomerShareLink">
              {{ shareBusy ? 'Bezig…' : 'Link voor klant' }}
            </button>
            <p v-if="shareMessage" class="share-msg">{{ shareMessage }}</p>
          </div>
        </div>
      </header>

      <section v-if="track" class="agreements-section">
        <h3 class="agreements-title">Overeenkomsten</h3>
        <p class="agreements-hint">
          Preview is live; vastgelegde versies wijzigen niet. PDF en mail gebruiken alleen een snapshot.
        </p>
        <table v-if="agreements.length" class="agreements-table">
          <thead>
            <tr>
              <th>Versie</th>
              <th>Status</th>
              <th>Aangemaakt</th>
              <th>Verzonden</th>
              <th class="agreements-actions">Acties</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in agreements" :key="a.id">
              <td>{{ a.version }}</td>
              <td>{{ agreementStatusLabel(a.status) }}</td>
              <td>{{ formatDateTime(a.createdAt) }}</td>
              <td>{{ a.sentAt ? formatDateTime(a.sentAt) : '—' }}</td>
              <td class="agreements-actions">
                <router-link
                  :to="{
                    name: 'trackAgreementSnapshot',
                    params: { projectId: projectId, trackId: trackId, agreementId: a.id },
                  }"
                  class="agreements-link"
                >
                  Bekijk
                </router-link>
                <button
                  type="button"
                  class="agreements-btn"
                  :disabled="agreementActionId === a.id"
                  @click="downloadAgreementPdf(a)"
                >
                  PDF
                </button>
                <button
                  type="button"
                  class="agreements-btn"
                  :disabled="agreementActionId === a.id"
                  @click="sendAgreementToClient(a)"
                >
                  Mail
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="agreements-empty">Nog geen vastgelegde versies. Gebruik “Versie vastleggen”.</p>
      </section>

      <div class="columns">
        <TaskLibrary
          :tasks="tasks"
          :loading="tasksLoading"
          :show-custom-task="true"
          :used-task-ids="usedTaskIds"
          @add="addTask"
          @create-custom="showCustomTaskForm = true"
        />
        <TrackTaskList
          :track-tasks="trackTasks"
          :events="trackEvents"
          :loading="trackTasksLoading"
          :syncing="syncing"
          :can-sync="!!(track?.customer?.selectedCalendarId)"
          @sync="syncGoogle"
          @add-task="showAddTask = true"
          @update="updateTrackTask"
          @edit-notes="openNotesEdit"
          @remove="removeTrackTask"
          @unassign="(ev) => assignEvent({ eventId: ev.id, assignedTrackTaskId: null })"
          @reorder="onTrackTasksReorder"
          @insert-from-library="onInsertFromLibrary"
        />
        <div class="side-stack">
          <TrackPricingPanel :track="track" @saved="onPricingSaved" />
          <TrackInsightsPanel :aggregation="aggregation" />
        </div>
      </div>
      <MappedEventsSection
        v-if="track"
        :events="trackEvents"
        :suggested-assignments="suggestedAssignments"
        :track-tasks="trackTasks"
        @assign="assignEvent"
        @refresh="loadTrackEvents"
      />
    </template>

    <div v-if="showNotesModal" class="modal">
      <form @submit.prevent="saveNotes" class="form">
        <h3>Notes</h3>
        <textarea v-model="notesForm.notes" rows="4" placeholder="Optional notes"></textarea>
        <div class="form-actions">
          <button type="submit" class="btn">Save</button>
          <button type="button" class="btn btn-outline" @click="showNotesModal = false">Cancel</button>
        </div>
      </form>
    </div>

    <div v-if="showAddTask || showCustomTaskForm" class="modal">
      <form @submit.prevent="submitAddTask" class="form">
        <h3>{{ showCustomTaskForm ? 'Custom task' : 'Add task' }}</h3>
        <template v-if="showCustomTaskForm">
          <label>Task name <input v-model="customTaskName" required placeholder="e.g. Extra review" /></label>
          <label>Est. hours <input v-model="customTaskHours" type="number" step="0.5" min="0" placeholder="optional" /></label>
        </template>
        <template v-else>
          <p v-if="!availableTasks.length" class="form-hint">All tasks added. Create a custom one below.</p>
          <template v-else>
            <label>Task
              <select v-model="addTaskForm.taskId" required>
                <option value="">— Select —</option>
                <option v-for="t in availableTasks" :key="t.id" :value="t.id">
                  {{ t.name }}{{ t.defaultEstimatedHours != null ? ` (${t.defaultEstimatedHours}h)` : '' }}
                </option>
              </select>
            </label>
            <label>Est. hours <input v-model="addTaskForm.estimatedHours" type="number" step="0.5" min="0" placeholder="optional" /></label>
          </template>
          <button type="button" class="btn btn-outline btn-small" @click="showCustomTaskForm = true; showAddTask = false">Or create custom task</button>
        </template>
        <div class="form-actions">
          <button type="submit" class="btn">Add</button>
          <button type="button" class="btn btn-outline" @click="closeAddTask">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import TaskLibrary from '../components/TaskLibrary.vue'
import TrackTaskList from '../components/TrackTaskList.vue'
import TrackInsightsPanel from '../components/TrackInsightsPanel.vue'
import TrackPricingPanel from '../components/TrackPricingPanel.vue'
import MappedEventsSection from '../components/MappedEventsSection.vue'
import { headerContext } from '../stores/headerContext'

const route = useRoute()
const projectId = computed(() => route.params.projectId)
const trackId = computed(() => route.params.trackId)

const track = ref(null)
const projectName = ref('')
const trackTasks = ref([])
const trackEvents = ref([])
const suggestedAssignments = ref({})
const syncing = ref(false)
const aggregation = ref({ totalEstimatedHours: 0, totalActualHours: 0, hoursDifference: 0, overrunPercentage: null, unassignedEventHours: 0 })
const tasks = ref([])
const loading = ref(true)
const trackTasksLoading = ref(false)
const tasksLoading = ref(false)
const error = ref(null)

const showNotesModal = ref(false)
const showAddTask = ref(false)
const showCustomTaskForm = ref(false)
const notesForm = ref({ trackTask: null, notes: '' })
const addTaskForm = ref({ taskId: '', estimatedHours: '' })
const customTaskName = ref('')
const customTaskHours = ref('')
const shareBusy = ref(false)
const shareMessage = ref('')

const agreements = ref([])
const agreementBusy = ref(false)
const agreementActionId = ref(null)

const availableTasks = computed(() => {
  const used = new Set(trackTasks.value.map(tt => tt.taskId))
  return tasks.value.filter(t => !used.has(t.id))
})

const usedTaskIds = computed(() => trackTasks.value.map(tt => tt.taskId))

function onPricingSaved(updated) {
  if (!track.value || !updated) return
  track.value = {
    ...track.value,
    ...updated,
    customer: track.value.customer,
  }
}

function agreementStatusLabel(s) {
  if (s === 'finalized') return 'Vastgelegd'
  if (s === 'sent') return 'Verzonden'
  return s
}

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

async function loadAgreements() {
  if (!trackId.value) return
  try {
    const r = await api(`/api/tracks/${trackId.value}/agreements`)
    if (r.ok) {
      const d = await r.json()
      agreements.value = d.agreements || []
    }
  } catch (e) {
    console.error(e)
  }
}

async function createAgreementVersion() {
  if (!trackId.value) return
  agreementBusy.value = true
  try {
    const r = await api(`/api/tracks/${trackId.value}/agreements`, { method: 'POST' })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) {
      alert(body.error || 'Versie vastleggen mislukt.')
      return
    }
    await loadAgreements()
  } catch (e) {
    alert(e.message || 'Mislukt')
  } finally {
    agreementBusy.value = false
  }
}

async function downloadAgreementPdf(a) {
  agreementActionId.value = a.id
  try {
    const r = await api(`/api/agreements/${a.id}/pdf`)
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      alert(err.error || 'PDF download mislukt.')
      return
    }
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `projectovereenkomst-v${a.version}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  } finally {
    agreementActionId.value = null
  }
}

async function sendAgreementToClient(a) {
  if (!confirm('Mail met PDF naar de klant van deze snapshot versturen?')) return
  agreementActionId.value = a.id
  try {
    const r = await api(`/api/agreements/${a.id}/send`, { method: 'POST' })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) {
      alert(body.error || 'Verzenden mislukt.')
      return
    }
    await loadAgreements()
  } finally {
    agreementActionId.value = null
  }
}

async function createCustomerShareLink() {
  if (!trackId.value) return
  shareMessage.value = ''
  shareBusy.value = true
  try {
    const r = await api(`/api/tracks/${trackId.value}/share`, { method: 'POST' })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      shareMessage.value = data.error || 'Kon geen link maken.'
      return
    }
    const url = data.shareUrl
    try {
      await navigator.clipboard.writeText(url)
      shareMessage.value = 'Link gekopieerd naar klembord. Stuur deze naar je klant.'
    } catch {
      shareMessage.value = url
    }
  } catch (e) {
    shareMessage.value = e.message || 'Mislukt.'
  } finally {
    shareBusy.value = false
  }
}

async function loadTrack() {
  if (!trackId.value || !projectId.value) return
  loading.value = true
  error.value = null
  try {
    const r = await api(`/api/jobs/${projectId.value}`)
    if (!r.ok) { error.value = 'Failed to load'; return }
    const job = await r.json()
    projectName.value = job.customer?.name || job.name || ''
    headerContext.selectedCustomerId = job.customer?.id ?? null
    const tid = parseInt(trackId.value)
    const t = job.tracks?.find(tr => tr.id === tid)
    track.value = t ? { ...t, customer: job.customer } : null
    if (!track.value) error.value = 'Track not found'
    else await loadAgreements()
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

async function loadTrackTasks() {
  if (!trackId.value) return
  trackTasksLoading.value = true
  try {
    const r = await api(`/api/tracks/${trackId.value}/tasks`)
    if (r.ok) {
      const data = await r.json()
      trackTasks.value = data.trackTasks || []
      aggregation.value = { ...aggregation.value, ...data.aggregation }
    }
  } catch (e) {
    console.error(e)
  }
  trackTasksLoading.value = false
}

async function loadTrackEvents() {
  if (!trackId.value) return
  try {
    const r = await api(`/api/tracks/${trackId.value}/events`)
    if (r.ok) {
      const data = await r.json()
      trackEvents.value = data.events || []
      suggestedAssignments.value = data.suggestedAssignments || {}
    }
  } catch (e) {
    console.error(e)
  }
}

async function syncGoogle() {
  const customerId = track.value?.customerId ?? track.value?.customer?.id
  if (!customerId) return
  syncing.value = true
  try {
    await api('/api/events/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId }),
    })
    await loadTrackEvents()
    await loadTrackTasks()
  } catch (e) {
    console.error(e)
  }
  syncing.value = false
}

async function assignEvent({ eventId, assignedTrackTaskId }) {
  const body = assignedTrackTaskId != null ? { assignedTrackTaskId } : { assignedTrackTaskId: null }
  const r = await api(`/api/events/${eventId}/assignment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (r.ok) {
    await loadTrackEvents()
    await loadTrackTasks()
  }
}

async function loadTasks() {
  tasksLoading.value = true
  try {
    const r = await api('/api/tasks?activeOnly=1')
    if (r.ok) tasks.value = await r.json()
  } catch (e) {
    console.error(e)
  }
  tasksLoading.value = false
}

async function addTask(task) {
  addTaskForm.value = {
    taskId: String(task.id),
    titleOverride: '',
    estimatedHours: task.defaultEstimatedHours != null ? String(task.defaultEstimatedHours) : '',
  }
  showAddTask.value = true
}

async function submitAddTask() {
  if (showCustomTaskForm.value) {
    const body = { name: customTaskName.value }
    if (customTaskHours.value) body.defaultEstimatedHours = parseFloat(customTaskHours.value)
    const cr = await api('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!cr.ok) return
    const newTask = await cr.json()
    tasks.value.push(newTask)
    await addTaskToTrack(newTask.id, customTaskHours.value ? parseFloat(customTaskHours.value) : null)
  } else {
    const taskId = parseInt(addTaskForm.value.taskId)
    if (!taskId) return
    const est = addTaskForm.value.estimatedHours ? parseFloat(addTaskForm.value.estimatedHours) : null
    await addTaskToTrack(taskId, est)
  }
  closeAddTask()
}

async function addTaskToTrack(taskId, estimatedHours = null) {
  const body = { taskId }
  if (estimatedHours != null) body.estimatedHours = estimatedHours
  const r = await api(`/api/tracks/${trackId.value}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (r.ok) await loadTrackTasks()
}

function closeAddTask() {
  showAddTask.value = false
  showCustomTaskForm.value = false
  addTaskForm.value = { taskId: '', estimatedHours: '' }
  customTaskName.value = ''
  customTaskHours.value = ''
}

async function updateTrackTask(tt, patch) {
  const r = await api(`/api/track-tasks/${tt.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (r.ok) await loadTrackTasks()
}

function openNotesEdit(tt) {
  notesForm.value = { trackTask: tt, notes: tt.notes || '' }
  showNotesModal.value = true
}

async function saveNotes() {
  const { trackTask, notes } = notesForm.value
  if (!trackTask) return
  const r = await api(`/api/track-tasks/${trackTask.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  })
  if (r.ok) {
    trackTask.notes = notes
    showNotesModal.value = false
    await loadTrackTasks()
  }
}

async function removeTrackTask(tt) {
  if (!confirm('Remove this task from the track?')) return
  const r = await api(`/api/track-tasks/${tt.id}`, { method: 'DELETE' })
  if (r.ok) await loadTrackTasks()
}

async function onTrackTasksReorder(newList) {
  const ids = newList.map(tt => tt.id)
  if (!ids.length || !trackId.value) return
  trackTasks.value = newList
  const r = await api(`/api/tracks/${trackId.value}/tasks/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackTaskIds: ids }),
  })
  if (!r.ok) await loadTrackTasks()
}

async function onInsertFromLibrary({ taskId, defaultEstimatedHours, insertIndex }) {
  if (!taskId || !trackId.value) return
  const body = { taskId, insertIndex }
  if (defaultEstimatedHours != null && !isNaN(defaultEstimatedHours)) body.estimatedHours = defaultEstimatedHours
  const r = await api(`/api/tracks/${trackId.value}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (r.ok) {
    await loadTrackTasks()
  } else {
    const err = await r.json().catch(() => ({}))
    console.error('Could not add task:', err?.error || r.status)
  }
}

onMounted(() => {
  loadTasks()
  loadTrack()
})

watch(trackId, () => {
  loadTrack()
  loadTrackTasks()
  loadTrackEvents()
  loadAgreements()
})

watch(track, (t) => {
  if (t?.customer) projectName.value = t.customer.name
  if (t) {
    loadTrackTasks()
    loadTrackEvents()
    loadAgreements()
  }
})
</script>

<style scoped>
.track-screen .header { margin-bottom: 1.5rem; }
.header-main {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.share-actions { max-width: 22rem; text-align: right; display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; align-items: center; }
.btn-agreement {
  padding: 0.4rem 0.75rem;
  font-size: 0.9rem;
  background: #fff;
  color: #213547;
  border: 1px solid #213547;
  border-radius: 6px;
  text-decoration: none;
  white-space: nowrap;
}
.btn-agreement:hover {
  background: #f0f4f8;
}
.btn-agreement-solid {
  padding: 0.4rem 0.75rem;
  font-size: 0.9rem;
  background: #213547;
  color: #fff;
  border: 1px solid #213547;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}
.btn-agreement-solid:hover:not(:disabled) {
  background: #1a2a3a;
}
.btn-agreement-solid:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.agreements-section {
  margin-bottom: 1.5rem;
  padding: 1rem 0;
  border-bottom: 1px solid #e5e7eb;
}
.agreements-title {
  margin: 0 0 0.35rem;
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
}
.agreements-hint {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: #6b7280;
}
.agreements-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.agreements-table th,
.agreements-table td {
  border: 1px solid #e5e7eb;
  padding: 0.45rem 0.5rem;
  text-align: left;
}
.agreements-table th {
  background: #f9fafb;
  font-weight: 600;
  color: #4b5563;
}
.agreements-actions {
  white-space: nowrap;
}
.agreements-link {
  color: #213547;
  margin-right: 0.5rem;
  font-size: 0.85rem;
}
.agreements-btn {
  margin-right: 0.35rem;
  padding: 0.2rem 0.45rem;
  font-size: 0.8rem;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  cursor: pointer;
}
.agreements-btn:hover:not(:disabled) {
  background: #f9fafb;
}
.agreements-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}
.agreements-empty {
  margin: 0;
  font-size: 0.9rem;
  color: #6b7280;
}
.btn-share {
  padding: 0.4rem 0.75rem;
  font-size: 0.9rem;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
}
.btn-share:hover:not(:disabled) { background: #e5e7eb; }
.btn-share:disabled { opacity: 0.6; cursor: not-allowed; }
.share-msg { margin: 0.5rem 0 0; font-size: 0.8rem; color: #059669; word-break: break-all; }
.back { display: inline-block; margin-bottom: 0.5rem; font-size: 0.9rem; color: #6b7280; }
.back:hover { color: #374151; }
.track-screen h2 { margin: 0 0 0.25rem; }
.project-name { margin: 0; font-size: 0.95rem; color: #6b7280; }
.columns {
  display: grid;
  grid-template-columns: 240px 1fr minmax(220px, 260px);
  gap: 1.5rem;
  align-items: start;
}
.side-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
@media (max-width: 900px) {
  .columns { grid-template-columns: 1fr; }
}
.loading, .error { padding: 2rem; color: #6b7280; }
.error { color: #dc2626; }
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.form {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
}
.form h3 { margin: 0 0 1rem; }
.form label { display: block; margin-bottom: 1rem; }
.form label input, .form textarea {
  width: 100%;
  padding: 0.5rem;
  margin-top: 0.25rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
.form-actions { margin-top: 1rem; display: flex; gap: 0.5rem; }
.btn { padding: 0.5rem 1rem; background: #213547; color: white; border: none; border-radius: 6px; cursor: pointer; }
.btn-outline { background: transparent; color: #213547; border: 1px solid #213547; }
.btn-small { font-size: 0.9rem; padding: 0.35rem 0.75rem; }
.form-hint { font-size: 0.85rem; color: #6b7280; margin-bottom: 0.5rem; }
</style>
