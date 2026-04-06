<script setup lang="ts">
import type { Chat } from '~/types/chat'
import { useTimeAgo } from '@vueuse/core'
import { getLastMessagePreview, getChatType } from '~/utils/graph-helpers'

const props = defineProps<{
  chat: Chat
  selected: boolean
  isUnread: boolean
}>()

const emit = defineEmits<{
  select: []
}>()

const { user } = useAuth()

const timeAgo = useTimeAgo(
  () => getLastMessagePreview(props.chat)?.createdDateTime ?? Date.now(),
)

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
            {{ getChatInitial(props.chat, user?.id) }}
    </UAvatar>

    <div class="min-w-0 flex-1">
      <div class="flex items-center justify-between gap-1">
        <div class="flex min-w-0 items-center gap-1">
          <span
            class="truncate text-sm text-highlighted"
            :class="props.isUnread ? 'font-semibold' : 'font-medium'"
          >
            {{ getChatDisplayName(props.chat, user?.id) }}
          </span>
          <UIcon
            v-if="getChatType(props.chat) === 'group'"
            name="i-lucide-users"
            class="h-3 w-3 flex-shrink-0 text-dimmed"
          />
          <UIcon
            v-else-if="getChatType(props.chat) === 'meeting'"
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
    </div>
  </button>
</template>
