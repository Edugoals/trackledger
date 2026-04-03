<template>
  <aside class="pricing-panel">
    <h4>Prijsafspraak (dit track)</h4>
    <form class="pricing-form" @submit.prevent="save">
      <label>
        Afgesproken bedrag
        <input
          v-model="form.agreedPrice"
          type="text"
          inputmode="decimal"
          placeholder="Leeg = nog geen bedrag"
          autocomplete="off"
        />
      </label>
      <label>
        Valuta
        <input v-model="form.currency" type="text" maxlength="8" placeholder="EUR" />
      </label>
      <label class="row-check">
        <input v-model="form.isPriceFinal" type="checkbox" />
        Prijs is definitief afgesproken
      </label>
      <label>
        Notities
        <textarea v-model="form.pricingNotes" rows="3" placeholder="Bijv. incl. mix + mastering" />
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

const form = ref({
  agreedPrice: '',
  currency: 'EUR',
  pricingNotes: '',
  isPriceFinal: false,
})

const saving = ref(false)
const message = ref('')
const messageOk = ref(true)

function syncFromTrack(t) {
  if (!t) return
  form.value = {
    agreedPrice: t.agreedPrice != null && t.agreedPrice !== '' ? String(t.agreedPrice) : '',
    currency: (t.currency || 'EUR').toString().trim() || 'EUR',
    pricingNotes: t.pricingNotes ?? '',
    isPriceFinal: !!t.isPriceFinal,
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
      currency: form.value.currency?.trim() || 'EUR',
      pricingNotes: form.value.pricingNotes?.trim() || null,
      isPriceFinal: form.value.isPriceFinal,
    }
    const ap = form.value.agreedPrice?.trim()
    if (ap === '') {
      body.agreedPrice = null
    } else {
      const n = parseFloat(ap.replace(',', '.'))
      if (isNaN(n) || n < 0) {
        message.value = 'Voer een geldig bedrag in (≥ 0).'
        messageOk.value = false
        return
      }
      body.agreedPrice = n
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
.pricing-panel {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  min-width: 200px;
}
.pricing-panel h4 {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #374151;
}
.pricing-form label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.65rem;
  font-size: 0.8rem;
  color: #4b5563;
}
.pricing-form input[type='text'],
.pricing-form textarea {
  padding: 0.4rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
}
.row-check {
  flex-direction: row !important;
  align-items: center;
  gap: 0.5rem !important;
}
.row-check input {
  width: auto;
}
.msg {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
}
.msg.ok {
  color: #059669;
}
.msg.err {
  color: #dc2626;
}
.btn-save {
  width: 100%;
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
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
.btn-save:hover:not(:disabled) {
  background: #3a4f63;
}
</style>
