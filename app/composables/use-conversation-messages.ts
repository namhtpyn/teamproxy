import type { ChatMessage } from '@microsoft/microsoft-graph-types'
import type { Chat, OptimisticChatMessage } from '~/types/chat'

type MessageItem = ChatMessage | OptimisticChatMessage

export function useConversationMessages(
  chat: () => Chat | null,
  opts?: { msUserId?: () => string | null | undefined },
) {
  const { $orpcClient: $orpc } = useNuxtApp()
  const toast = useToast()

  const messages = ref<MessageItem[]>([])
  const messagesLoading = ref(false)
  const messagesError = ref<string | null>(null)
  const nextCursor = ref<string | undefined>(undefined)
  const loadingMore = ref(false)
  const messageListRef = ref<{ scrollToBottom: (force?: boolean) => void; isNearBottom: boolean } | null>(null)
  const pendingSends = new Set<string>()

  const sortedMessages = computed(() =>
    [...messages.value].sort(
      (a, b) =>
        new Date(a.createdDateTime ?? '').getTime() -
        new Date(b.createdDateTime ?? '').getTime(),
    ),
  )

  const isNearBottom = computed(() => messageListRef.value?.isNearBottom ?? true)

  async function loadMessages() {
    const c = chat()
    if (!c) return
    const chatId = c.id!
    messages.value = []
    messagesError.value = null
    messagesLoading.value = true
    nextCursor.value = undefined
    loadingMore.value = false

    try {
      const result = await $orpc.chats.getMessages({ chatId })
      if (chat()?.id !== chatId) return
      messages.value = result.messages
      nextCursor.value = result.nextCursor
    } catch (err: unknown) {
      messagesError.value = getErrorMessage(err, 'Failed to load messages')
      messages.value = []
    } finally {
      messagesLoading.value = false
      nextTick(() => messageListRef.value?.scrollToBottom(true))
    }
  }

  async function loadMore() {
    const c = chat()
    if (!c || loadingMore.value || !nextCursor.value) return
    loadingMore.value = true

    try {
      const result = await $orpc.chats.getMessages({ chatId: c.id!, nextLink: nextCursor.value })
      messages.value = [...result.messages, ...messages.value]
      nextCursor.value = result.nextCursor
    } catch (err: unknown) {
      toast.add({ title: 'Failed to load more messages', description: err instanceof Error ? err.message : undefined, color: 'error' })
    } finally {
      loadingMore.value = false
    }
  }

  async function refreshMessages() {
    const c = chat()
    if (!c) return
    try {
      const result = await $orpc.chats.getMessages({ chatId: c.id! })
      messages.value = result.messages
    } catch (err: unknown) {
      toast.add({ title: 'Failed to refresh messages', description: err instanceof Error ? err.message : undefined, color: 'error' })
    }
  }

  function appendIncomingMessage(raw: Record<string, unknown>) {
    const msg = raw as ChatMessage

    const sender = getSender(msg)
    const msUserId = opts?.msUserId?.()

    if (sender?.id && msUserId && sender.id === msUserId && pendingSends.size > 0) {
      const idx = messages.value.findIndex(m => m.id?.startsWith('temp:'))
      if (idx !== -1) {
        const tempId = messages.value[idx]!.id
        pendingSends.delete(tempId ?? '')
        const updated = [...messages.value]
        updated[idx] = msg
        messages.value = updated
        return
      }
    }

    if (messages.value.some(m => m.id === msg.id)) return

    messages.value = [...messages.value, msg]
  }

  watch(
    () => chat()?.id,
    (newId, oldId) => {
      pendingSends.clear()
      if (newId && newId !== oldId) {
        loadMessages()
      }
    },
  )

  return {
    messages, messagesLoading, messagesError, nextCursor, loadingMore,
    messageListRef, sortedMessages, isNearBottom, pendingSends,
    loadMessages, loadMore, refreshMessages, appendIncomingMessage,
  }
}
