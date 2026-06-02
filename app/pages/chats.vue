<script setup lang="ts">
import type { ChatMessage } from '@microsoft/microsoft-graph-types'
import type { Chat } from '~/types/chat'
import type { MessageContentType, MessageType } from '#shared/utils/enums'
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

const { chats, selectedChatId, fetchChats, requestPermission, isSupported, permissionGranted } = useChatStore()
const currentChat = ref<Chat | null>(null)
const { images: lightboxImages, index: lightboxIndex, visible: lightboxVisible, close: closeLightbox } = useLightbox()
const conversationPanel = ref<{ refreshMessages: () => Promise<void>; appendIncomingMessage: (data: Record<string, unknown> | null) => void; isNearBottom: boolean } | null>(null)

const liveMessageEvent = useLiveEvent('liveMessages')
const liveDisconnectEvent = useLiveEvent('liveDisconnect')

function updateSidebarChat(chatId: string, raw: Record<string, unknown> | null) {
  if (!raw) return
  const chat = chats.value.find(c => c.id === chatId)
  if (!chat) return

  const msg = raw as ChatMessage
  const senderName = getSender(msg)?.displayName ?? null
  const body = msg.body
  const createdAt = msg.createdDateTime ?? new Date().toISOString()

  const previewContent = msg.eventDetail
    ? (getSystemEventInfo(msg.eventDetail as Record<string, unknown>)?.text ?? 'System event')
    : (body?.content ?? '')

  setLastMessagePreview(chat, {
    id: msg.id ?? '',
    createdDateTime: createdAt,
    messageType: (msg.messageType ?? 'message') as MessageType,
    contentType: (body?.contentType ?? 'text') as MessageContentType,
    content: previewContent,
    senderDisplayName: senderName,
  })

  chat.lastUpdatedDateTime = createdAt

  if (chatId === selectedChatId.value && conversationPanel.value?.isNearBottom) {
    setLastMessageReadDateTime(chat, createdAt)
  }
}

function markSelectedChatAsRead() {
  if (!selectedChatId.value) return
  if (!conversationPanel.value?.isNearBottom) return
  const chat = chats.value.find(c => c.id === selectedChatId.value)
  const preview = getLastMessagePreview(chat!)
  if (!chat || !preview) return
  setLastMessageReadDateTime(chat, preview.createdDateTime)
}

whenever(liveMessageEvent, (event) => {
  updateSidebarChat(event.chatId, event.data)
  if (event.chatId === selectedChatId.value) {
    conversationPanel.value?.appendIncomingMessage(event.data)
  }
})

whenever(liveDisconnectEvent, () => {
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

watch(selectedChatId, (newId, oldId) => {
  closeLightbox()
  if (newId === null && oldId !== null) {
    currentChat.value = null
    router.replace({ query: {} })
  }
})

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
  fetchChats()
  restoreFromQuery()
  if (isSupported.value && !permissionGranted.value) {
    requestPermission()
  }
})

function restoreFromQuery() {
  const chatId = route.query.chat as string | undefined
  if (!chatId) return
  const chat = chats.value.find(c => c.id === chatId)
  if (chat) { selectChat(chat); return }
  watch(
    () => chats.value.length,
    (len) => {
      if (len) {
        const found = chats.value.find(c => c.id === chatId)
        if (found) selectChat(found)
      }
    },
    { once: true },
  )
}
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
