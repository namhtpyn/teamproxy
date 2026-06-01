import type { InfiniteData } from '@tanstack/vue-query'
import type { ChatMessage } from '@microsoft/microsoft-graph-types'
import type { Chat, OptimisticChatMessage } from '~/types/chat'
import type { MessageListResponse } from '#shared/types'
import { useInfiniteQuery, useQueryClient } from '@tanstack/vue-query'

type MessageItem = ChatMessage | OptimisticChatMessage

export function useConversationMessages(
  chat: () => Chat | null,
  opts?: { msUserId?: () => string | null | undefined },
) {
  const { $orpcClient } = useNuxtApp()
  const queryClient = useQueryClient()
  const toast = useToast()

  const messages = ref<MessageItem[]>([])
  const messageListRef = ref<{ scrollToBottom: (force?: boolean) => void; isNearBottom: boolean } | null>(null)
  const pendingSends = new Set<string>()

  const queryKey = computed(() => ['messages', chat()?.id] as const)

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => {
      const c = chat()
      if (!c) return { messages: [] as ChatMessage[], nextCursor: undefined as string | undefined }
      return $orpcClient.chats.getMessages({
        chatId: c.id!,
        nextLink: pageParam as string | undefined,
      })
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: MessageListResponse) => lastPage.nextCursor,
    enabled: computed(() => !!chat()?.id),
  })

  const messagesLoading = computed(() => query.isLoading.value)
  const messagesError = computed(() => {
    const err = query.error.value
    return err ? getErrorMessage(err, 'Failed to load messages') : null
  })
  const loadingMore = computed(() => query.isFetchingNextPage.value)
  const nextCursor = computed(() => {
    const pages = query.data.value?.pages
    if (!pages || pages.length === 0) return undefined
    return pages[pages.length - 1]!.nextCursor
  })

  const sortedMessages = computed(() =>
    [...messages.value].sort(
      (a, b) =>
        new Date(a.createdDateTime ?? '').getTime() -
        new Date(b.createdDateTime ?? '').getTime(),
    ),
  )

  const isNearBottom = computed(() => messageListRef.value?.isNearBottom ?? true)

  watch(
    () => query.data.value?.pages,
    (pages) => {
      if (!pages) return
      const serverMessages = pages.flatMap(p => p.messages)
      const optimisticMsgs = messages.value.filter(m =>
        m.id?.startsWith('temp:') || (m as OptimisticChatMessage).sendFailed,
      )
      messages.value = [...serverMessages, ...optimisticMsgs]
    },
    { deep: true },
  )

  watch(query.isLoading, (loading, wasLoading) => {
    if (wasLoading && !loading) {
      nextTick(() => messageListRef.value?.scrollToBottom(true))
    }
  })

  watch(
    () => query.error.value,
    (err, prevErr) => {
      if (err && err !== prevErr && query.data.value) {
        toast.add({
          title: 'Failed to load more messages',
          description: getErrorMessage(err, 'Failed to load more messages'),
          color: 'error',
        })
      }
    },
  )

  async function loadMessages() {
    pendingSends.clear()
    messages.value = []
    return queryClient.resetQueries({ queryKey: queryKey.value })
  }

  async function loadMore() {
    if (!query.hasNextPage.value || query.isFetchingNextPage.value) return
    try {
      await query.fetchNextPage()
    }
    catch {
    }
  }

  async function refreshMessages() {
    const c = chat()
    if (!c) return
    try {
      const result = await $orpcClient.chats.getMessages({ chatId: c.id! })
      queryClient.setQueryData(queryKey.value, {
        pages: [result],
        pageParams: [undefined as string | undefined],
      } satisfies InfiniteData<MessageListResponse>)
    }
    catch (err: unknown) {
      toast.add({
        title: 'Failed to refresh messages',
        description: err instanceof Error ? err.message : undefined,
        color: 'error',
      })
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

        queryClient.setQueryData(queryKey.value, (old: InfiniteData<MessageListResponse> | undefined) => {
          if (!old || old.pages.length === 0) return old
          return {
            ...old,
            pages: old.pages.map((page, i) => {
              if (i > 0) return page
              if (page.messages.some(m => m.id === msg.id)) return page
              return { ...page, messages: [...page.messages, msg] }
            }),
          }
        })
        return
      }
    }

    if (messages.value.some(m => m.id === msg.id)) return

    messages.value = [...messages.value, msg]

    queryClient.setQueryData(queryKey.value, (old: InfiniteData<MessageListResponse> | undefined) => {
      if (!old || old.pages.length === 0) return old
      const firstPage = old.pages[0]!
      if (firstPage.messages.some(m => m.id === msg.id)) return old
      return {
        ...old,
        pages: [{ ...firstPage, messages: [...firstPage.messages, msg] }, ...old.pages.slice(1)],
        pageParams: old.pageParams,
      }
    })
  }

  watch(
    () => chat()?.id,
    (newId, oldId) => {
      pendingSends.clear()
      if (newId && newId !== oldId) {
        messages.value = []
      }
    },
  )

  return {
    messages, messagesLoading, messagesError, nextCursor, loadingMore,
    messageListRef, sortedMessages, isNearBottom, pendingSends,
    loadMessages, loadMore, refreshMessages, appendIncomingMessage,
  }
}
