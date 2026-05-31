<script setup lang="ts">
import type { ChatMessage } from '@microsoft/microsoft-graph-types'
import type { Chat } from '~/types/chat'
import type { MessageType } from '#shared/utils/enums'
import { whenever } from '@vueuse/core'
import { getSender, getLastMessagePreview, setLastMessagePreview, setLastMessageReadDateTime } from '~/utils/graph-helpers'

useSeoMeta({ title: 'Chats — TeamProxy' })

definePageMeta({
  layout: 'default',
})

const { isAuthenticated, loading: authLoading } = useAuth()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const selectedChatId = ref<string | null>(null)
const currentChat = ref<Chat | null>(null)
const { images: lightboxImages, index: lightboxIndex, visible: lightboxVisible, close: closeLightbox } = useLightbox()
const conversationPanel = ref<{ refreshMessages: () => Promise<void>; appendIncomingMessage: (data: Record<string, unknown> | null) => void; isNearBottom: boolean } | null>(null)
const chatSidebar = ref<{ chats: Chat[]; fetchChats: () => Promise<void> } | null>(null)

// --- Live event subscriptions ---
const { liveMessageEvent } = useChatMessageEvents()
const { liveVisibilityEvent } = useChatVisibilityEvents()
const { liveRespondEvent } = useChatRespondEvents()
const { liveDisconnectEvent } = useDisconnectEvents()

function updateSidebarChat(chatId: string, msg: Record<string, unknown> | null) {
  if (!chatSidebar.value?.chats || !msg) return
  const chat = chatSidebar.value.chats.find(c => c.id === chatId)
  if (!chat) return

  const chatMsg = msg as ChatMessage
  const senderName = getSender(chatMsg)?.displayName ?? null
  const body = chatMsg.body
  const createdAt = String(chatMsg.createdDateTime ?? new Date().toISOString())
  const msgType = String(chatMsg.messageType ?? 'message') as MessageType

  let previewContent = body?.content ?? ''
  if (chatMsg.eventDetail) {
    previewContent = getSystemEventInfo(chatMsg.eventDetail as Record<string, unknown>)?.text ?? 'System event'
  }

  setLastMessagePreview(chat, {
    id: String(chatMsg.id ?? ''),
    createdDateTime: createdAt,
    messageType: msgType,
    contentType: (body?.contentType ?? 'text') as 'text' | 'html',
    content: previewContent,
    senderDisplayName: senderName,
  })

  chat.lastUpdatedDateTime = createdAt

  if (chatId === selectedChatId.value && conversationPanel.value?.isNearBottom) {
    setLastMessageReadDateTime(chat, createdAt)
  }
}

function handleVisibilityChange(chatId: string, allowed: boolean) {
  if (!chatSidebar.value?.chats) return
  const chats = chatSidebar.value.chats

  if (!allowed) {
    const idx = chats.findIndex(c => c.id === chatId)
    if (idx !== -1) chats.splice(idx, 1)
    if (chatId === selectedChatId.value) {
      selectedChatId.value = null
      currentChat.value = null
      router.replace({ query: {} })
    }
  } else {
    chatSidebar.value.fetchChats()
  }
}

function handleRespondChange(chatId: string, canRespond: boolean) {
  if (!chatSidebar.value?.chats) return
  const chat = chatSidebar.value.chats.find(c => c.id === chatId)
  if (chat) chat.canRespond = canRespond
}

function markSelectedChatAsRead() {
  if (!selectedChatId.value || !chatSidebar.value?.chats) return
  if (!conversationPanel.value?.isNearBottom) return
  const chat = chatSidebar.value.chats.find(c => c.id === selectedChatId.value)
  const preview = getLastMessagePreview(chat!)
  if (!chat || !preview) return
  setLastMessageReadDateTime(chat, preview.createdDateTime)
}

// --- Watchers for live events ---
whenever(liveMessageEvent, (event) => {
  updateSidebarChat(event.chatId, event.data)
  if (event.chatId === selectedChatId.value) {
    conversationPanel.value?.appendIncomingMessage(event.data)
  }
})

whenever(liveVisibilityEvent, (event) => {
  handleVisibilityChange(event.chatId, event.data.allowed)
})

whenever(liveRespondEvent, (event) => {
  handleRespondChange(event.chatId, event.data.canRespond)
})

whenever(liveDisconnectEvent, (event) => {
  toast.add({
    title: 'Teams connection is offline. Chats show last-known messages.',
    color: 'warning',
    duration: 0,
    close: true,
  })
})

watch(
  [() => conversationPanel.value?.isNearBottom, selectedChatId],
  () => markSelectedChatAsRead(),
)

// --- Navigation ---
function goBack() {
  selectedChatId.value = null
  currentChat.value = null
}

function selectChat(chat: Chat) {
  selectedChatId.value = chat.id ?? null
  currentChat.value = chat
  router.replace({ query: { chat: chat.id ?? '' } })
}

onMounted(() => {
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

watch(selectedChatId, () => {
  closeLightbox()
})
</script>

<template>
  <div class="h-full">
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

    <ClientOnly>
      <VueEasyLightbox
        :visible="lightboxVisible"
        :imgs="lightboxImages"
        :index="lightboxIndex"
        @hide="closeLightbox"
      />
    </ClientOnly>
  </div>
</template>
