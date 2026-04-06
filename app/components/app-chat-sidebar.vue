<script setup lang="ts">
import type { Chat } from '~/types/chat'
import { getLastMessagePreview, getLastMessageReadDateTime, getLastUpdatedDateTime } from '~/utils/graph-helpers'

const { $orpc } = useNuxtApp()

const emit = defineEmits<{
  'select-chat': [chat: Chat]
}>()

const props = defineProps<{
  selectedChatId?: string | null
}>()

const chats = ref<Chat[]>([])
const chatsLoading = ref(false)
const chatsError = ref<string | null>(null)

const sortedChats = computed(() =>
  [...chats.value].sort(
    (a, b) =>
      new Date(getLastUpdatedDateTime(b)).getTime() -
      new Date(getLastUpdatedDateTime(a)).getTime(),
  ),
)

onMounted(() => {
  fetchChats()
})

async function fetchChats() {
  chatsLoading.value = true
  chatsError.value = null
  try {
    const result = await $orpc.chats.list()
    chats.value = result.chats
  } catch (err: unknown) {
    chatsError.value = getErrorMessage(err, 'Failed to load chats')
    chats.value = []
  } finally {
    chatsLoading.value = false
  }
}

function isUnread(chat: Chat): boolean {
  const preview = getLastMessagePreview(chat)
  const readDateTime = getLastMessageReadDateTime(chat)
  if (!preview || !readDateTime) return false
  return (
    new Date(preview.createdDateTime).getTime() >
    new Date(readDateTime).getTime()
  )
}

function handleSelect(chat: Chat) {
  emit('select-chat', chat)
}

defineExpose({ chats, fetchChats })
</script>

<template>
  <div
    class="h-full flex-col"
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

    <AppErrorAlert v-else-if="chatsError" :message="chatsError" @retry="fetchChats" />

    <AppEmptyState v-else-if="sortedChats.length === 0" icon="i-lucide-message-square" message="No conversations yet" />

    <div v-else class="flex-1 overflow-y-auto" role="list" aria-label="Chat list">
      <AppChatListItem
        v-for="chat in sortedChats"
        :key="chat.id"
        :chat="chat"
        :selected="chat.id === props.selectedChatId"
        :is-unread="isUnread(chat)"
        @select="handleSelect(chat)"
      />
    </div>
  </div>
</template>
