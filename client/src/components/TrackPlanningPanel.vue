<template>
  <aside class="planning-panel">
    <h4>Planning (dit track)</h4>
    <p class="hint">Optioneel: planperiode voor dit track (los van projectdata).</p>
    <form class="planning-form" @submit.prevent="save">
      <label>
        Start
        <input v-model="form.startDate" type="date" />
      </label>
      <label>
        Streefdatum einde
        <input v-model="form.targetEndDate" type="date" />
      </label>
      <p v-if="message" :class="messageOk ? 'msg ok' : 'msg err'">{{ message }}</p>
      <button type="submit" class="btn-save" :disabled="saving">{{ saving ? 'Opslaan…' : 'Opslaan' }}</button>
    </form>
  </aside>
</template>

<script setup>
import { ref, watch } from 'vue'
import { api } from '../api'

const props = defineProps({
  track: { type: Object, default: null },
})

const emit = defineEmits(['saved'])

const form = ref({ startDate: '', targetEndDate: '' })
const saving = ref(false)
const message = ref('')
const messageOk = ref(true)

function isoToDateInput(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

function syncFromTrack(t) {
  if (!t) return
  form.value = {
    startDate: isoToDateInput(t.startDate),
    targetEndDate: isoToDateInput(t.targetEndDate),
  }
}

watch(
  () => props.track,
  (t) => {
    message.value = ''
    syncFromTrack(t)
  },
  { immediate: true, deep: true }
)

async function save() {
  if (!props.track?.id) return
  message.value = ''
  saving.value = true
  try {
    const body = {
      startDate: form.value.startDate?.trim() || null,
      targetEndDate: form.value.targetEndDate?.trim() || null,
    }
    const r = await api(`/api/tracks/${props.track.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      message.value = data.error || 'Opslaan mislukt.'
      messageOk.value = false
      return
    }
    message.value = 'Opgeslagen.'
    messageOk.value = true
    emit('saved', data)
  } catch (e) {
    message.value = e.message || 'Netwerkfout'
    messageOk.value = false
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.planning-panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
}
.planning-panel h4 {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
  font-weight: 600;
}
.hint {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  color: #6b7280;
}
.planning-form label {
  display: block;
  margin-bottom: 0.65rem;
  font-size: 0.85rem;
  color: #374151;
}
.planning-form input[type='date'] {
  display: block;
  margin-top: 0.25rem;
  width: 100%;
  padding: 0.4rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
.btn-save {
  margin-top: 0.5rem;
  padding: 0.45rem 0.85rem;
  font-size: 0.85rem;
  background: #213547;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.msg {
  font-size: 0.85rem;
  margin: 0.5rem 0 0;
}
.msg.ok {
  color: #059669;
}
.msg.err {
  color: #dc2626;
}
</style>
