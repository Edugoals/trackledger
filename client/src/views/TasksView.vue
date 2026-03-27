<template>
  <div class="view tasks-view">
    <div class="toolbar">
      <div>
        <h2>Task Library</h2>
        <p class="hint">Reusable task templates. Use them when planning tracks.</p>
      </div>
      <button type="button" class="btn-add" @click="openAdd">
        {{ showAddForm ? 'Sluiten' : 'Taak toevoegen' }}
      </button>
    </div>

    <p v-if="actionError" class="banner-error">{{ actionError }}</p>

    <div v-if="showAddForm" class="add-panel">
      <h3 class="add-title">Nieuwe taak-template</h3>
      <form class="add-form" @submit.prevent="submitCreate">
        <label>
          Naam <span class="req">*</span>
          <input v-model="form.name" type="text" required maxlength="200" placeholder="Bijv. Mixing" />
        </label>
        <label>
          Slug <span class="opt">(optioneel)</span>
          <input v-model="form.slug" type="text" maxlength="120" placeholder="mixing" />
        </label>
        <label>
          Beschrijving
          <textarea v-model="form.description" rows="2" maxlength="2000" placeholder="Korte uitleg" />
        </label>
        <label>
          Standaard uren
          <input v-model="form.defaultEstimatedHours" type="text" inputmode="decimal" placeholder="Leeg = geen default" />
        </label>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="form-actions">
          <button type="submit" class="btn-submit" :disabled="saving">{{ saving ? 'Opslaan…' : 'Opslaan' }}</button>
          <button type="button" class="btn-cancel" @click="cancelForm">Annuleren</button>
        </div>
      </form>
    </div>

    <div v-if="editTarget" class="add-panel edit-panel">
      <h3 class="add-title">Taak bewerken</h3>
      <form class="add-form" @submit.prevent="submitEdit">
        <label>
          Naam <span class="req">*</span>
          <input v-model="editForm.name" type="text" required maxlength="200" />
        </label>
        <label>
          Slug <span class="opt">(optioneel)</span>
          <input v-model="editForm.slug" type="text" maxlength="120" />
        </label>
        <label>
          Beschrijving
          <textarea v-model="editForm.description" rows="2" maxlength="2000" />
        </label>
        <label>
          Standaard uren
          <input v-model="editForm.defaultEstimatedHours" type="text" inputmode="decimal" placeholder="Leeg = geen default" />
        </label>
        <label class="row-check">
          <input v-model="editForm.isActive" type="checkbox" />
          Actief (zichtbaar bij plannen)
        </label>
        <p v-if="editError" class="form-error">{{ editError }}</p>
        <div class="form-actions">
          <button type="submit" class="btn-submit" :disabled="editSaving">{{ editSaving ? 'Opslaan…' : 'Opslaan' }}</button>
          <button type="button" class="btn-cancel" @click="closeEdit">Annuleren</button>
        </div>
      </form>
    </div>

    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <ul v-else class="task-list">
      <li
        v-for="t in tasks"
        :key="t.id"
        class="task-item"
        :class="{ 'task-item--inactive': !t.isActive }"
      >
        <div class="task-main">
          <span class="name">{{ t.name }}</span>
          <span v-if="!t.isActive" class="badge-inactive">Inactief</span>
          <span v-if="t.defaultEstimatedHours != null" class="hours">{{ formatHours(t.defaultEstimatedHours) }}h default</span>
          <span v-else class="hours">—</span>
        </div>
        <div class="task-actions">
          <button type="button" class="btn-link" @click="startEdit(t)">Bewerken</button>
          <button type="button" class="btn-link" @click="toggleActive(t)">
            {{ t.isActive ? 'Deactiveren' : 'Activeren' }}
          </button>
          <button type="button" class="btn-link btn-danger" @click="confirmDelete(t)">Verwijderen</button>
        </div>
      </li>
    </ul>
    <p v-if="!loading && !tasks.length" class="empty">Nog geen taken. Voeg er een toe of gebruik seed-data na eerste login.</p>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { api } from '../api'
import { formatHours } from '../utils'

const tasks = ref([])
const loading = ref(true)
const error = ref(null)
const actionError = ref(null)
const showAddForm = ref(false)
const saving = ref(false)
const formError = ref(null)
const form = reactive({
  name: '',
  slug: '',
  description: '',
  defaultEstimatedHours: '',
})

const editTarget = ref(null)
const editSaving = ref(false)
const editError = ref(null)
const editForm = reactive({
  name: '',
  slug: '',
  description: '',
  defaultEstimatedHours: '',
  isActive: true,
})

function resetForm() {
  form.name = ''
  form.slug = ''
  form.description = ''
  form.defaultEstimatedHours = ''
  formError.value = null
}

function openAdd() {
  showAddForm.value = !showAddForm.value
  if (showAddForm.value) {
    editTarget.value = null
    resetForm()
  }
}

function cancelForm() {
  showAddForm.value = false
  resetForm()
}

function startEdit(t) {
  actionError.value = null
  showAddForm.value = false
  editTarget.value = t.id
  editForm.name = t.name
  editForm.slug = t.slug ?? ''
  editForm.description = t.description ?? ''
  editForm.defaultEstimatedHours =
    t.defaultEstimatedHours != null ? String(t.defaultEstimatedHours) : ''
  editForm.isActive = !!t.isActive
  editError.value = null
}

function closeEdit() {
  editTarget.value = null
  editError.value = null
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const r = await api('/api/tasks')
    if (r.ok) tasks.value = await r.json()
    else error.value = 'Failed to load'
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

async function submitCreate() {
  formError.value = null
  saving.value = true
  try {
    const body = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || undefined,
    }
    const hrs = form.defaultEstimatedHours.trim()
    if (hrs !== '') {
      const n = parseFloat(hrs.replace(',', '.'))
      if (isNaN(n) || n < 0) {
        formError.value = 'Standaard uren moet een getal ≥ 0 zijn'
        return
      }
      body.defaultEstimatedHours = n
    }

    const r = await api('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      formError.value = data.error || 'Opslaan mislukt'
      return
    }
    tasks.value = [...tasks.value, data].sort(sortTasks)
    resetForm()
    showAddForm.value = false
  } catch (e) {
    formError.value = e.message || 'Netwerkfout'
  } finally {
    saving.value = false
  }
}

function sortTasks(a, b) {
  if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
  return a.name.localeCompare(b.name)
}

function replaceTask(updated) {
  const i = tasks.value.findIndex((x) => x.id === updated.id)
  if (i === -1) return
  const next = [...tasks.value]
  next[i] = updated
  next.sort(sortTasks)
  tasks.value = next
}

async function submitEdit() {
  if (!editTarget.value) return
  editError.value = null
  editSaving.value = true
  try {
    const body = {
      name: editForm.name.trim(),
      slug: editForm.slug.trim() || null,
      description: editForm.description.trim() || null,
      isActive: editForm.isActive,
    }
    const hrs = editForm.defaultEstimatedHours.trim()
    if (hrs !== '') {
      const n = parseFloat(hrs.replace(',', '.'))
      if (isNaN(n) || n < 0) {
        editError.value = 'Standaard uren moet een getal ≥ 0 zijn'
        return
      }
      body.defaultEstimatedHours = n
    } else {
      body.defaultEstimatedHours = null
    }

    const r = await api(`/api/tasks/${editTarget.value}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      editError.value = data.error || 'Opslaan mislukt'
      return
    }
    replaceTask(data)
    closeEdit()
  } catch (e) {
    editError.value = e.message || 'Netwerkfout'
  } finally {
    editSaving.value = false
  }
}

async function toggleActive(t) {
  actionError.value = null
  try {
    const r = await api(`/api/tasks/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !t.isActive }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      actionError.value = data.error || 'Bijwerken mislukt'
      return
    }
    replaceTask(data)
  } catch (e) {
    actionError.value = e.message || 'Netwerkfout'
  }
}

async function confirmDelete(t) {
  actionError.value = null
  if (!window.confirm(`Taak-template “${t.name}” permanent verwijderen?`)) return
  try {
    const r = await api(`/api/tasks/${t.id}`, { method: 'DELETE' })
    const data = await r.json().catch(() => ({}))
    if (r.status === 409) {
      actionError.value = data.error || 'Deze template kan niet worden verwijderd.'
      return
    }
    if (!r.ok) {
      actionError.value = data.error || 'Verwijderen mislukt'
      return
    }
    tasks.value = tasks.value.filter((x) => x.id !== t.id)
    if (editTarget.value === t.id) closeEdit()
  } catch (e) {
    actionError.value = e.message || 'Netwerkfout'
  }
}

onMounted(load)
</script>

<style scoped>
.tasks-view h2 { margin: 0 0 0.5rem; }
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}
.hint { font-size: 0.9rem; color: #6b7280; margin-bottom: 0; }
.banner-error {
  margin: 0 0 1rem;
  padding: 0.5rem 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #b91c1c;
  font-size: 0.9rem;
}
.btn-add {
  padding: 0.4rem 0.85rem;
  font-size: 0.9rem;
  background: #213547;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}
.btn-add:hover { background: #3a4f63; }
.add-panel {
  margin: 1rem 0 1.25rem;
  padding: 1rem 1.1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  max-width: 28rem;
}
.edit-panel { border-color: #d1d5db; }
.add-title { margin: 0 0 0.75rem; font-size: 1rem; font-weight: 600; color: #374151; }
.add-form { display: flex; flex-direction: column; gap: 0.75rem; }
.add-form label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.875rem;
  color: #374151;
}
.row-check {
  flex-direction: row !important;
  align-items: center;
  gap: 0.5rem !important;
}
.row-check input { width: auto; }
.req { color: #b91c1c; }
.opt { color: #9ca3af; font-weight: normal; }
.add-form input,
.add-form textarea {
  padding: 0.45rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.95rem;
  font-family: inherit;
}
.form-error { margin: 0; font-size: 0.875rem; color: #dc2626; }
.form-actions { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.25rem; }
.btn-submit {
  padding: 0.4rem 0.85rem;
  background: #213547;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-cancel {
  padding: 0.4rem 0.65rem;
  background: transparent;
  color: #6b7280;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-cancel:hover { color: #374151; }
.task-list { list-style: none; padding: 0; margin: 0; }
.task-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid #eee;
  font-size: 0.95rem;
}
.task-item--inactive {
  opacity: 0.72;
}
.task-item--inactive .name { color: #6b7280; }
.task-main {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  min-width: 0;
}
.task-item .name { font-weight: 500; }
.badge-inactive {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.15rem 0.4rem;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 4px;
}
.task-item .hours { color: #6b7280; font-size: 0.875rem; }
.task-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  align-items: center;
}
.btn-link {
  background: none;
  border: none;
  padding: 0.2rem 0;
  font-size: 0.85rem;
  color: #213547;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.btn-link:hover { color: #111827; }
.btn-danger { color: #b91c1c; }
.btn-danger:hover { color: #991b1b; }
.loading, .error, .empty { padding: 1rem 0; color: #6b7280; }
.error { color: #dc2626; }
</style>
