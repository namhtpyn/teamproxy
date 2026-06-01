import { z } from 'zod'
import { consola } from 'consola'
import { ORPCError } from '@orpc/server'
import { CHAT_TYPES } from '#shared/utils/enums'
import type { SubscriptionStatus } from '#shared/utils/enums'
import { adminAuthed } from '../middleware/auth'
import { graphRequest } from '../../ms-graph/graph-client'
import type { createGraphClient, ODataQueryParams } from '../../ms-graph/graph-client'
import type { Chat } from '@microsoft/microsoft-graph-types'
import { clearMsSubscription } from '../../utils/subscriptions/ms-subscription-store'
import { getMsSubscriptionStatus } from '../../utils/subscriptions/ms-subscription-status'
import { getEventPublisher } from '../../utils/event-bus'
import { createMsSubscription } from '../../utils/subscriptions/create-ms-subscription'
import { getAllowedChat, invalidateAllowedChatsCache } from '../../utils/allowed-chats'
import { db } from '../../db/client'
import { allowedChats } from '../../db/schema'
import { eq } from 'drizzle-orm'

type GraphClient = ReturnType<typeof createGraphClient>

async function fetchAllPages<T>(
  client: GraphClient,
  params: ODataQueryParams,
  accessToken: string,
): Promise<T[]> {
  const all: T[] = []
  let page = await client.chats.list(params)
  all.push(...(page.value as T[]))

  while (page.nextLink) {
    const next = await graphRequest<{ value: T[]; '@odata.nextLink'?: string }>({
      method: 'GET',
      rawUrl: page.nextLink,
      accessToken,
    })
    all.push(...(next?.value ?? []))
    page = { value: [], nextLink: next?.['@odata.nextLink'] }
  }
  return all
}

async function createSubscriptionOrFail(chatId: string, accessToken: string) {
  const result = await createMsSubscription(chatId, accessToken)
  return {
    subscriptionStatus: result.success ? 'active' as const : 'none' as const,
    subscriptionError: result.success ? undefined : result.error,
  }
}

function enrichChatsWithVisibility(chats: Chat[]) {
  const sorted = chats
    .filter(c => c.lastUpdatedDateTime)
    .sort((a, b) => new Date(b.lastUpdatedDateTime!).getTime() - new Date(a.lastUpdatedDateTime!).getTime())

  const rows = db.query.allowedChats.findMany().sync()
  const rowMap = new Map(rows.map(r => [r.chatId, r]))

  return {
    chats: sorted.map(c => {
      const row = rowMap.get(c.id!)
      return {
        ...c,
        allowed: row?.allowed ?? false,
        canRespond: row?.canRespond ?? false,
        subscriptionStatus: getMsSubscriptionStatus(row),
      }
    }),
  }
}

export const chatVisibilityRouter = {
  getVisibility: adminAuthed
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
        search: z.string().optional(),
      }),
    )
    .handler(async ({ input, context: { accessToken, graphClient } }) => {
      const client = graphClient!
      const limit = input.limit
      const searchTerm = input.search?.trim()

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const escapedSearch = searchLower.replace(/'/g, "''")

        const filters: string[] = [`contains(tolower(topic), '${escapedSearch}')`]

        const typeLabels: Array<{ keywords: string[]; chatType: string }> = [
          { keywords: ['group'], chatType: 'group' },
          { keywords: ['meeting'], chatType: 'meeting' },
          { keywords: ['one-to-one', 'one to one', 'one'], chatType: 'oneOnOne' },
        ]
        for (const { keywords, chatType } of typeLabels) {
          if (keywords.some((k) => k.includes(searchLower) || searchLower.includes(k))) {
            filters.push(`chatType eq '${chatType}'`)
            break
          }
        }

        const topicFilter = filters.join(' or ')

        const topicChats = await fetchAllPages<Chat>(client, {
          $filter: topicFilter,
          $select: 'id,topic,chatType,lastUpdatedDateTime,createdDateTime,members',
          $expand: 'members',
          $top: 50,
        }, accessToken)

        let oneOnOneChats: Chat[] = []
        if (!filters.some((f) => f.startsWith('chatType'))) {
          const allOneOnOne = await fetchAllPages<Chat>(client, {
            $filter: "chatType eq 'oneOnOne'",
            $select: 'id,topic,chatType,lastUpdatedDateTime,createdDateTime,members',
            $expand: 'members',
            $top: 50,
          }, accessToken)

          oneOnOneChats = allOneOnOne.filter((chat) => {
            const members = (chat.members as Array<{ displayName?: string }>) ?? []
            return members.some((m) =>
              m.displayName?.toLowerCase().includes(searchLower),
            )
          })
        }

        const seen = new Set<string>()
        const merged: Chat[] = []
        for (const chat of [...topicChats, ...oneOnOneChats]) {
          if (chat.id && !seen.has(chat.id)) {
            seen.add(chat.id)
            merged.push(chat)
          }
        }

        const enriched = enrichChatsWithVisibility(merged)
        return { chats: enriched.chats, nextCursor: undefined }
      }

      let value: Chat[]
      let nextLink: string | undefined

      if (input.cursor) {
        const page = await graphRequest<{ value: Chat[]; '@odata.nextLink'?: string }>({
          method: 'GET',
          rawUrl: input.cursor,
          accessToken,
        })
        value = page?.value ?? []
        nextLink = page?.['@odata.nextLink']
      } else {
        const query = {
          $select: 'id,topic,chatType,lastUpdatedDateTime,createdDateTime,members',
          $expand: 'members',
          $top: limit,
        }
        const page = await client.chats.list(query)
        value = page.value
        nextLink = page.nextLink
      }

      const enriched = enrichChatsWithVisibility(value)
      return { chats: enriched.chats, nextCursor: nextLink ?? undefined }
    }),

  setVisibility: adminAuthed
    .input(
      z.object({
        chatId: z.string(),
        allowed: z.boolean(),
        canRespond: z.boolean(),
        topic: z.string(),
        chatType: z.enum(CHAT_TYPES),
      }),
    )
    .handler(async ({ input, context: { accessToken, graphClient } }) => {
      const existing = getAllowedChat(input.chatId)

      let subscriptionStatus: SubscriptionStatus = 'none'
      let subscriptionError: string | undefined

      if (existing) {
        db.update(allowedChats)
          .set({
            allowed: input.allowed,
            canRespond: input.canRespond,
            topic: input.topic,
            chatType: input.chatType,
          })
          .where(eq(allowedChats.chatId, input.chatId))
          .run()
        invalidateAllowedChatsCache()
        if (!input.allowed && existing.msSubscriptionId) {
          const client = graphClient!
          try {
            await client.subscriptions.delete(existing.msSubscriptionId)
          } catch (err) {
            consola.warn(
              `Failed to delete Graph subscription ${existing.msSubscriptionId} for chat ${input.chatId}:`,
              err,
            )
          }
          clearMsSubscription(input.chatId)
          subscriptionStatus = 'none'
        } else if (input.allowed && getMsSubscriptionStatus(existing) !== 'active') {
          const sub = await createSubscriptionOrFail(input.chatId, accessToken)
          subscriptionStatus = sub.subscriptionStatus
          subscriptionError = sub.subscriptionError
        } else {
          subscriptionStatus = getMsSubscriptionStatus(existing)
        }
      } else {
        db.insert(allowedChats)
          .values({
            chatId: input.chatId,
            topic: input.topic,
            chatType: input.chatType,
            allowed: input.allowed,
            canRespond: input.canRespond,
          })
          .run()
        invalidateAllowedChatsCache()
        if (input.allowed) {
          const sub = await createSubscriptionOrFail(input.chatId, accessToken)
          subscriptionStatus = sub.subscriptionStatus
          subscriptionError = sub.subscriptionError
        }
      }

      const publisher = getEventPublisher()
      publisher.publish('chat:*', {
        type: 'visibility' as const,
        chatId: input.chatId,
        data: { allowed: input.allowed },
      })

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
      invalidateAllowedChatsCache()

      const publisher = getEventPublisher()
      publisher.publish('chat:*', {
        type: 'respond' as const,
        chatId: input.chatId,
        data: { canRespond: input.canRespond },
      })

      return { success: true }
    }),
}
