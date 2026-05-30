export default defineNuxtRouteMiddleware(async () => {
  const { isAuthenticated, isAdmin, loading, fetchStatus, user } = useAuth()

  if (loading.value) return
  if (!isAuthenticated.value) return navigateTo('/login')

  // Role is not stored in cookie (security) — fetch from server if missing
  if (!user.value?.role) {
    await fetchStatus()
  }

  if (!isAdmin.value) return navigateTo('/chats')
})
