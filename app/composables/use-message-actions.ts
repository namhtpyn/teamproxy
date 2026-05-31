import type { ChatMessage } from '@microsoft/microsoft-graph-types'
import type { Ref } from 'vue'
import type { Chat, OptimisticChatMessage } from '~/types/chat'

type MessageItem = ChatMessage | OptimisticChatMessage

export function useMessageActions(
  chat: () => Chat | null,
  messages: Ref<MessageItem[]>,
  pendingSends: Set<string>,
  messageListRef: Ref<{ scrollToBottom: (force?: boolean) => void; isNearBottom: boolean } | null>,
  msUserId: () => string | null | undefined,
) {
  const { $orpcClient: $orpc } = useNuxtApp()
  const { user } = useAuth()
  const toast = useToast()

  const replyingTo = ref<MessageItem | null>(null)
  const editingMessageId = ref<string | null>(null)
  const pinnedMessageIds = ref<string[]>([])

  function handleSubmit(payload: { content: string; image: { contentBytes: string; contentType: string } | null; mentions: Array<{ userId: string; displayName: string }> | undefined; replyToId?: string; hostedContents?: Array<{ temporaryId: string; contentBytes: string; contentType: string }> }) {
    const c = chat()
    if (!c) return

    const chatId = c.id!
    const tempId = `temp:${Date.now()}`
    pendingSends.add(tempId)

    const currentMsUserId = msUserId()
    const optimisticMsg: OptimisticChatMessage = {
      id: tempId,
      messageType: 'message',
      body: { content: payload.content, contentType: 'text' },
      createdDateTime: new Date().toISOString(),
      from: currentMsUserId && user.value
        ? { user: { id: currentMsUserId, displayName: user.value.displayName ?? 'You' } }
        : { user: { id: 'unknown', displayName: 'You' } },
    }

    messages.value = [...messages.value, optimisticMsg]
    replyingTo.value = null
    nextTick(() => messageListRef.value?.scrollToBottom(true))

    $orpc.chats.sendMessage({
      chatId,
      content: payload.content,
      replyToId: payload.replyToId,
      mentions: payload.mentions,
      hostedContents: payload.hostedContents,
    }).then(({ message: real }) => {
      if (chat()?.id !== chatId) return
      if (!pendingSends.has(tempId)) return
      pendingSends.delete(tempId)

      const idx = messages.value.findIndex(m => m.id === tempId)
      if (idx !== -1) {
        const updated = [...messages.value]
        updated[idx] = real as ChatMessage
        messages.value = updated
      }
    }).catch((err: unknown) => {
      if (chat()?.id !== chatId) return
      pendingSends.delete(tempId)
      const failedIdx = messages.value.findIndex(m => m.id === tempId)
      if (failedIdx !== -1) {
        messages.value = messages.value.map(m => m.id === tempId ? { ...m, sendFailed: getErrorMessage(err, 'Failed to send') } as OptimisticChatMessage : m)
      }
      toast.add({ title: 'Failed to send message', description: getErrorMessage(err, 'Failed to send message'), color: 'error' })
    })
  }

  function retryMessage(tempId: string) {
    const c = chat()
    if (!c) return

    const chatId = c.id!
    const idx = messages.value.findIndex(m => m.id === tempId)
    if (idx === -1) return

    const failedMsg = messages.value[idx] as OptimisticChatMessage
    if (!failedMsg.sendFailed) return

    const content = failedMsg.body?.content ?? ''
    pendingSends.add(tempId)
    messages.value = messages.value.map(m => m.id === tempId ? { ...m, sendFailed: undefined } as OptimisticChatMessage : m)

    $orpc.chats.sendMessage({
      chatId,
      content,
    }).then(({ message: real }) => {
      if (chat()?.id !== chatId) return
      if (!pendingSends.has(tempId)) return
      pendingSends.delete(tempId)

      const replaceIdx = messages.value.findIndex(m => m.id === tempId)
      if (replaceIdx !== -1) {
        const updated = [...messages.value]
        updated[replaceIdx] = real as ChatMessage
        messages.value = updated
      }
    }).catch((err: unknown) => {
      if (chat()?.id !== chatId) return
      pendingSends.delete(tempId)
      messages.value = messages.value.map(m => m.id === tempId ? { ...m, sendFailed: getErrorMessage(err, 'Failed to send') } as OptimisticChatMessage : m)
      toast.add({ title: 'Failed to send message', description: getErrorMessage(err, 'Failed to send message'), color: 'error' })
    })
  }

  async function handleReaction({ messageId, reactionType }: { messageId: string; reactionType: string }) {
    const c = chat()
    if (!c) return
    const chatId = c.id!
    const currentMsUserId = msUserId()

    const msg = messages.value.find(m => m.id === messageId)
    if (!msg) return

    const originalReactions = msg.reactions

    // Graph allows only ONE reaction per user per message.
    // If user already has this reaction → toggle off (unset).
    // If user has a DIFFERENT reaction → Graph replaces it, so remove old optimistically first.
    const sameReaction = msg.reactions?.find(
      r => r.reactionType === reactionType && r.user?.user?.id === currentMsUserId,
    )
    const prevReaction = msg.reactions?.find(
      r => r.reactionType !== reactionType && r.user?.user?.id === currentMsUserId,
    )

    let newReactions: typeof originalReactions

    if (sameReaction) {
      // Toggle off: remove this reaction
      const filtered = msg.reactions?.filter(r => r !== sameReaction)
      newReactions = filtered?.length ? filtered : undefined
    } else {
      // Adding new: remove previous reaction first (Graph replaces)
      const filtered = (prevReaction
        ? msg.reactions?.filter(r => r !== prevReaction)
        : msg.reactions) ?? []
      newReactions = [...filtered, {
        reactionType,
        user: { user: { id: currentMsUserId! } },
        createdDateTime: new Date().toISOString(),
      }]
    }

    messages.value = messages.value.map(m => m.id === messageId ? { ...m, reactions: newReactions } : m)

    try {
      if (sameReaction) {
        await $orpc.chats.unsetReaction({ chatId, messageId, reactionType })
      } else {
        await $orpc.chats.setReaction({ chatId, messageId, reactionType })
      }
    } catch (err: unknown) {
      // Roll back optimistic mutation
      messages.value = messages.value.map(m => m.id === messageId ? { ...m, reactions: originalReactions } : m)
      console.error('[handleReaction] API call failed:', err, { chatId, messageId, reactionType })
    }
  }

  function onReply(messageId: string) {
    const msg = messages.value.find(m => m.id === messageId)
    if (msg) replyingTo.value = msg
  }

  function clearReply() {
    replyingTo.value = null
  }

  function onEdit(messageId: string) {
    editingMessageId.value = messageId
    replyingTo.value = null
  }

  function onSaveEdit(payload: { messageId: string; content: string }) {
    const c = chat()
    if (!c) return
    const chatId = c.id!
    const { messageId, content } = payload

    const msg = messages.value.find(m => m.id === messageId)
    if (!msg?.body) return

    const oldContent = msg.body.content
    msg.body.content = content

    editingMessageId.value = null

    $orpc.chats.editMessage({ chatId, messageId, content }).catch((err: unknown) => {
      const target = messages.value.find(m => m.id === messageId)
      if (target?.body) target.body.content = oldContent
      toast.add({ title: 'Failed to edit message', description: getErrorMessage(err, 'Failed to edit'), color: 'error' })
    })
  }

  function onCancelEdit() {
    editingMessageId.value = null
  }

  function onDelete(messageId: string) {
    const c = chat()
    if (!c) return
    const chatId = c.id!

    const msg = messages.value.find(m => m.id === messageId)
    if (!msg) return

    const oldDeletedDateTime = (msg as Record<string, unknown>).deletedDateTime
    const oldContent = msg.body?.content ?? ''
    if (msg.body) msg.body.content = ''
    ;(msg as Record<string, unknown>).deletedDateTime = new Date().toISOString()

    $orpc.chats.deleteMessage({ chatId, messageId }).catch((err: unknown) => {
      const target = messages.value.find(m => m.id === messageId)
      if (target) {
        if (target.body) target.body.content = oldContent
        ;(target as Record<string, unknown>).deletedDateTime = oldDeletedDateTime
      }
      toast.add({ title: 'Failed to delete message', description: getErrorMessage(err, 'Failed to delete'), color: 'error' })
    })
  }

  function onPin(messageId: string) {
    const c = chat()
    if (!c) return
    const chatId = c.id!

    pinnedMessageIds.value = [...pinnedMessageIds.value, messageId]

    $orpc.chats.pinMessage({ chatId, messageId }).catch((err: unknown) => {
      pinnedMessageIds.value = pinnedMessageIds.value.filter(id => id !== messageId)
      toast.add({ title: 'Failed to pin message', description: getErrorMessage(err, 'Failed to pin'), color: 'error' })
    })
  }

  function onUnpin(messageId: string) {
    const c = chat()
    if (!c) return
    const chatId = c.id!

    pinnedMessageIds.value = pinnedMessageIds.value.filter(id => id !== messageId)

    $orpc.chats.unpinMessage({ chatId, messageId }).catch((err: unknown) => {
      pinnedMessageIds.value = [...pinnedMessageIds.value, messageId]
      toast.add({ title: 'Failed to unpin message', description: getErrorMessage(err, 'Failed to unpin'), color: 'error' })
    })
  }

  return {
    replyingTo, editingMessageId, pinnedMessageIds,
    handleSubmit, retryMessage, handleReaction,
    onReply, clearReply, onEdit, onSaveEdit, onCancelEdit,
    onDelete, onPin, onUnpin,
  }
}
