import { defineEventHandler, getQuery, readBody, setResponseStatus, getRequestIP } from 'h3'
import { consola } from 'consola'
import { db } from '../../db/client'
import { getActiveToken } from '../../db/get-active-token'
import { createGraphClient } from '../../ms-graph/graph-client'
import type { ChatMessage } from '../../ms-graph/types'
import { liveEventSchema, getEventPublisher } from '../../utils/event-bus'
import { prefetchMessageImages } from '../../utils/image-cache'
import { getMsSubscriptionsByClientStates, updateLastMessageAt } from '../../utils/ms-subscription-store'

// MS Graph resource format: OData chats('id')/messages('id') or REST /chats/id/messages/id
const CHAT_ID_REGEX = /(?:\/users\/[^/]+)?\/?chats\(?['"]?([^'")\s/]+)['"]?\)?\/messages/

function extractChatId(resource: string): string | null {
  const match = resource.match(CHAT_ID_REGEX)
  return match?.[1] ?? null
}

function resourceToPath(resource: string): string {
  const match = resource.match(/^chats\(?['"]?([^'")\s]+)['"]?\)?\/messages\(?['"]?([^'")\s]+)['"]?\)?$/)
  if (match) return `/chats/${match[1]}/messages/${match[2]}`
  if (resource.startsWith('/')) return resource
  try {
    const url = new URL(resource)
    return url.pathname.replace(/^\/v1\.0/, '')
  } catch {
    return resource
  }
}

export default defineEventHandler(async (event) => {
  const clientIp = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const query = getQuery(event)
  const validationToken = query.validationToken
  if (typeof validationToken === 'string' || (Array.isArray(validationToken) && validationToken.length > 0)) {
    const token = typeof validationToken === 'string' ? validationToken : validationToken[0]!
    setResponseStatus(event, 200)
    return token
  }

  if (event.method === 'POST') {
    consola.info(`[webhook] POST from ${clientIp}`)
    const body = await readBody(event)
    const rawNotifications = body?.value
    if (!Array.isArray(rawNotifications)) {
      setResponseStatus(event, 202)
      return { success: true }
    }

    const clientStates = rawNotifications
      .map((n) => n?.clientState)
      .filter((cs): cs is string => typeof cs === 'string')

    if (clientStates.length !== rawNotifications.length) {
      setResponseStatus(event, 403)
      return { error: 'Missing clientState in notification' }
    }

    const subMap = getMsSubscriptionsByClientStates(clientStates)

    for (const notification of rawNotifications) {
      if (typeof notification?.resource !== 'string' || typeof notification?.clientState !== 'string') {
        continue
      }
      const sub = subMap.get(notification.clientState)
      if (!sub || !sub.allowed) {
        setResponseStatus(event, 403)
        return { error: 'Unknown or disallowed subscription' }
      }
    }

    const token = getActiveToken(db)

    const publisher = getEventPublisher()

    // Collect valid notifications with extracted chatId for batch processing
    const validNotifications = rawNotifications
      .map((notification: Record<string, unknown>) => {
        if (typeof notification?.resource !== 'string' || typeof notification?.clientState !== 'string') return null
        if (!subMap.get(notification.clientState)) return null
        const chatId = extractChatId(notification.resource)
        if (!chatId) return null
        return { notification, chatId }
      })
      .filter((item: { notification: Record<string, unknown>; chatId: string } | null): item is { notification: Record<string, unknown>; chatId: string } => item !== null)

    if (token && validNotifications.length > 0) {
      const client = createGraphClient({ accessToken: token.accessToken })

      // Build batch requests (max 20 per batch)
      const BATCH_LIMIT = 20
      const chunks: Array<{ notification: Record<string, unknown>; chatId: string }[]> = []
      for (let i = 0; i < validNotifications.length; i += BATCH_LIMIT) {
        chunks.push(validNotifications.slice(i, i + BATCH_LIMIT))
      }

      const allBatchResults = await Promise.all(
        chunks.map((chunk) => {
          const requests = chunk.map((item, i) => ({
            id: String(i),
            method: 'GET',
            url: resourceToPath(item.notification.resource as string),
          }))
          return client.batch(requests)
        }),
      )

      // Process each result
      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunk = chunks[chunkIdx]!
        const batchResults = allBatchResults[chunkIdx]!

        for (let i = 0; i < chunk.length; i++) {
          const { notification, chatId } = chunk[i]!
          const result = batchResults.find((r) => r.id === String(i))

          if (!result || result.status !== 200 || !result.body) {
            consola.error(`[webhook] Failed to fetch message for ${notification.resource}: status=${result?.status ?? 'no result'}`)
            const errorPayload = { type: 'error' as const, data: { resource: notification.resource, fetchFailed: true }, chatId }
            const errorParsed = liveEventSchema.safeParse(errorPayload)
            if (errorParsed.success) publisher.publish('chat:*', errorParsed.data)
            continue
          }

          try {
            const message = result.body as ChatMessage

            if (message.eventDetail) {
              consola.info(
                `[eventDetail] type=${(message.eventDetail as Record<string, unknown>)['@odata.type'] ?? 'unknown'}`,
                JSON.stringify(message.eventDetail),
              )
            }

            prefetchMessageImages(message.body?.content ?? undefined, token.accessToken)

            const eventType: 'message' | 'error' =
              notification.changeType === 'deleted' ? 'error' : 'message'
            const parsed = liveEventSchema.safeParse({ type: eventType, data: message, chatId })
            if (parsed.success) {
              publisher.publish('chat:*', parsed.data)
              if (message.createdDateTime) {
                updateLastMessageAt(chatId, new Date(message.createdDateTime))
              }
            } else {
              consola.warn(`[webhook] Event validation failed for ${notification.resource}:`, parsed.error)
            }
          } catch (err) {
            consola.error(`[webhook] Error processing message for ${notification.resource}:`, err)
            const errorPayload = { type: 'error' as const, data: { resource: notification.resource, fetchFailed: true }, chatId }
            const errorParsed = liveEventSchema.safeParse(errorPayload)
            if (errorParsed.success) publisher.publish('chat:*', errorParsed.data)
          }
        }
      }
    } else if (!token && validNotifications.length > 0) {
      for (const { notification, chatId } of validNotifications) {
        const noTokenPayload = { type: 'error' as const, data: { resource: notification.resource, noToken: true }, chatId }
        const noTokenParsed = liveEventSchema.safeParse(noTokenPayload)
        if (noTokenParsed.success) {
          publisher.publish('chat:*', noTokenParsed.data)
        }
      }
    }

    setResponseStatus(event, 202)
    return { success: true }
  }

  setResponseStatus(event, 405)
  return { error: 'Method not allowed' }
})
