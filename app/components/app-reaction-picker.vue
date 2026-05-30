<script setup lang="ts">
const STANDARD_REACTIONS = [
  { emoji: '👍', type: '👍' },
  { emoji: '❤️', type: '❤️' },
  { emoji: '😂', type: '😂' },
  { emoji: '😮', type: '😮' },
  { emoji: '😢', type: '😢' },
  { emoji: '😡', type: '😡' },
]

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  select: [reactionType: string]
}>()
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0 scale-95 -translate-y-0.5"
    enter-to-class="opacity-100 scale-100 translate-y-0"
    leave-active-class="transition duration-100 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="visible"
      class="absolute bottom-full left-0 z-10 mb-1.5 flex items-center gap-0.5 rounded-full bg-default px-1 py-0.5 shadow-md ring-1 ring-default"
    >
      <button
        v-for="r in STANDARD_REACTIONS"
        :key="r.type"
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-transform hover:bg-elevated active:scale-110"
        @click="emit('select', r.type)"
      >
        {{ r.emoji }}
      </button>
    </div>
  </Transition>
</template>
