<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const errorMessage = computed(() => import.meta.dev ? props.error.message : 'An unexpected error occurred')
const router = useRouter()

function goHome() {
  clearError()
  router.push('/')
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center">
    <div class="max-w-md text-center">
      <div
        class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-error/10"
      >
        <UIcon name="i-lucide-alert-triangle" class="h-8 w-8 text-error" />
      </div>
      <h1 class="mb-2 text-2xl font-bold text-highlighted">
        {{ error.statusCode ?? 'Error' }}
      </h1>
      <p class="mb-6 text-sm text-muted">
        {{ errorMessage }}
      </p>
      <UButton variant="outline" @click="goHome">
        <UIcon name="i-lucide-home" class="mr-1 h-3 w-3" />
        Go Home
      </UButton>
    </div>
  </div>
</template>
