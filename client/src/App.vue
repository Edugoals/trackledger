<template>
  <div class="app">
    <h1>TrackLedger</h1>

    <template v-if="loading">Laden...</template>

    <template v-else-if="!user">
      <p>Log in met Google om je agenda te synchroniseren.</p>
      <a :href="loginUrl" class="btn">Inloggen met Google</a>
    </template>

    <template v-else>
      <header class="header">
        <span>Hallo, {{ user.name || user.email }}</span>
        <nav class="nav">
          <router-link to="/projects" class="nav-link">Projects</router-link>
          <router-link to="/customers" class="nav-link">Customers</router-link>
          <router-link to="/tasks" class="nav-link">Tasks</router-link>
        </nav>
        <div class="header-actions">
          <select
            v-model="headerContext.selectedCustomerId"
            class="sync-select"
            title="Kies klant voor agenda-sync"
          >
            <option :value="null">— Klant voor sync —</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
          <button
            @click="sync"
            :disabled="syncing || !headerContext.selectedCustomerId"
            class="btn btn-small"
            title="Sync agenda van geselecteerde klant"
          >
            {{ syncing ? 'Sync...' : 'Sync van Google' }}
          </button>
          <button @click="logout" class="btn btn-small">Uitloggen</button>
        </div>
      </header>

      <main class="main">
        <router-view />
      </main>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from './api'
import { headerContext } from './stores/headerContext'

const loading = ref(true)
const user = ref(null)
const syncing = ref(false)
const customers = ref([])

const loginUrl = '/api/auth/google'

async function loadCustomers() {
  const r = await api('/api/customers')
  if (r.ok) customers.value = await r.json()
}

async function loadUser() {
  const r = await api('/api/auth/me')
  if (r.ok) user.value = await r.json()
}

async function sync() {
  const id = headerContext.selectedCustomerId
  if (id == null || id === '') return
  syncing.value = true
  try {
    await api('/api/events/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: parseInt(id) }),
    })
    window.dispatchEvent(new CustomEvent('trackledger-sync-done', { detail: { customerId: parseInt(id) } }))
  } catch (e) {
    console.error(e)
  }
  syncing.value = false
}

async function logout() {
  await api('/api/auth/logout')
  user.value = null
  headerContext.selectedCustomerId = null
}

onMounted(async () => {
  await loadUser()
  if (user.value) await loadCustomers()
  loading.value = false
})
</script>

<style>
.app { font-family: system-ui, sans-serif; max-width: 1100px; margin: 0 auto; padding: 2rem; }
h1 { color: #213547; margin: 0 0 1.5rem; }
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}
.nav { display: flex; gap: 1rem; }
.nav-link {
  padding: 0.4rem 0.75rem;
  color: #374151;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 500;
}
.nav-link:hover { background: #f3f4f6; }
.nav-link.router-link-active { background: #213547; color: white; }
.header-actions { display: flex; align-items: center; gap: 0.5rem; }
.sync-select { padding: 0.3rem 0.5rem; border-radius: 6px; border: 1px solid #d1d5db; font-size: 0.9rem; }
.btn { padding: 0.5rem 1rem; background: #213547; color: white; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-block; }
.btn:hover { background: #3a4f63; }
.btn-small { font-size: 0.9rem; padding: 0.3rem 0.6rem; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.main { min-height: 200px; }
</style>
