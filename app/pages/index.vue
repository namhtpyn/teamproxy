<script setup lang="ts">
useSeoMeta({ title: 'TeamProxy' })

definePageMeta({
  layout: 'auth',
})

const { isAuthenticated, fetchStatus } = useAuth()

onMounted(async () => {
  await fetchStatus()
  if (isAuthenticated.value) {
    await navigateTo('/chats')
  } else {
    await navigateTo('/login')
  }
})
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center">
    <div class="flex items-center gap-3">
      <div
        class="h-8 w-8 animate-spin rounded-full border-2 border-default border-t-primary"
      />
      <span class="text-sm text-muted">Redirecting...</span>
    </div>
  </div>
</template>
