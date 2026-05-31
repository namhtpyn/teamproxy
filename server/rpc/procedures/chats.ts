import { z } from 'zod'
import { ORPCError, eventIterator, getEventMeta, withEventMeta } from '@orpc/server'
import { consola } from 'consola'
import { authed } from '../middleware/auth'
import { rateLimited } from '../middleware/rate-limit'
import { createGraphClient, type ODataQueryParams } from '../../ms-graph/graph-client'
import type { ChatMessage } from '../../ms-graph/types'
import { getEventPublisher, messageEventSchema, visibilityEventSchema, respondEventSchema, disconnectEventSchema } from '../../utils/event-bus'
import { getAllowedChats, getAllowedChat } from '../../utils/allowed-chats'

export const chatsRouter = {
  getMe: authed.handler(async ({ context: { accessToken } }) => {
    const client = createGraphClient({ accessToken })
    const me = await client.getMe()
    return { id: me.id, displayName: me.displayName }
  }),

  list: authed.handler(async ({ context: { accessToken } }) => {
    const allowed = getAllowedChats()
    if (allowed.length === 0) return { chats: [] }

    const allowedMap = new Map(allowed.map((r) => [r.chatId, r]))
    const filter = allowed.map((r) => `'${r.chatId}'`).join(',')
    const client = createGraphClient({ accessToken })
    const results = await client.chats.list({
      $expand: 'members,lastMessagePreview',
      $orderby: 'lastMessagePreview/createdDateTime desc',
      $filter: `id in (${filter})`,
    })

    return {
      chats: results.map((chat) => ({
        ...chat,
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
      const query: ODataQueryParams = {
        $top: input.top + 1,
        $orderby: 'createdDateTime desc',
      }
      if (input.before) {
        query.$filter = `createdDateTime lt ${input.before}`
      }
      const results = await client.chats.messages(input.chatId, query)
      return {
        messages: results.slice(0, input.top),
        hasMore: results.length >= input.top,
      }
    }),

  sendMessage: authed
    .use(rateLimited)
    .input(
      z.object({
        chatId: z.string(),
        content: z.string().max(4000),
        replyToId: z.string().optional(),
        mentions: z
          .array(
            z.object({
              userId: z.string(),
              displayName: z.string(),
            }),
          )
          .optional(),
        image: z
          .object({
            contentBytes: z.string().max(5_000_000, 'Image too large (max 3.75MB)'),
            contentType: z.enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
          })
          .optional(),
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
            content = content.replace(
              `@${mention.mentionText}`,
              `<at id="${mention.id}">${mention.mentionText}</at>`,
            )
          }
        }
        if (hasImage) {
          content =
            `<img src="../hostedContents/1/$value" width="400">` +
            (content ? `<p>${content}</p>` : '')
        }
      }

      const hostedContents = hasImage
        ? [
            {
              temporaryId: '1',
              contentBytes: input.image!.contentBytes,
              contentType: input.image!.contentType,
            },
          ]
        : undefined

      let response: ChatMessage | undefined

      if (input.replyToId && !hasImage && !hasMentions) {
        response = await client.chats.replyWithQuote(input.chatId, input.replyToId, { contentType, content })
      } else {
        response = await client.chats.send(
          input.chatId,
          { contentType, content },
          undefined,
          mentions,
          hostedContents,
        )
      }

      return { message: response as ChatMessage }
    }),

  deleteMessage: authed
    .use(rateLimited)
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.string(),
      }),
    )
    .handler(async ({ input, context: { accessToken } }) => {
      const chatAccess = getAllowedChat(input.chatId)
      if (!chatAccess || !chatAccess.allowed || !chatAccess.canRespond) {
        throw new ORPCError('FORBIDDEN', { message: 'Not allowed to delete messages in this chat' })
      }
      const client = createGraphClient({ accessToken })
      await client.chats.deleteMessage(input.chatId, input.messageId)
    }),

  setReaction: authed
    .use(rateLimited)
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.string(),
        reactionType: z.string(),
      }),
    )
    .handler(async ({ input, context: { accessToken } }) => {
      const chatAccess = getAllowedChat(input.chatId)
      if (!chatAccess || !chatAccess.allowed) {
        throw new ORPCError('FORBIDDEN', { message: 'Not allowed to react in this chat' })
      }
      const client = createGraphClient({ accessToken })
      await client.chats.setReaction(input.chatId, input.messageId, input.reactionType)
    }),

  unsetReaction: authed
    .use(rateLimited)
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.string(),
        reactionType: z.string(),
      }),
    )
    .handler(async ({ input, context: { accessToken } }) => {
      const chatAccess = getAllowedChat(input.chatId)
      if (!chatAccess || !chatAccess.allowed) {
        throw new ORPCError('FORBIDDEN', { message: 'Not allowed to react in this chat' })
      }
      const client = createGraphClient({ accessToken })
      await client.chats.unsetReaction(input.chatId, input.messageId, input.reactionType)
    }),

  liveMessages: authed.output(eventIterator(messageEventSchema)).handler(async function* ({
    context,
    signal,
    lastEventId,
  }) {
    const publisher = getEventPublisher()

    let allowedChatIds: Set<string> | null = null
    if (context.role !== 'admin') {
      const allowed = getAllowedChats()
      allowedChatIds = new Set(allowed.map((r) => r.chatId))
    }

    try {
      for await (const payload of publisher.subscribe('chat:*', { signal, lastEventId })) {
        if (payload.type !== 'message') continue
        if (allowedChatIds && payload.chatId && !allowedChatIds.has(payload.chatId)) continue
        const meta = getEventMeta(payload)
        yield meta ? withEventMeta(payload, meta) : payload
      }
    } finally {
      consola.info('[liveMessages] SSE stream closed')
    }
  }),

  liveVisibility: authed.output(eventIterator(visibilityEventSchema)).handler(async function* ({
    signal,
    lastEventId,
  }) {
    const publisher = getEventPublisher()
    try {
      for await (const payload of publisher.subscribe('chat:*', { signal, lastEventId })) {
        if (payload.type !== 'visibility') continue
        const meta = getEventMeta(payload)
        yield meta ? withEventMeta(payload, meta) : payload
      }
    } finally {
      consola.info('[liveVisibility] SSE stream closed')
    }
  }),

  liveRespond: authed.output(eventIterator(respondEventSchema)).handler(async function* ({
    signal,
    lastEventId,
  }) {
    const publisher = getEventPublisher()
    try {
      for await (const payload of publisher.subscribe('chat:*', { signal, lastEventId })) {
        if (payload.type !== 'respond') continue
        const meta = getEventMeta(payload)
        yield meta ? withEventMeta(payload, meta) : payload
      }
    } finally {
      consola.info('[liveRespond] SSE stream closed')
    }
  }),

  liveDisconnect: authed.output(eventIterator(disconnectEventSchema)).handler(async function* ({
    signal,
    lastEventId,
  }) {
    const publisher = getEventPublisher()
    try {
      for await (const payload of publisher.subscribe('chat:*', { signal, lastEventId })) {
        if (payload.type !== 'disconnect') continue
        const meta = getEventMeta(payload)
        yield meta ? withEventMeta(payload, meta) : payload
      }
    } finally {
      consola.info('[liveDisconnect] SSE stream closed')
    }
  }),
}
