<script setup lang="ts">
useSeoMeta({ title: 'Settings — TeamProxy' })

definePageMeta({
  layout: 'default',
  middleware: ['admin'],
})

const route = useRoute()
const router = useRouter()
const { user, isAuthenticated, loading } = useAuth()

onMounted(() => {
  if (route.query.connected || route.query.disconnected) {
    nextTick(() => {
      router.replace({ query: {} })
    })
  }
})
</script>

<template>
  <div class="mx-auto h-full max-w-3xl overflow-y-auto px-6 py-8">
    <h1 class="sr-only">Settings</h1>
    <div v-if="loading" class="flex items-center justify-center py-20">
      <AppLoadingSpinner />
    </div>

    <div v-else-if="!isAuthenticated || !user" class="flex flex-col items-center gap-4 py-20">
      <UIcon name="i-lucide-lock" class="h-12 w-12 text-dimmed" />
      <p class="text-sm text-muted">Not signed in</p>
    </div>

    <template v-else>
      <UAlert
        v-if="route.query.connected === 'true'"
        title="Connected successfully"
        color="success"
        variant="soft"
        class="mb-6"
      />
      <UAlert
        v-else-if="route.query.disconnected === 'true'"
        title="Disconnected"
        color="warning"
        variant="soft"
        class="mb-6"
      />

      <AppMsConnectionCard class="mb-8" />
      <AppChatVisibilityCard />
    </template>
  </div>
</template>
