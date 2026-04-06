import { z } from 'zod'
import { ORPCError, eventIterator, getEventMeta, withEventMeta } from '@orpc/server'
import { consola } from 'consola'
import { authed } from '../middleware/auth'
import { rateLimited } from '../middleware/rate-limit'
import { createGraphClient } from '../../ms-graph/graph-client'
import { graphRequest, graphPaginate } from '../../ms-graph/client'
import type { Chat, ChatMessage } from '../../ms-graph/types'
import { getEventPublisher, liveEventSchema } from '../../utils/event-bus'
import { getAllowedChats, getAllowedChat } from '../../utils/allowed-chats'

function mapChat(chat: Chat) {
  const members = chat.members ?? []
  const preview = chat.lastMessagePreview
  const viewpoint = chat.viewpoint

  return {
    id: chat.id!,
    chatType: chat.chatType ?? 'unknownFutureValue' as string,
    topic: chat.topic ?? null,
    webUrl: chat.webUrl ?? null,
    createdDateTime: chat.createdDateTime ?? new Date().toISOString(),
    lastUpdatedDateTime: chat.lastUpdatedDateTime ?? new Date().toISOString(),
    isHidden: viewpoint?.isHidden ?? false,
    lastMessageReadDateTime: viewpoint?.lastMessageReadDateTime ?? null,
    members: members.map((m) => ({
      id: m.id!,
      displayName: m.displayName ?? 'Unknown',
      userId: null,
      email: null,
    })),
    lastMessagePreview: preview
      ? {
          id: preview.id!,
          createdDateTime: preview.createdDateTime ?? new Date().toISOString(),
          messageType: preview.messageType ?? 'message',
          contentType: preview.body?.contentType ?? 'text',
          content: preview.body?.content ?? '',
          senderDisplayName: preview.from?.user?.displayName ?? null,
        }
      : null,
  }
}

function mapMessage(msg: ChatMessage) {
  if (msg.eventDetail) {
    consola.info(`[eventDetail] type=${(msg.eventDetail as Record<string, unknown>)['@odata.type'] ?? 'unknown'}`, JSON.stringify(msg.eventDetail))
  }
  return {
    id: msg.id!,
    replyToId: msg.replyToId ?? null,
    messageType: msg.messageType ?? 'message',
    contentType: msg.body?.contentType ?? 'text',
    content: msg.body?.content ?? '',
    createdDateTime: msg.createdDateTime ?? new Date().toISOString(),
    sender: msg.from?.user
      ? {
          id: msg.from.user.id ?? '',
          displayName: msg.from.user.displayName ?? 'Unknown',
        }
      : null,
    eventDetail: msg.eventDetail as Record<string, unknown> | null,
  }
}

export const chatsRouter = {
  getMe: authed.handler(async ({ context: { accessToken } }) => {
    const me = await graphRequest<{ id: string; displayName: string }>({
      method: 'GET',
      path: '/me',
      query: { $select: 'id,displayName' },
      accessToken,
    })
    if (!me) {
      throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Failed to fetch user profile' })
    }
    return { id: me.id, displayName: me.displayName }
  }),

  list: authed.handler(async ({ context: { accessToken } }) => {
    const allowed = getAllowedChats()
    if (allowed.length === 0) return { chats: [] }

    const allowedMap = new Map(allowed.map((r) => [r.chatId, r]))
    const filter = allowed.map((r) => `'${r.chatId}'`).join(',')
    const results: Chat[] = []
    for await (const batch of graphPaginate<Chat>({
      method: 'GET',
      path: '/me/chats',
      query: {
        $expand: 'members,lastMessagePreview',
        $orderby: 'lastMessagePreview/createdDateTime desc',
        $filter: `id in (${filter})`,
        $top: '50',
      },
      accessToken,
    })) {
      results.push(...batch)
    }

    return {
      chats: results.map((chat) => ({
        ...mapChat(chat),
        canRespond: allowedMap.get(chat.id!)?.canRespond ?? false,
      })),
    }
  }),

  getMessages: authed
    .input(
      z.object({
        chatId: z.string(),
        top: z.number().min(1).max(50).default(20),
        before: z.string().datetime({ offset: true }).optional(),
      }),
    )
    .handler(async ({ input, context: { accessToken } }) => {
      const client = createGraphClient({ accessToken })
      const query: Record<string, string> = {
        $top: String(input.top),
        $orderby: 'createdDateTime desc',
      }
      if (input.before) {
        query.$filter = `createdDateTime lt ${input.before}`
      }
      const results: ChatMessage[] = []
      for await (const batch of client.chats.messages(input.chatId, query)) {
        results.push(...batch)
        if (results.length >= input.top) break
      }
      return { messages: results.slice(0, input.top).map(mapMessage), hasMore: results.length >= input.top }
    }),

  sendMessage: authed.use(rateLimited)
    .input(
      z.object({
        chatId: z.string(),
        content: z.string().max(4000),
        replyToId: z.string().optional(),
        mentions: z.array(z.object({
          userId: z.string(),
          displayName: z.string(),
        })).optional(),
        image: z.object({
          contentBytes: z.string().max(5_000_000, 'Image too large (max 3.75MB)'),
          contentType: z.enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
        }).optional(),
      }),
    )
    .handler(async ({ input, context: { accessToken } }) => {
      const chatAccess = getAllowedChat(input.chatId)
      if (!chatAccess || !chatAccess.allowed || !chatAccess.canRespond) {
        throw new ORPCError('FORBIDDEN', { message: 'Not allowed to send messages to this chat' })
      }

      const client = createGraphClient({ accessToken })

      const mentions = input.mentions?.length
        ? input.mentions.map((m, i) => ({
            id: i,
            mentionText: m.displayName,
            mentioned: {
              user: {
                id: m.userId,
                displayName: m.displayName,
              },
            },
          }))
        : undefined

      let content = input.content
      let contentType: string = 'text'
      const hasMentions = mentions && mentions.length > 0
      const hasImage = !!input.image

      if (hasMentions || hasImage) {
        contentType = 'html'
        if (hasMentions) {
          for (const mention of mentions) {
            content = content.replace(`@${mention.mentionText}`, `<at id="${mention.id}">${mention.mentionText}</at>`)
          }
        }
        if (hasImage) {
          content = `<img src="../hostedContents/1/$value" width="400">` + (content ? `<p>${content}</p>` : '')
        }
      }

      const hostedContents = hasImage
        ? [{ temporaryId: '1', contentBytes: input.image!.contentBytes, contentType: input.image!.contentType }]
        : undefined

      const response = await client.chats.send(input.chatId, { contentType, content }, input.replyToId, mentions, hostedContents)

      return { message: mapMessage(response as ChatMessage) }
    }),

  liveAllMessages: authed
    .output(eventIterator(liveEventSchema))
    .handler(async function* ({ context, signal, lastEventId }) {
      const publisher = getEventPublisher()

      let allowedChatIds: Set<string> | null = null
      if (context.role !== 'admin') {
      const allowed = getAllowedChats()
        allowedChatIds = new Set(allowed.map((r) => r.chatId))
      }

      try {
        for await (const payload of publisher.subscribe('chat:*', { signal, lastEventId })) {
          if (payload.type === 'visibility' || payload.type === 'respond') {
            const meta = getEventMeta(payload)
            yield meta ? withEventMeta(payload, meta) : payload
            if (payload.type === 'visibility' && allowedChatIds && payload.chatId) {
              const data = payload.data as { allowed?: boolean }
              if (data?.allowed) allowedChatIds.add(payload.chatId)
              else allowedChatIds.delete(payload.chatId)
            }
            continue
          }

          if (allowedChatIds && payload.chatId && !allowedChatIds.has(payload.chatId)) continue
          const msgMeta = getEventMeta(payload)
          yield msgMeta ? withEventMeta(payload, msgMeta) : payload
        }
      } finally {
        consola.info('[liveAllMessages] SSE stream closed')
      }
    }),
}
