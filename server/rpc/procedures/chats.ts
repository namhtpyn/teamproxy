import { z } from 'zod'
import { ORPCError, eventIterator, getEventMeta, withEventMeta } from '@orpc/server'
import { consola } from 'consola'
import { authed } from '../middleware/auth'
import { createGraphClient, graphRequest } from '../../ms-graph/graph-client'
import type { Chat as GraphChat, ChatMessage } from '@microsoft/microsoft-graph-types'
import { getEventPublisher, messageEventSchema, visibilityEventSchema, respondEventSchema, disconnectEventSchema } from '../../utils/event-bus'
import { getAllowedChats, getAllowedChat } from '../../utils/allowed-chats'
import { prefetchMessageImages } from '../../utils/image-cache'
import { getCachedMsUser, setCachedMsUser } from '../../utils/ms-user-cache'

function requireReadAccess(chatId: string) {
  const chatAccess = getAllowedChat(chatId)
  if (!chatAccess?.allowed) {
    throw new ORPCError('FORBIDDEN', { message: 'Not allowed to access this chat' })
  }
  return chatAccess
}

function requireWriteAccess(chatId: string) {
  const chatAccess = getAllowedChat(chatId)
  if (!chatAccess?.allowed || !chatAccess.canRespond) {
    throw new ORPCError('FORBIDDEN', { message: 'Not allowed to modify this chat' })
  }
  return chatAccess
}

function createLiveHandler(schema: z.ZodTypeAny, type: string, label: string) {
  return authed.output(eventIterator(schema)).handler(async function* ({ signal, lastEventId }) {
    const publisher = getEventPublisher()
    try {
      for await (const payload of publisher.subscribe('chat:*', { signal, lastEventId })) {
        if (payload.type !== type) continue
        const meta = getEventMeta(payload)
        yield meta ? withEventMeta(payload, meta) : payload
      }
    } finally {
      consola.info(`[${label}] SSE stream closed`)
    }
  })
}

export const chatsRouter = {
  getMe: authed.handler(async ({ context: { accessToken } }) => {
    const client = createGraphClient({ accessToken })
    const me = await client.getMe()
    setCachedMsUser({ id: me.id, displayName: me.displayName })
    return { id: me.id, displayName: me.displayName }
  }),

  list: authed.handler(async ({ context: { accessToken } }) => {
    const allowed = getAllowedChats()
    if (allowed.length === 0) return { chats: [] }

    const allowedMap = new Map(allowed.map((r) => [r.chatId, r]))
    const client = createGraphClient({ accessToken })

    const BATCH_SIZE = 20
    const chatIds = allowed.map((r) => r.chatId)
    const chunks: string[][] = []
    for (let i = 0; i < chatIds.length; i += BATCH_SIZE) {
      chunks.push(chatIds.slice(i, i + BATCH_SIZE))
    }

    const batchResults = await Promise.all(
      chunks.map((chunk) => {
        const requests = chunk.map((id, i) => ({
          id: String(i),
          method: 'GET',
          url: `/chats/${id}?$select=id,topic,chatType,lastUpdatedDateTime,createdDateTime,members,lastMessagePreview&$expand=members,lastMessagePreview`,
        }))
        return client.batch(requests)
      }),
    )

    const chats = batchResults
      .flat()
      .filter((r) => r.status === 200 && r.body)
      .map((r) => r.body as GraphChat)

    return {
      chats: chats.map((chat) => ({
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
        nextLink: z.string().url().optional(),
      }),
    )
    .handler(async ({ input, context: { accessToken } }) => {
      requireReadAccess(input.chatId)

      const client = createGraphClient({ accessToken })
      let messages: ChatMessage[]
      let nextLink: string | undefined

      if (input.nextLink) {
        const path = input.nextLink.replace('https://graph.microsoft.com/v1.0', '')
        const data = await graphRequest<{ value: ChatMessage[]; '@odata.nextLink'?: string }>({
          method: 'GET',
          path,
          accessToken,
        })
        messages = data?.value ?? []
        nextLink = data?.['@odata.nextLink']
      } else {
        const query = {
          $top: input.top,
          $orderby: 'createdDateTime desc',
        }
        const result = await client.chats.messages(input.chatId, query)
        messages = result.value
        nextLink = result.nextLink
      }

      for (const msg of messages) {
        prefetchMessageImages(msg.body?.content ?? undefined, accessToken)
      }
      return {
        messages,
        nextCursor: nextLink ?? undefined,
      }
    }),

  sendMessage: authed
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
        hostedContents: z
          .array(
            z.object({
              temporaryId: z.string(),
              contentBytes: z.string().max(5_000_000, 'Image too large (max 3.75MB)'),
              contentType: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .handler(async ({ input, context: { accessToken } }) => {
      requireWriteAccess(input.chatId)

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

      const hasMentions = !!mentions?.length
      const hasHostedContents = !!input.hostedContents?.length
      const content = hasMentions
        ? mentions.reduce(
            (c, m) => c.replace(`@${m.mentionText}`, `<at id="${m.id}">${m.mentionText}</at>`),
            input.content,
          )
        : input.content
      const contentType = 'html'

      const hostedContents = hasHostedContents ? input.hostedContents : undefined

      const response = input.replyToId && !hasHostedContents && !hasMentions
        ? await client.chats.replyWithQuote(input.chatId, input.replyToId, { contentType, content })
        : await client.chats.send(input.chatId, { contentType, content }, undefined, mentions, hostedContents)

      if (!response) throw new ORPCError('INTERNAL', { message: 'Failed to send message' })
      return { message: response }
    }),

  deleteMessage: authed
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.string(),
      }),
    )
    .handler(async ({ input, context: { accessToken } }) => {
      requireWriteAccess(input.chatId)
      const client = createGraphClient({ accessToken })
      let me = getCachedMsUser()
      if (!me) {
        const graphMe = await client.getMe()
        me = { id: graphMe.id, displayName: graphMe.displayName }
        setCachedMsUser(me)
      }
      await client.chats.softDeleteMessage(me.id, input.chatId, input.messageId)
    }),

  editMessage: authed
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.string(),
        content: z.string().max(4000),
      }),
    )
    .handler(async ({ input, context: { accessToken } }) => {
      requireWriteAccess(input.chatId)
      const client = createGraphClient({ accessToken })
      await client.chats.updateMessage(input.chatId, input.messageId, {
        contentType: 'html',
        content: input.content,
      })
    }),

  setReaction: authed
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.string(),
        reactionType: z.string(),
      }),
    )
    .handler(async ({ input, context: { accessToken } }) => {
      requireReadAccess(input.chatId)
      const client = createGraphClient({ accessToken })
      await client.chats.setReaction(input.chatId, input.messageId, input.reactionType)
    }),

  unsetReaction: authed
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.string(),
        reactionType: z.string(),
      }),
    )
    .handler(async ({ input, context: { accessToken } }) => {
      requireReadAccess(input.chatId)
      const client = createGraphClient({ accessToken })
      await client.chats.unsetReaction(input.chatId, input.messageId, input.reactionType)
    }),

  pinMessage: authed
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.string(),
      }),
    )
    .handler(async ({ input, context: { accessToken } }) => {
      requireWriteAccess(input.chatId)
      const client = createGraphClient({ accessToken })
      await client.chats.pinMessage(input.chatId, input.messageId)
    }),

  unpinMessage: authed
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.string(),
      }),
    )
    .handler(async ({ input, context: { accessToken } }) => {
      requireWriteAccess(input.chatId)
      const client = createGraphClient({ accessToken })
      await client.chats.unpinMessage(input.chatId, input.messageId)
    }),

  liveMessages: authed.output(eventIterator(messageEventSchema)).handler(async function* ({
    context,
    signal,
    lastEventId,
  }) {
    const publisher = getEventPublisher()

    const allowedChatIds = context.role !== 'admin'
      ? new Set(getAllowedChats().map((r) => r.chatId))
      : null

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

  liveVisibility: createLiveHandler(visibilityEventSchema, 'visibility', 'liveVisibility'),

  liveRespond: createLiveHandler(respondEventSchema, 'respond', 'liveRespond'),

  liveDisconnect: createLiveHandler(disconnectEventSchema, 'disconnect', 'liveDisconnect'),
}
