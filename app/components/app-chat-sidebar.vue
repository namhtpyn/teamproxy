<script setup lang="ts">
import type { Chat } from '~/types/chat'
import { useAsyncState } from '@vueuse/core'
import { getLastMessagePreview, getLastMessageReadDateTime } from '~/utils/graph-helpers'

const { $orpcClient: $orpc } = useNuxtApp()

const emit = defineEmits<{
  'select-chat': [chat: Chat]
}>()

const props = defineProps<{
  selectedChatId?: string | null
}>()

const { state: chats, isLoading: chatsLoading, error: chatsError, execute: fetchChats } = useAsyncState(
  () => $orpc.chats.list().then(r => r.chats),
  [] as Chat[],
)

function checkUnread(chat: Chat): boolean {
  const preview = getLastMessagePreview(chat)
  const readDateTime = getLastMessageReadDateTime(chat)
  if (!preview || !readDateTime) return false
  return (
    new Date(preview.createdDateTime).getTime() >
    new Date(readDateTime).getTime()
  )
}

const sortedChats = computed(() =>
  [...chats.value]
    .sort((a, b) => {
      const aTime = getLastMessagePreview(a)?.createdDateTime ?? a.lastUpdatedDateTime ?? ''
      const bTime = getLastMessagePreview(b)?.createdDateTime ?? b.lastUpdatedDateTime ?? ''
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })
    .map(chat => ({ chat, isUnread: checkUnread(chat) })),
)

function handleSelect(chat: Chat) {
  emit('select-chat', chat)
}

defineExpose({ chats, fetchChats })
</script>

<template>
  <div
    class="flex h-full flex-col"
  >
    <div class="flex-shrink-0 border-b border-default px-4 py-3">
      <h1 class="text-base font-semibold tracking-tight text-highlighted">
        Chats
      </h1>
      <p
        v-if="chats.length > 0"
        class="mt-0.5 text-xs text-dimmed"
      >
        {{ chats.length }} conversation{{ chats.length !== 1 ? 's' : '' }}
      </p>
    </div>

    <div v-if="chatsLoading" class="flex flex-1 items-center justify-center">
      <AppLoadingSpinner />
    </div>

    <AppErrorAlert v-else-if="chatsError" :message="String(chatsError)" @retry="fetchChats" />

    <AppEmptyState v-else-if="sortedChats.length === 0" icon="i-lucide-message-square" message="No conversations yet" />

    <div v-else class="flex-1 overflow-y-auto" role="listbox" aria-label="Chat list">
      <AppChatListItem
        v-for="item in sortedChats"
        :key="item.chat.id"
        :chat="item.chat"
        :selected="item.chat.id === props.selectedChatId"
        :is-unread="item.isUnread"
        @select="handleSelect(item.chat)"
      />
    </div>
  </div>
</template>
