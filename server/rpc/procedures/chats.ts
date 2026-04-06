import { z } from 'zod'
import { ORPCError, eventIterator } from '@orpc/server'
import { CHAT_TYPES, MESSAGE_TYPES, MESSAGE_CONTENT_TYPES } from '#shared/utils/enums'
import { authed } from '../middleware/auth'
import { rateLimited } from '../middleware/rate-limit'
import { createGraphClient } from '../../ms-graph/graph-client'
import { graphRequest } from '../../ms-graph/client'
import type { GraphChat, GraphChatMessage } from '../../ms-graph/types'
import { getEventPublisher, liveEventSchema } from '../../utils/event-bus'
import { getAllowedChats, getAllowedChat } from '../../utils/allowed-chats'

const chatMemberSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  userId: z.string(),
  email: z.string().nullable(),
})

const previewSchema = z.object({
  id: z.string(),
  createdDateTime: z.string(),
  messageType: z.enum(MESSAGE_TYPES),
  contentType: z.enum(MESSAGE_CONTENT_TYPES),
  content: z.string(),
  senderDisplayName: z.string().nullable(),
})

const chatSchema = z.object({
  id: z.string(),
  chatType: z.enum(CHAT_TYPES),
  topic: z.string().nullable(),
  webUrl: z.string().nullable(),
  createdDateTime: z.string(),
  lastUpdatedDateTime: z.string(),
  isHidden: z.boolean(),
  lastMessageReadDateTime: z.string().nullable(),
  canRespond: z.boolean(),
  members: z.array(chatMemberSchema),
  lastMessagePreview: previewSchema.nullable(),
})

const messageSchema = z.object({
  id: z.string(),
  replyToId: z.string().nullable(),
  messageType: z.enum(MESSAGE_TYPES),
  contentType: z.enum(MESSAGE_CONTENT_TYPES),
  content: z.string(),
  createdDateTime: z.string(),
  sender: z.object({ id: z.string(), displayName: z.string() }).nullable(),
})

function mapChat(chat: GraphChat) {
  const members = chat.members ?? []
  const preview = chat.lastMessagePreview
  const viewpoint = chat.viewpoint

  return {
    id: chat.id,
    chatType: chat.chatType,
    topic: chat.topic ?? null,
    webUrl: chat.webUrl ?? null,
    createdDateTime: chat.createdDateTime,
    lastUpdatedDateTime: chat.lastUpdatedDateTime,
    isHidden: viewpoint?.isHidden ?? false,
    lastMessageReadDateTime: viewpoint?.lastMessageReadDateTime ?? null,
    members: members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      userId: m.userId,
      email: m.email ?? null,
    })),
    lastMessagePreview: preview
      ? {
          id: preview.id,
          createdDateTime: preview.createdDateTime,
          messageType: preview.messageType,
          contentType: preview.body?.contentType ?? 'text',
          content: preview.body?.content ?? '',
          senderDisplayName: preview.from?.user?.displayName ?? null,
        }
      : null,
  }
}

function mapMessage(msg: GraphChatMessage) {
  return {
    id: msg.id,
    replyToId: msg.replyToId ?? null,
    messageType: msg.messageType ?? 'message',
    contentType: msg.body?.contentType ?? 'text',
    content: msg.body?.content ?? '',
    createdDateTime: msg.createdDateTime,
    sender: msg.from?.user
      ? {
          id: msg.from.user.id,
          displayName: msg.from.user.displayName,
        }
      : null,
  }
}

export const chatsRouter = {
  getMe: authed
    .output(z.object({ id: z.string(), displayName: z.string() }))
    .handler(async ({ context: { accessToken } }) => {
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

  list: authed
    .output(z.object({ chats: z.array(chatSchema) }))
    .handler(async ({ context: { accessToken } }) => {
      const client = createGraphClient({ accessToken })
      const results: GraphChat[] = []
      for await (const batch of client.chats.list({
        $expand: 'members,lastMessagePreview',
        $orderby: 'lastMessagePreview/createdDateTime desc',
        $top: '50',
      })) {
        results.push(...batch)
      }

        const allowed = getAllowedChats()
      const allowedMap = new Map(allowed.map((r) => [r.chatId, r]))

      return {
        chats: results
          .map((chat) => {
            const row = allowedMap.get(chat.id)
            if (!row) return null
            return { ...mapChat(chat), canRespond: row.canRespond }
          })
          .filter((c): c is NonNullable<typeof c> => c !== null),
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
    .output(z.object({ messages: z.array(messageSchema), hasMore: z.boolean() }))
    .handler(async ({ input, context: { accessToken } }) => {
      const client = createGraphClient({ accessToken })
      const query: Record<string, string> = {
        $top: String(input.top),
        $orderby: 'createdDateTime desc',
      }
      if (input.before) {
        query.$filter = `createdDateTime lt ${input.before}`
      }
      const results: GraphChatMessage[] = []
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
    .output(z.object({ message: messageSchema }))
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

      return { message: mapMessage(response as GraphChatMessage) }
    }),

  liveAllMessages: authed
    .output(eventIterator(liveEventSchema))
    .handler(async function* ({ context, signal, lastEventId }) {
      const publisher = getEventPublisher()

      // For non-admin users, only expose messages from allowed chats
      let allowedChatIds: Set<string> | null = null
      if (context.role !== 'admin') {
      const allowed = getAllowedChats()
        allowedChatIds = new Set(allowed.map((r) => r.chatId))
      }

      for await (const payload of publisher.subscribe('chat:*', { signal, lastEventId })) {
        // Always let visibility and respond events through — clients need them to update UI
        if (payload.type === 'visibility' || payload.type === 'respond') {
          yield payload
          // Keep allowedChatIds in sync so subsequent message events reflect the change
          if (payload.type === 'visibility' && allowedChatIds && payload.chatId) {
            const data = payload.data as { allowed?: boolean }
            if (data?.allowed) allowedChatIds.add(payload.chatId)
            else allowedChatIds.delete(payload.chatId)
          }
          continue
        }

        if (allowedChatIds && payload.chatId && !allowedChatIds.has(payload.chatId)) continue
        yield payload
      }
    }),
}
