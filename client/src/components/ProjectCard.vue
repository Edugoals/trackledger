<template>
  <article class="project-card" @click="$emit('click')">
    <h3 class="project-name">{{ project.name }}</h3>
    <span class="customer-name">{{ project.customer?.name || '—' }}</span>
    <div class="stats">
      <span class="stat">{{ project._count?.tracks ?? 0 }} tracks</span>
      <span class="stat">{{ formatHours(project.totalEstimatedHours) }}h est</span>
      <span class="stat">{{ formatHours(project.totalActualHours) }}h actual</span>
    </div>
    <span v-if="hasOverrun" :class="['badge', statusClass]">
      {{ overrunText }}
    </span>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { formatHours, overrunStatus } from '../utils'

const props = defineProps({
  project: { type: Object, required: true },
})

defineEmits(['click'])

const status = computed(() =>
  overrunStatus(props.project.totalEstimatedHours, props.project.totalActualHours)
)

const statusClass = computed(() => {
  if (status.value === 'ok') return 'badge-ok'
  if (status.value === 'warning') return 'badge-warning'
  return 'badge-overrun'
})

const hasOverrun = computed(() => status.value !== 'ok' && status.value !== 'neutral')

const overrunText = computed(() => {
  const pct = props.project.overrunPercentage
  if (pct == null || pct <= 0) return ''
  return `+${pct.toFixed(0)}% over`
})
</script>

<style scoped>
.project-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: box-shadow 0.15s;
}
.project-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.project-name {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 600;
  color: #111;
}
.customer-name {
  display: block;
  font-size: 0.875rem;
  color: #6b7280;
}
.stats {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: #6b7280;
  display: flex;
  gap: 1rem;
}
.badge {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}
.badge-ok { background: #d1fae5; color: #065f46; }
.badge-warning { background: #fef3c7; color: #92400e; }
.badge-overrun { background: #fee2e2; color: #991b1b; }
</style>
