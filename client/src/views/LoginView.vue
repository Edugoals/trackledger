<template>
  <div class="auth-box">
    <h2>Inloggen</h2>
    <form @submit.prevent="submit">
      <label>
        E-mail
        <input v-model="email" type="email" autocomplete="email" required />
      </label>
      <label>
        Wachtwoord
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" class="btn" :disabled="loading">{{ loading ? 'Bezig...' : 'Inloggen' }}</button>
    </form>
    <p class="hint">
      Nog geen account?
      <router-link to="/register">Registreren</router-link>
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../api'
import { authUser } from '../auth'

const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const r = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      error.value = data.error || 'Inloggen mislukt'
      return
    }
    authUser.value = data
    const redirect = route.query.redirect
    router.replace(typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/projects')
  } catch (e) {
    error.value = 'Netwerkfout'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-box { max-width: 360px; margin: 2rem auto; }
h2 { margin-top: 0; }
form { display: flex; flex-direction: column; gap: 1rem; }
label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; }
input { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; }
.error { color: #b91c1c; margin: 0; font-size: 0.9rem; }
.hint { margin-top: 1.5rem; font-size: 0.95rem; }
.btn { padding: 0.5rem 1rem; background: #213547; color: white; border: none; border-radius: 6px; cursor: pointer; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
a { color: #213547; }
</style>
