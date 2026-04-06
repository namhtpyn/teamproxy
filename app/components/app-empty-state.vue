<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  message: string
  size?: 'sm' | 'md' | 'lg'
}>(), {
  icon: 'i-lucide-message-circle',
  size: 'md',
})

const sizeClasses = {
  sm: 'mb-2 h-6 w-6',
  md: 'mb-3 h-8 w-8',
  lg: 'mb-4 h-10 w-10',
}
</script>

<template>
  <div class="flex flex-1 flex-col items-center justify-center p-6">
    <UIcon :name="icon" :class="sizeClasses[size]" class="text-dimmed" />
    <p class="text-sm text-muted">{{ message }}</p>
  </div>
</template>
