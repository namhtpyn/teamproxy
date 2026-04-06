<script setup lang="ts">
import type { ChatMember } from '~/types/chat'

const props = defineProps<{
  members: ChatMember[]
  query: string
  visible: boolean
}>()

const emit = defineEmits<{
  select: [member: ChatMember]
}>()

const activeOptionId = computed(() => {
  const member = visibleMembers.value[activeIndex.value]
  return member ? `mention-option-${member.id}` : undefined
})

const activeIndex = ref(0)

const filteredMembers = computed(() => {
  if (!props.query) return props.members
  const q = props.query.toLowerCase()
  return props.members.filter((m) =>
    m.displayName.toLowerCase().includes(q),
  )
})

const visibleMembers = computed(() => filteredMembers.value.slice(0, 5))

watch(
  () => visibleMembers.value.length,
  (len) => {
    if (activeIndex.value >= len) activeIndex.value = Math.max(0, len - 1)
  },
)

watch(() => props.visible, (v) => {
  if (v) activeIndex.value = 0
})

function getHighlightParts(displayName: string): { text: string; highlighted: boolean }[] {
  if (!props.query) return [{ text: displayName, highlighted: false }]
  const idx = displayName.toLowerCase().indexOf(props.query.toLowerCase())
  if (idx === -1) return [{ text: displayName, highlighted: false }]
  return [
    { text: displayName.slice(0, idx), highlighted: false },
    { text: displayName.slice(idx, idx + props.query.length), highlighted: true },
    { text: displayName.slice(idx + props.query.length), highlighted: false },
  ]
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.visible) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % visibleMembers.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value =
      (activeIndex.value - 1 + visibleMembers.value.length) %
      visibleMembers.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const member = visibleMembers.value[activeIndex.value]
    if (member) emit('select', member)
  } else if (e.key === 'Escape') {
    e.preventDefault()
  }
}

defineExpose({ handleKeydown, activeOptionId })
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0 -translate-y-1"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-100 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-1"
  >
    <div
      v-if="visible"
      id="mention-listbox"
      role="listbox"
      aria-label="Mention suggestions"
      :aria-activedescendant="activeOptionId"
      class="absolute bottom-full left-0 right-0 mb-1 max-h-60 overflow-y-auto rounded-lg border border-default bg-elevated shadow-lg z-50"
    >
      <!-- No results -->
      <div
        v-if="visibleMembers.length === 0"
        class="px-3 py-2 text-sm text-dimmed"
      >
        No results
      </div>

      <!-- Member list -->
      <button
        v-for="(member, idx) in visibleMembers"
        :id="`mention-option-${member.id}`"
        :key="member.id"
        type="button"
        role="option"
        tabindex="-1"
        :aria-selected="idx === activeIndex"
        class="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors"
        :class="
          idx === activeIndex
            ? 'bg-accented'
            : 'hover:bg-accented'
        "
        @click="emit('select', member)"
        @mouseenter="activeIndex = idx"
      >
        <UAvatar size="2xs" class="flex-shrink-0">
          {{ member.displayName.charAt(0).toUpperCase() }}
        </UAvatar>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-highlighted">
            <span v-for="(part, i) in getHighlightParts(member.displayName)" :key="i" :class="part.highlighted ? 'text-primary font-semibold' : ''">{{ part.text }}</span>
          </p>
          <p
            v-if="member.email"
            class="truncate text-xs text-dimmed"
          >
            {{ member.email }}
          </p>
        </div>
      </button>
    </div>
  </Transition>
</template>
