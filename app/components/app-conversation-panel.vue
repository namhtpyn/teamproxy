<script setup lang="ts">
import type { ChatMessage } from '@microsoft/microsoft-graph-types'
import type { Chat, OptimisticChatMessage } from '~/types/chat'
import { getChatMembers, getChatType, getEventDetail, getSender, setLastMessagePreview, setLastMessageReadDateTime } from '~/utils/graph-helpers'

const props = defineProps<{
  chat: Chat | null
}>()

const emit = defineEmits<{
  back: []
}>()

const { $orpc } = useNuxtApp()
const { user } = useAuth()
const toast = useToast()

type MessageItem = ChatMessage | OptimisticChatMessage
const messages = ref<MessageItem[]>([])
const messagesLoading = ref(false)
const messagesError = ref<string | null>(null)
const hasMore = ref(false)
const loadingMore = ref(false)
const msUserId = ref<string | null>(null)
const pendingSends = new Set<string>()

const messageListRef = ref<{ scrollToBottom: (force?: boolean) => void; isNearBottom: boolean } | null>(null)

const sortedMessages = computed(() =>
  [...messages.value].sort(
    (a, b) =>
      new Date(a.createdDateTime ?? '').getTime() -
      new Date(b.createdDateTime ?? '').getTime(),
  ),
)

async function loadMessages() {
  if (!props.chat) return
  const chatId = props.chat.id!
  messages.value = []
  messagesError.value = null
  messagesLoading.value = true
  hasMore.value = false
  loadingMore.value = false

  try {
    const result = await $orpc.chats.getMessages({ chatId })
    if (props.chat?.id !== chatId) return
    messages.value = result.messages
    hasMore.value = result.hasMore
  } catch (err: unknown) {
    messagesError.value = getErrorMessage(err, 'Failed to load messages')
    messages.value = []
  } finally {
    messagesLoading.value = false
    nextTick(() => messageListRef.value?.scrollToBottom(true))
  }
}

async function loadMore() {
  if (!props.chat || loadingMore.value || !hasMore.value) return
  loadingMore.value = true

  try {
    const oldest = sortedMessages.value[0]
    const before = oldest?.createdDateTime ?? undefined
    const result = await $orpc.chats.getMessages({ chatId: props.chat.id!, before })
    messages.value = [...result.messages, ...messages.value]
    hasMore.value = result.hasMore
  } catch (err) {
    toast.add({ title: 'Failed to load more messages', description: err instanceof Error ? err.message : undefined, color: 'error' })
  } finally {
    loadingMore.value = false
  }
}

async function fetchMsUserId() {
  try {
    const me = await $orpc.chats.getMe()
    msUserId.value = me.id
  } catch { /* non-critical */ }
}

onMounted(fetchMsUserId)

watch(
  () => props.chat?.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      loadMessages()
    }
  },
)

async function refreshMessages() {
  if (!props.chat) return
  try {
    const result = await $orpc.chats.getMessages({ chatId: props.chat.id! })
    messages.value = result.messages
  } catch (err) {
    toast.add({ title: 'Failed to refresh messages', description: err instanceof Error ? err.message : undefined, color: 'error' })
  }
}


function appendIncomingMessage(raw: Record<string, unknown>) {
  const msg = raw as ChatMessage

  const sender = getSender(msg)

  if (sender?.id && msUserId.value && sender.id === msUserId.value && pendingSends.size > 0) {
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

function handleSubmit(payload: { content: string; image: { contentBytes: string; contentType: string } | null; mentions: Array<{ userId: string; displayName: string }> | undefined }) {
  if (!props.chat) return

  const tempId = `temp:${Date.now()}`
  pendingSends.add(tempId)

  const optimisticMsg: OptimisticChatMessage = {
    id: tempId,
    messageType: 'message',
    body: { content: payload.content, contentType: 'text' },
    createdDateTime: new Date().toISOString(),
    from: msUserId.value && user.value
      ? { user: { id: msUserId.value, displayName: user.value.displayName ?? 'You' } }
      : { user: { id: 'unknown', displayName: 'You' } },
  }

  messages.value = [...messages.value, optimisticMsg]
  nextTick(() => messageListRef.value?.scrollToBottom(true))

  $orpc.chats.sendMessage({
    chatId: props.chat.id!,
    content: payload.content,
    mentions: payload.mentions,
    image: payload.image
      ? { contentBytes: payload.image.contentBytes, contentType: payload.image.contentType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' }
      : undefined,
  }).then(({ message: real }) => {
    if (!pendingSends.has(tempId)) return
    pendingSends.delete(tempId)

    const idx = messages.value.findIndex(m => m.id === tempId)
    if (idx !== -1) {
      const updated = [...messages.value]
      updated[idx] = real as ChatMessage
      messages.value = updated
    }
  }).catch((err: unknown) => {
    pendingSends.delete(tempId)
    const failedMsg = messages.value.find(m => m.id === tempId) as OptimisticChatMessage | undefined
    if (failedMsg) {
      failedMsg.sendFailed = getErrorMessage(err, 'Failed to send')
    }
    toast.add({ title: 'Failed to send message', description: getErrorMessage(err, 'Failed to send message'), color: 'error' })
  })
}

const isNearBottom = computed(() => messageListRef.value?.isNearBottom ?? true)

defineExpose({ messagesContainer: messageListRef, refreshMessages, appendIncomingMessage, isNearBottom })
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <AppEmptyState v-if="!chat" icon="i-lucide-message-circle" message="Select a conversation to start chatting" size="lg" />

    <template v-else>
      <div class="flex-shrink-0 border-b border-default bg-default px-4 py-3">
        <div class="flex items-center gap-3">
          <UButton
            icon="i-lucide-arrow-left"
            variant="ghost"
            size="sm"
            aria-label="Go back"
            class="md:hidden"
            @click="emit('back')"
          />
          <UAvatar size="2xs" class="flex-shrink-0">
            {{ getChatInitial(chat, user?.id) }}
          </UAvatar>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-highlighted">
              {{ getChatDisplayName(chat, user?.id) }}
            </p>
            <p v-if="getChatType(chat) !== 'oneOnOne'" class="text-xs text-dimmed">
              {{ getChatMembers(chat).length }} members
            </p>
          </div>
          <UBadge v-if="getChatType(chat) === 'meeting'" color="info" variant="outline" size="xs">Meeting</UBadge>
          <UBadge v-else-if="getChatType(chat) === 'group'" color="neutral" variant="outline" size="xs">Group</UBadge>
        </div>
      </div>

      <div v-if="messagesLoading" class="flex flex-1 items-center justify-center">
        <AppLoadingSpinner>Loading messages...</AppLoadingSpinner>
      </div>

      <AppErrorAlert v-else-if="messagesError" :message="messagesError" @retry="loadMessages" />

      <AppEmptyState v-else-if="sortedMessages.length === 0" icon="i-lucide-message-circle" message="No messages in this conversation" />

      <AppMessageList
        v-else
        ref="messageListRef"
        :messages="sortedMessages"
        :loading-more="loadingMore"
        :ms-user-id="msUserId"
        @load-more="loadMore"
      />

      <AppMessageInput
        :chat-id="chat.id!"
        :members="getChatMembers(chat)"
        :ms-user-id="msUserId"
        :disabled="!chat.canRespond"
        @submit="handleSubmit"
      />
    </template>
  </div>
</template>
