export default defineNuxtRouteMiddleware(() => {
  const { isAuthenticated, isAdmin, loading } = useAuth()

  if (loading.value) return
  if (!isAuthenticated.value) return navigateTo('/login')
  if (!isAdmin.value) return navigateTo('/chats')
})
