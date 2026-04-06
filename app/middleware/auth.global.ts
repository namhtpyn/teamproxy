export default defineNuxtRouteMiddleware((to) => {
  const protectedRoutes = ['/chats', '/settings']
  if (!protectedRoutes.some((route) => to.path.startsWith(route))) {
    return
  }

  const { isAuthenticated } = useAuth()

  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }
})
