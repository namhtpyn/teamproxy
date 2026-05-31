<template>
  <div class="flex items-center gap-2 text-sm text-muted">
    <UIcon name="i-lucide-loader-circle" class="h-5 w-5 animate-spin text-muted" />
    <slot> Loading... </slot>
  </div>
</template>
