<script setup lang="ts">
import type { Chat } from '~/types/chat'

useSeoMeta({ title: 'Chats — TeamProxy' })

definePageMeta({
  layout: 'default',
})

const { isAuthenticated, loading: authLoading } = useAuth()
const route = useRoute()
const router = useRouter()

const selectedChatId = ref<string | null>(null)
const currentChat = ref<Chat | null>(null)
const conversationPanel = ref<{ refreshMessages: () => Promise<void>; appendIncomingMessage: (data: Record<string, unknown> | null) => void; isNearBottom: boolean } | null>(null)
const chatSidebar = ref<{ chats: Chat[]; fetchChats: () => Promise<void> } | null>(null)

const { connectGlobalLive, disconnectGlobalLive } = useChatLiveUpdates({
  selectedChatId,
  chatSidebar,
  conversationPanel,
  onChatDisallowed() {
    currentChat.value = null
    router.replace({ query: {} })
  },
})

function goBack() {
  selectedChatId.value = null
  currentChat.value = null
}

function selectChat(chat: Chat) {
  selectedChatId.value = chat.id
  currentChat.value = chat
  router.replace({ query: { chat: chat.id } })
}

onMounted(() => {
  connectGlobalLive()
  restoreFromQuery()
})

function restoreFromQuery() {
  const chatId = route.query.chat as string | undefined
  if (!chatId) return
  const chat = chatSidebar.value?.chats?.find(c => c.id === chatId)
  if (chat) { selectChat(chat); return }
  watch(
    () => chatSidebar.value?.chats.length,
    (len) => {
      if (len) {
        const found = chatSidebar.value?.chats?.find(c => c.id === chatId)
        if (found) selectChat(found)
      }
    },
    { once: true },
  )
}

onUnmounted(() => {
  disconnectGlobalLive()
})
</script>

<template>
  <div v-if="authLoading" class="flex h-dvh items-center justify-center">
    <AppLoadingSpinner />
  </div>

  <div v-else-if="!isAuthenticated" class="flex h-dvh items-center justify-center">
    <p class="text-sm text-muted">Redirecting...</p>
  </div>

  <div v-else class="flex h-full">
      <AppChatSidebar
        ref="chatSidebar"
        :selected-chat-id="selectedChatId"
        :class="selectedChatId ? 'hidden md:flex' : 'flex'"
        class="w-full flex-shrink-0 border-r border-default bg-default md:w-80"
        @select-chat="selectChat"
      />
      <AppConversationPanel
        ref="conversationPanel"
        :chat="currentChat"
        :class="!selectedChatId ? 'hidden md:flex' : 'flex'"
        class="min-w-0 flex-1"
        @back="goBack"
      />
    </div>
</template>
