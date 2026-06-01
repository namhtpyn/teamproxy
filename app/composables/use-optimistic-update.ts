import type { ChatMessage } from '@microsoft/microsoft-graph-types'
import type { Ref } from 'vue'
import type { OptimisticChatMessage } from '~/types/chat'
import { getErrorMessage } from '~/utils/error'

type MessageItem = ChatMessage | OptimisticChatMessage

export function optimisticSend(opts: {
  messages: Ref<MessageItem[]>
  pendingSends: Set<string>
  chatId: string
  staleGuard: () => string | undefined
  tempId: string
  prepareOptimistic: () => void
  sendCall: () => Promise<{ message: ChatMessage }>
}) {
  const toast = useToast()

  opts.pendingSends.add(opts.tempId)
  opts.prepareOptimistic()

  opts.sendCall().then(({ message: real }) => {
    if (opts.staleGuard() !== opts.chatId) return
    if (!opts.pendingSends.has(opts.tempId)) return
    opts.pendingSends.delete(opts.tempId)

    const idx = opts.messages.value.findIndex(m => m.id === opts.tempId)
    if (idx !== -1) {
      const updated = [...opts.messages.value]
      updated[idx] = real as ChatMessage
      opts.messages.value = updated
    }
  }).catch((err: unknown) => {
    if (opts.staleGuard() !== opts.chatId) return
    opts.pendingSends.delete(opts.tempId)
    const failedIdx = opts.messages.value.findIndex(m => m.id === opts.tempId)
    if (failedIdx !== -1) {
      opts.messages.value = opts.messages.value.map(m =>
        m.id === opts.tempId
          ? { ...m, sendFailed: getErrorMessage(err, 'Failed to send') } as OptimisticChatMessage
          : m,
      )
    }
    toast.add({ title: 'Failed to send message', description: getErrorMessage(err, 'Failed to send message'), color: 'error' })
  })
}
