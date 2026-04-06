<script setup lang="ts">
withDefaults(defineProps<{
  message: string
  retryLabel?: string
  showRetry?: boolean
}>(), {
  retryLabel: 'Retry',
  showRetry: true,
})

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <UAlert :title="message" color="error" variant="soft" />
    <UButton v-if="showRetry" class="mt-4" variant="outline" size="sm" @click="emit('retry')">
      <UIcon name="i-lucide-refresh-cw" class="mr-1.5 h-3.5 w-3.5" />
      {{ retryLabel }}
    </UButton>
  </div>
</template>
