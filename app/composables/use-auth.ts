import type { UserRole } from '#shared/utils/enums'

interface AuthStatus {
  authenticated: boolean
  user: { id: string; displayName: string | null; role?: UserRole } | null
}

const AUTH_COOKIE_NAME = 'auth'
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

let inflightPromise: Promise<void> | null = null

export function useAuth() {
  const { $orpcClient: $orpc } = useNuxtApp()

  const authCookie = useCookie<{ authenticated: boolean; user: { id: string; displayName: string | null } | null } | null>(AUTH_COOKIE_NAME, {
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
  })

  const cookieVal = authCookie.value
  const status = useState<AuthStatus | null>('auth:status', () => {
    if (!cookieVal || !cookieVal.authenticated || !cookieVal.user) {
      return cookieVal ? { authenticated: cookieVal.authenticated, user: null } satisfies AuthStatus : null
    }
    // Cookie doesn't store role — role is populated after fetchStatus()
    return { authenticated: true, user: { ...cookieVal.user } }
  })
  const loading = useState<boolean>('auth:loading', () => false)

  const user = computed(() => status.value?.user ?? null)
  const isAuthenticated = computed(() => status.value?.authenticated ?? false)
  const isAdmin = computed(() => status.value?.user?.role === 'admin')

  function syncCookie() {
    const s = status.value
    if (s?.authenticated && s.user) {
      const { role: _, ...userWithoutRole } = s.user
      authCookie.value = { authenticated: true, user: userWithoutRole }
    } else {
      authCookie.value = s
    }
  }

  async function doFetchStatus() {
    loading.value = true
    try {
      status.value = await $orpc.auth.getStatus()
      syncCookie()
    } catch {
      status.value = { authenticated: false, user: null }
      syncCookie()
    } finally {
      loading.value = false
    }
  }

  async function fetchStatus() {
    if (inflightPromise) return inflightPromise
    inflightPromise = doFetchStatus()
    try {
      await inflightPromise
    } finally {
      inflightPromise = null
    }
  }

  async function login(username: string, password: string) {
    await $fetch('/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    await fetchStatus()
  }

  async function logout() {
    try {
      await $fetch('/auth/login', { method: 'DELETE' })
    } catch {
      // ignore logout errors — always clear local state
    } finally {
      status.value = { authenticated: false, user: null }
      syncCookie()
      await navigateTo('/login')
    }
  }

  if (import.meta.client && getCurrentInstance()) {
    onMounted(() => {
      if (!status.value || !status.value.user?.role) {
        fetchStatus()
      }
    })
  }

  return {
    status,
    user,
    isAuthenticated,
    isAdmin,
    loading,
    fetchStatus,
    login,
    logout,
  }
}
