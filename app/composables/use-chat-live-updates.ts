import type { ChatMessage } from '@microsoft/microsoft-graph-types'
import type { Chat } from '~/types/chat'
import type { MessageType } from '#shared/utils/enums'
import { getSender, getLastMessagePreview, setLastMessagePreview, setLastMessageReadDateTime } from '~/utils/graph-helpers'

export function useChatLiveUpdates(options: {
  selectedChatId: Ref<string | null>
  chatSidebar: Ref<{ chats: Chat[]; fetchChats: () => Promise<void> } | null>
  conversationPanel: Ref<{ refreshMessages: () => Promise<void>; appendIncomingMessage: (data: Record<string, unknown> | null) => void; isNearBottom: boolean } | null>
  onChatDisallowed?: () => void
}) {
  const { selectedChatId, chatSidebar, conversationPanel, onChatDisallowed } = options
  const { $orpc } = useNuxtApp()
  const toast = useToast()

  let controller: AbortController | null = null

  function updateSidebarChat(chatId: string, msg: Record<string, unknown>) {
    if (!chatSidebar.value?.chats) return
    const chat = chatSidebar.value.chats.find(c => c.id === chatId)
    if (!chat) return

    const chatMsg = msg as ChatMessage
    const senderName = getSender(chatMsg)?.displayName ?? null
    const body = chatMsg.body
    const createdAt = String(chatMsg.createdDateTime ?? new Date().toISOString())
    const msgType = String(chatMsg.messageType ?? 'message') as MessageType

    let previewContent = body?.content ?? ''
    if (chatMsg.eventDetail) {
      previewContent = getSystemEventText(chatMsg.eventDetail as Record<string, unknown>) ?? 'System event'
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
    const preview = getLastMessagePreview(chat!)
    if (!chat || !preview) return
    setLastMessageReadDateTime(chat, preview.createdDateTime)
  }

  watch(
    [() => conversationPanel.value?.isNearBottom, selectedChatId],
    () => markSelectedChatAsRead(),
  )

  async function connectGlobalLive() {
    if (controller) controller.abort()
    controller = new AbortController()

    try {
      const stream = await $orpc.chats.liveAllMessages({}, {
        signal: controller.signal,
        context: {
          retry: Number.POSITIVE_INFINITY,
          shouldRetry: () => true,
          onRetry: () => {
            toast.add({ title: 'Reconnecting...', color: 'warning' })
            return (isSuccess: boolean) => {
              if (isSuccess) {
                toast.add({ title: 'Reconnected', color: 'success' })
              }
            }
          },
        },
      })

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
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      toast.add({ title: 'Live connection lost', description: err instanceof Error ? err.message : undefined, color: 'error' })
    }
  }

  function disconnectGlobalLive() {
    if (controller) {
      controller.abort()
      controller = null
    }
  }

  onScopeDispose(() => {
    disconnectGlobalLive()
  })

  return {
    connectGlobalLive,
    disconnectGlobalLive,
  }
}
