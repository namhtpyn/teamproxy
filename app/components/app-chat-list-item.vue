<script setup lang="ts">
import type { Chat } from '~/types/chat'
import { useTimeAgo } from '@vueuse/core'
import { getLastMessagePreview, getChatType } from '~/utils/graph-helpers'
import { stripHtml } from '~/utils/chat-helpers'

const props = defineProps<{
  chat: Chat
  selected: boolean
  isUnread: boolean
}>()

const emit = defineEmits<{
  select: []
}>()

const { user } = useAuth()

const displayName = computed(() => getChatDisplayName(props.chat, user.value?.id))
const initial = computed(() => getChatInitial(props.chat, user.value?.id))
const chatType = computed(() => getChatType(props.chat))

const timeAgo = useTimeAgo(
  () => getLastMessagePreview(props.chat)?.createdDateTime ?? Date.now(),
)

const previewText = computed(() => {
  const preview = getLastMessagePreview(props.chat)
  if (!preview?.content) return ''
  const text = stripHtml(preview.content)
  return text.length > 50 ? text.slice(0, 50) + '…' : text
})

</script>

<template>
  <button
    role="listitem"
    :aria-selected="selected"
    class="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-elevated"
    :class="
      selected
        ? 'bg-elevated'
        : 'border-b border-default'
    "
    @click="emit('select')"
  >
    <UAvatar class="flex-shrink-0" size="sm">
            {{ initial }}
    </UAvatar>

    <div class="min-w-0 flex-1">
      <div class="flex items-center justify-between gap-1">
        <div class="flex min-w-0 items-center gap-1">
          <span
            class="truncate text-sm text-highlighted"
            :class="props.isUnread ? 'font-semibold' : 'font-medium'"
          >
            {{ displayName }}
          </span>
          <UIcon
            v-if="chatType === 'group'"
            name="i-lucide-users"
            class="h-3 w-3 flex-shrink-0 text-dimmed"
          />
          <UIcon
            v-else-if="chatType === 'meeting'"
            name="i-lucide-video"
            class="h-3 w-3 flex-shrink-0 text-dimmed"
          />
        </div>
        <div class="flex flex-shrink-0 items-center gap-1.5">
          <span
            v-if="props.isUnread"
            class="h-2 w-2 rounded-full bg-primary"
          />
          <span class="text-xs text-dimmed">
            {{ timeAgo }}
          </span>
        </div>
      </div>
      <p v-if="previewText" class="truncate text-xs text-dimmed">{{ previewText }}</p>
    </div>
  </button>
</template>
