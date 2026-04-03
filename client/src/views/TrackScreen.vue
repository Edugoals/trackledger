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
            <button type="button" class="btn-share" :disabled="shareBusy" @click="createCustomerShareLink">
              {{ shareBusy ? 'Bezig…' : 'Link voor klant' }}
            </button>
            <p v-if="shareMessage" class="share-msg">{{ shareMessage }}</p>
          </div>
        </div>
      </header>
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
        <TrackInsightsPanel :aggregation="aggregation" />
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

const availableTasks = computed(() => {
  const used = new Set(trackTasks.value.map(tt => tt.taskId))
  return tasks.value.filter(t => !used.has(t.id))
})

const usedTaskIds = computed(() => trackTasks.value.map(tt => tt.taskId))

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
})

watch(track, (t) => {
  if (t?.customer) projectName.value = t.customer.name
  if (t) {
    loadTrackTasks()
    loadTrackEvents()
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
.share-actions { max-width: 22rem; text-align: right; }
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
  grid-template-columns: 240px 1fr 220px;
  gap: 1.5rem;
  align-items: start;
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
