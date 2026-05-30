export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated } = useAuth()

  // Authenticated users on /login → redirect to /chats
  if (isAuthenticated.value && to.path === '/login') {
    return navigateTo('/chats')
  }

  // Pages with auth: false are public — skip auth check
  if (to.meta.auth === false) return

  // All other pages require auth
  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }
})
