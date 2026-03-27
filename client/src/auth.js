import { ref } from 'vue'

export const authUser = ref(null)

export async function loadAuthUser() {
  const r = await fetch('/api/auth/me', { credentials: 'include' })
  authUser.value = r.ok ? await r.json() : null
}

export function clearAuthUser() {
  authUser.value = null
}
