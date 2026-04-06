import { z } from 'zod'
import { consola } from 'consola'
import { ORPCError } from '@orpc/server'
import { CHAT_TYPES, MS_SUBSCRIPTION_STATUSES } from '#shared/utils/enums'
import { adminAuthed } from '../middleware/auth'
import { graphRequest } from '../../ms-graph/client'
import { createGraphClient } from '../../ms-graph/graph-client'
import type { Chat, GraphPaginationResponse } from '../../ms-graph/types'
import { clearMsSubscription } from '../../utils/ms-subscription-store'
import { getMsSubscriptionStatus } from '../../utils/ms-subscription-status'
import { getEventPublisher } from '../../utils/event-bus'
import { createMsSubscription } from '../../utils/create-ms-subscription'
import { getAllowedChat } from '../../utils/allowed-chats'
import { db } from '../../db/client'
import { allowedChats } from '../../db/schema'
import { eq } from 'drizzle-orm'

export const chatVisibilityRouter = {
  getVisibility: adminAuthed
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    }))
    .handler(async ({ input, context: { accessToken } }) => {
      let page: GraphPaginationResponse<Chat>

      if (input.cursor) {
        const response = await fetch(input.cursor, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(30_000),
        })
        if (!response.ok) {
          throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Failed to fetch chats page' })
        }
        page = await response.json() as GraphPaginationResponse<Chat>
      } else {
        const result = await graphRequest<GraphPaginationResponse<Chat>>({
          method: 'GET',
          path: '/me/chats',
          query: { $expand: 'members', $top: String(input.limit) },
          accessToken,
        })
        if (!result) {
          throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Failed to fetch chats' })
        }
        page = result
      }

      const rows = db.query.allowedChats.findMany().sync()
      const rowMap = new Map(rows.map((r) => [r.chatId, r]))

      return {
        chats: page.value.map((c) => {
          const row = rowMap.get(c.id!)
          return {
            id: c.id!,
            topic: c.topic ?? '',
            chatType: c.chatType ?? 'unknownFutureValue' as string,
            allowed: row?.allowed ?? false,
            canRespond: row?.canRespond ?? false,
            members: (c.members ?? []).map((m) => m.displayName).filter((n): n is string => !!n),
            subscriptionStatus: getMsSubscriptionStatus(row),
          }
        }),
        nextCursor: page['@odata.nextLink'] ?? null,
      }
    }),

  setVisibility: adminAuthed
    .input(z.object({ chatId: z.string(), allowed: z.boolean(), canRespond: z.boolean(), topic: z.string(), chatType: z.enum(CHAT_TYPES) }))
    .handler(async ({ input, context: { accessToken } }) => {
      const existing = getAllowedChat(input.chatId)

      let subscriptionStatus: 'active' | 'expired' | 'none' = 'none'
      let subscriptionError: string | undefined

      if (existing) {
        db.update(allowedChats)
          .set({ allowed: input.allowed, canRespond: input.canRespond, topic: input.topic, chatType: input.chatType })
          .where(eq(allowedChats.chatId, input.chatId))
          .run()
        if (!input.allowed && existing.msSubscriptionId) {
          const client = createGraphClient({ accessToken })
          try {
            await client.subscriptions.delete(existing.msSubscriptionId)
          } catch (err) {
            consola.warn(`Failed to delete Graph subscription ${existing.msSubscriptionId} for chat ${input.chatId}:`, err)
          }
          clearMsSubscription(input.chatId)
          subscriptionStatus = 'none'
        } else if (input.allowed && getMsSubscriptionStatus(existing) !== 'active') {
          const result = await createMsSubscription(input.chatId, accessToken)
          subscriptionStatus = result.success ? 'active' : 'none'
          if (!result.success) subscriptionError = result.error
        } else {
          subscriptionStatus = getMsSubscriptionStatus(existing)
        }
      } else {
        db.insert(allowedChats).values({
          chatId: input.chatId,
          topic: input.topic,
          chatType: input.chatType,
          allowed: input.allowed,
          canRespond: input.canRespond,
        }).run()
        if (input.allowed) {
          const result = await createMsSubscription(input.chatId, accessToken)
          subscriptionStatus = result.success ? 'active' : 'none'
          if (!result.success) subscriptionError = result.error
        }
      }

      const publisher = getEventPublisher()
      publisher.publish('chat:*', { type: 'visibility' as const, chatId: input.chatId, data: { allowed: input.allowed } })

      return { success: true, subscriptionStatus, subscriptionError }
    }),

  setCanRespond: adminAuthed
    .input(z.object({ chatId: z.string(), canRespond: z.boolean() }))
    .handler(async ({ input }) => {
      const existing = getAllowedChat(input.chatId)

      if (!existing) {
        throw new ORPCError('NOT_FOUND', { message: 'Chat not found in allowed chats' })
      }

      db.update(allowedChats)
        .set({ canRespond: input.canRespond })
        .where(eq(allowedChats.chatId, input.chatId))
        .run()

      const publisher = getEventPublisher()
      publisher.publish('chat:*', { type: 'respond' as const, chatId: input.chatId, data: { canRespond: input.canRespond } })

      return { success: true }
    }),
}


