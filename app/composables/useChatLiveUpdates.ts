import type { Chat } from '~/types/chat'
import type { MessageContentType, MessageType } from '#shared/utils/enums'

const INITIAL_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 30_000
const RECONNECT_BACKOFF_FACTOR = 2

function createReconnectable(label: string, onConnect: (signal: AbortSignal) => Promise<void>) {
  let controller: AbortController | null = null
  let delay = INITIAL_RECONNECT_DELAY
  let timeout: ReturnType<typeof setTimeout> | undefined
  const toast = useToast()

  function start() {
    if (controller) controller.abort()
    controller = new AbortController()
    delay = INITIAL_RECONNECT_DELAY

    ;(async () => {
      try {
        await onConnect(controller!.signal)
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        toast.add({ title: `${label} connection lost`, description: err instanceof Error ? err.message : undefined, color: 'warning' })
        if (controller!.signal.aborted) return
        timeout = setTimeout(start, delay)
        delay = Math.min(delay * RECONNECT_BACKOFF_FACTOR, MAX_RECONNECT_DELAY)
      }
    })()
  }

  function stop() {
    clearTimeout(timeout)
    timeout = undefined
    if (controller) {
      controller.abort()
      controller = null
    }
  }

  return { start, stop }
}

export function useChatLiveUpdates(options: {
  selectedChatId: Ref<string | null>
  chatSidebar: Ref<{ chats: Chat[]; fetchChats: () => Promise<void> } | null>
  conversationPanel: Ref<{ refreshMessages: () => Promise<void>; appendIncomingMessage: (data: Record<string, unknown> | null) => void; isNearBottom: boolean } | null>
  onChatDisallowed?: () => void
}) {
  const { selectedChatId, chatSidebar, conversationPanel, onChatDisallowed } = options
  const { $orpc } = useNuxtApp()

  function updateSidebarChat(chatId: string, msg: Record<string, unknown>) {
    if (!chatSidebar.value?.chats) return
    const chat = chatSidebar.value.chats.find(c => c.id === chatId)
    if (!chat) return

    const senderName = (msg.from as { user?: { displayName?: string } })?.user?.displayName ?? null
    const body = msg.body as { content?: string; contentType?: string } | undefined
    const createdAt = String(msg.createdDateTime ?? new Date().toISOString())
    chat.lastMessagePreview = {
      id: String(msg.id ?? ''),
      createdDateTime: createdAt,
      messageType: String(msg.messageType ?? 'message') as MessageType,
      contentType: (body?.contentType ?? 'text') as MessageContentType,
      content: body?.content ?? '',
      senderDisplayName: senderName,
    }
    chat.lastUpdatedDateTime = createdAt

    // Don't show unread indicator for the chat we're currently viewing and reading
    if (chatId === selectedChatId.value && conversationPanel.value?.isNearBottom) {
      chat.lastMessageReadDateTime = createdAt
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
        onChatDisallowed?.()
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
    if (!chat?.lastMessagePreview) return
    chat.lastMessageReadDateTime = chat.lastMessagePreview.createdDateTime
  }

  watch(
    [() => conversationPanel.value?.isNearBottom, selectedChatId],
    () => markSelectedChatAsRead(),
  )

  const globalConnection = createReconnectable('Global live', async (signal) => {
    const stream = await $orpc.chats.liveAllMessages({}, { signal })
    for await (const payload of stream) {
      if (payload.type === 'message' && payload.chatId && payload.data) {
        updateSidebarChat(payload.chatId, payload.data)
        if (payload.chatId === selectedChatId.value) {
          conversationPanel.value?.appendIncomingMessage(payload.data)
        }
      } else if (payload.type === 'visibility' && payload.chatId) {
        handleVisibilityChange(payload.chatId, (payload.data as { allowed?: boolean })?.allowed ?? false)
      } else if (payload.type === 'respond' && payload.chatId) {
        handleRespondChange(payload.chatId, (payload.data as { canRespond?: boolean })?.canRespond ?? false)
      }
    }
  })

  function connectGlobalLive() {
    globalConnection.start()
  }

  function disconnectGlobalLive() {
    globalConnection.stop()
  }

  onScopeDispose(() => {
    disconnectGlobalLive()
  })

  return {
    connectGlobalLive,
    disconnectGlobalLive,
  }
}
