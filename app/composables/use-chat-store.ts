import type { ChatMessage } from '@microsoft/microsoft-graph-types'
import type { Chat } from '~/types/chat'
import { whenever } from '@vueuse/core'
import { getSender } from '~/utils/graph-helpers'

export function useChatStore() {
  const { $orpcClient } = useNuxtApp()
  const { msUserId, ensure: ensureMsUser } = useMsUser()

  const chats = useState<Chat[]>('chat-store:chats', () => [])
  const loading = useState<boolean>('chat-store:loading', () => false)
  const error = useState<string | null>('chat-store:error', () => null)
  const selectedChatId = useState<string | null>('chat-store:selectedChatId', () => null)

  const liveVisibilityEvent = useLiveEvent('liveVisibility')
  const liveRespondEvent = useLiveEvent('liveRespond')
  const liveMessageEvent = useLiveEvent('liveMessages')

  const { notifyNewMessage, incrementUnread, requestPermission, isSupported, permissionGranted } = useChatNotification()

  const handlersRegistered = useState<boolean>('chat-store:sse-registered', () => false)

  if (!handlersRegistered.value) {
    handlersRegistered.value = true

    whenever(liveVisibilityEvent, (event) => {
      if (!event.data.allowed) {
        chats.value = chats.value.filter(c => c.id !== event.chatId)
        if (event.chatId === selectedChatId.value) {
          selectedChatId.value = null
        }
      } else {
        fetchChats()
      }
    })

    whenever(liveRespondEvent, (event) => {
      const chat = chats.value.find(c => c.id === event.chatId)
      if (chat) chat.canRespond = event.data.canRespond
    })

    whenever(liveMessageEvent, (event) => {
      const msg = event.data as ChatMessage | null
      if (!msg || msg.messageType !== 'message') return
      if (event.chatId === selectedChatId.value) return

      const sender = getSender(msg)
      const chatName = chats.value.find(c => c.id === event.chatId)?.topic ?? null
      const body = msg.body?.content ?? ''

      if (sender) {
        notifyNewMessage(event.chatId, sender.displayName, body, chatName)
      }
      incrementUnread()
    })
  }

  async function fetchChats() {
    loading.value = true
    error.value = null
    try {
      const [chatList] = await Promise.all([
        $orpcClient.chats.list().then(r => r.chats),
        ensureMsUser(),
      ])
      chats.value = chatList
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to load chats'
    } finally {
      loading.value = false
    }
  }

  return {
    chats: computed(() => chats.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    selectedChatId,
    fetchChats,
    msUserId,
    requestPermission,
    isSupported,
    permissionGranted,
  }
}
