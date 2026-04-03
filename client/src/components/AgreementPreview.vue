<template>
  <article v-if="agreement" class="agreement-preview document">
    <header class="doc-header">
      <h1>Projectovereenkomst</h1>
      <p class="generated">
        Gegenereerd: <time :datetime="agreement.generatedAt">{{ formatWhen(agreement.generatedAt) }}</time>
      </p>
    </header>

    <section class="doc-section">
      <h2>Partijen</h2>
      <dl class="pairs">
        <dt>Producer / studio</dt>
        <dd>{{ producerLine }}</dd>
        <dt>Klant</dt>
        <dd>{{ customerLine }}</dd>
      </dl>
    </section>

    <section class="doc-section">
      <h2>Project &amp; track</h2>
      <dl class="pairs">
        <dt>Project (job)</dt>
        <dd>{{ agreement.job.name }}</dd>
        <dt>Periode</dt>
        <dd>{{ formatPeriod(agreement.job.periodStart, agreement.job.periodEnd) }}</dd>
        <dt>Track</dt>
        <dd>{{ agreement.track.name }}</dd>
      </dl>
    </section>

    <section class="doc-section">
      <h2>Scope / taken</h2>
      <table class="doc-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Taak</th>
            <th>Status</th>
            <th>Deadline</th>
            <th>Est. uren</th>
            <th>Notities</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in agreement.scopeItems" :key="row.position">
            <td>{{ row.position }}</td>
            <td>{{ row.title }}</td>
            <td>{{ statusLabel(row.status) }}</td>
            <td>{{ row.deadlineAt ? formatWhen(row.deadlineAt) : '—' }}</td>
            <td>{{ row.estimatedHours != null ? row.estimatedHours : '—' }}</td>
            <td class="notes">{{ row.notes || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="agreement.planningEvents?.length" class="doc-section">
      <h2>Planning (gekoppelde agenda)</h2>
      <table class="doc-table">
        <thead>
          <tr>
            <th>Titel</th>
            <th>Start</th>
            <th>Einde</th>
            <th>Taak</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(ev, i) in agreement.planningEvents" :key="i">
            <td>{{ ev.title }}</td>
            <td>{{ formatWhen(ev.start) }}</td>
            <td>{{ formatWhen(ev.end) }}</td>
            <td>{{ ev.assignedToTaskTitle || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="doc-section">
      <h2>Financieel</h2>
      <dl class="pairs">
        <dt>Afgesproken bedrag</dt>
        <dd>{{ moneyLine }}</dd>
        <dt>Definitieve prijs</dt>
        <dd>{{ agreement.track.financial.isPriceFinal ? 'Ja' : 'Nee (voorlopig)' }}</dd>
        <dt>Prijsnotities</dt>
        <dd>{{ agreement.track.financial.pricingNotes || '—' }}</dd>
      </dl>
    </section>

    <section v-if="agreement.generalNotes" class="doc-section">
      <h2>Algemene notities</h2>
      <p class="block-text">{{ agreement.generalNotes }}</p>
    </section>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  agreement: { type: Object, default: null },
})

const STATUS_LABELS = {
  NOT_STARTED: 'Niet gestart',
  IN_PROGRESS: 'Bezig',
  DONE: 'Afgerond',
}

function statusLabel(s) {
  return STATUS_LABELS[s] || s
}

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function formatPeriod(start, end) {
  try {
    const a = new Date(start).toLocaleDateString(undefined, { dateStyle: 'medium' })
    const b = new Date(end).toLocaleDateString(undefined, { dateStyle: 'medium' })
    return `${a} – ${b}`
  } catch {
    return ''
  }
}

const producerLine = computed(() => {
  const p = props.agreement?.producer
  if (!p) return '—'
  const name = p.name || ''
  const email = p.email ? ` (${p.email})` : ''
  return (name + email).trim() || '—'
})

const customerLine = computed(() => {
  const c = props.agreement?.customer
  if (!c) return '—'
  return c.email ? `${c.name} (${c.email})` : c.name
})

const moneyLine = computed(() => {
  const f = props.agreement?.track?.financial
  if (!f) return '—'
  if (f.agreedPrice == null) return '—'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: f.currency || 'EUR',
    }).format(f.agreedPrice)
  } catch {
    return `${f.agreedPrice} ${f.currency || 'EUR'}`
  }
})
</script>

<style scoped>
.agreement-preview {
  max-width: 720px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
  font-family: system-ui, -apple-system, sans-serif;
  color: #111827;
  line-height: 1.45;
}
.document {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.doc-header {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
  margin-bottom: 1.25rem;
}
.doc-header h1 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  font-weight: 600;
}
.generated {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
}
.doc-section {
  margin-bottom: 1.5rem;
}
.doc-section h2 {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
}
.pairs {
  margin: 0;
  display: grid;
  grid-template-columns: 10rem 1fr;
  gap: 0.35rem 1rem;
  font-size: 0.9rem;
}
.pairs dt {
  color: #6b7280;
  font-weight: 500;
}
.pairs dd {
  margin: 0;
}
.doc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.doc-table th,
.doc-table td {
  border: 1px solid #e5e7eb;
  padding: 0.45rem 0.5rem;
  text-align: left;
  vertical-align: top;
}
.doc-table th {
  background: #f9fafb;
  font-weight: 600;
  color: #4b5563;
}
.notes {
  max-width: 14rem;
  word-break: break-word;
}
.block-text {
  margin: 0;
  white-space: pre-wrap;
  font-size: 0.9rem;
}

@media print {
  .agreement-preview {
    border: none;
    max-width: none;
    padding: 0;
  }
  .doc-table {
    font-size: 9pt;
  }
}
</style>
