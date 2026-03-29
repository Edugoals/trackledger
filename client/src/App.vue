<template>
  <div class="app">
    <h1>TrackLedger</h1>

    <template v-if="!authUser">
      <router-view />
    </template>

    <template v-else>
      <header class="header">
        <span>Hallo, {{ authUser.name || authUser.email }}</span>
        <nav class="nav">
          <router-link to="/projects" class="nav-link">Projects</router-link>
          <router-link to="/customers" class="nav-link">Customers</router-link>
          <router-link to="/tasks" class="nav-link">Tasks</router-link>
        </nav>
        <div class="header-actions">
          <span v-if="authUser.googleConnected" class="badge badge-ok" title="Google Calendar gekoppeld">
            Google gekoppeld
          </span>
          <span v-else class="badge badge-muted" title="Nog geen Google Calendar">
            Geen Google-agenda
          </span>
          <a
            v-if="!authUser.googleConnected"
            href="/api/auth/google/connect/start"
            class="btn btn-small"
          >
            Google Calendar koppelen
          </a>
          <select
            v-model="headerContext.selectedCustomerId"
            class="sync-select"
            title="Kies klant voor agenda-sync"
            :disabled="!authUser.googleConnected"
          >
            <option :value="null">— Klant voor sync —</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
          <button
            @click="sync"
            :disabled="syncing || !headerContext.selectedCustomerId || !authUser.googleConnected"
            class="btn btn-small"
            title="Sync agenda van geselecteerde klant"
          >
            {{ syncing ? 'Sync...' : 'Sync van Google' }}
          </button>
          <button @click="logout" class="btn btn-small">Uitloggen</button>
        </div>
      </header>

      <p v-if="googleBanner" class="banner">{{ googleBanner }}</p>

      <main class="main">
        <router-view />
      </main>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from './api'
import { authUser, loadAuthUser, clearAuthUser } from './auth'
import { headerContext } from './stores/headerContext'

const route = useRoute()
const router = useRouter()
const syncing = ref(false)
const customers = ref([])

const googleBanner = computed(() => {
  const g = route.query.google
  const reason = route.query.reason
  if (g === 'connected') return 'Google Calendar is gekoppeld.'
  if (g === 'need_login') return 'Log eerst in om Google te koppelen.'
  if (g === 'conflict') return 'Dit Google-account is al aan een ander profiel gekoppeld.'
  if (g === 'error') {
    if (reason === 'oauth_not_configured' || reason === 'oauth_config') {
      return 'Google OAuth is niet geconfigureerd op de server (GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI).'
    }
    return 'Google-koppeling mislukt. Controleer of de OAuth-client in Google Cloud klopt en of de redirect-URI exact overeenkomt.'
  }
  return ''
})

async function loadCustomers() {
  const r = await api('/api/customers')
  if (r.ok) customers.value = await r.json()
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
  clearAuthUser()
  headerContext.selectedCustomerId = null
  router.push('/login')
}

onMounted(async () => {
  if (route.query.google) {
    await loadAuthUser()
    router.replace({ path: route.path, query: {} })
  }
  if (authUser.value) await loadCustomers()
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
.header-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.sync-select { padding: 0.3rem 0.5rem; border-radius: 6px; border: 1px solid #d1d5db; font-size: 0.9rem; }
.btn { padding: 0.5rem 1rem; background: #213547; color: white; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-block; }
.btn:hover { background: #3a4f63; }
.btn-small { font-size: 0.9rem; padding: 0.3rem 0.6rem; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.main { min-height: 200px; }
.badge { font-size: 0.8rem; padding: 0.2rem 0.4rem; border-radius: 4px; }
.badge-ok { background: #d1fae5; color: #065f46; }
.badge-muted { background: #f3f4f6; color: #6b7280; }
.banner { margin: 0 0 1rem; padding: 0.5rem 0.75rem; background: #eff6ff; border-radius: 6px; color: #1e40af; font-size: 0.95rem; }
</style>
