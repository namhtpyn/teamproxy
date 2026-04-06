import { defineEventHandler, getQuery, readBody, setResponseStatus, getRequestIP } from 'h3'
import { consola } from 'consola'
import { db } from '../../db/client'
import { getActiveToken } from '../../db/get-active-token'
import { createGraphClient } from '../../ms-graph/graph-client'
import { liveEventSchema, getEventPublisher } from '../../utils/event-bus'
import { getMsSubscriptionsByClientStates } from '../../utils/ms-subscription-store'

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

    for (const notification of rawNotifications) {
      if (typeof notification?.resource !== 'string' || typeof notification?.clientState !== 'string') {
        continue
      }
      const sub = subMap.get(notification.clientState)
      if (!sub) continue

      const chatId = extractChatId(notification.resource)
      if (!chatId) continue

      if (token) {
        try {
          const client = createGraphClient({ accessToken: token.accessToken })
          const message = await client.chats.getMessage(resourceToPath(notification.resource))

          const eventType: 'message' | 'error' =
            notification.changeType === 'deleted' ? 'error' : 'message'
          const parsed = liveEventSchema.safeParse({ type: eventType, data: message, chatId })
          if (parsed.success) {
            publisher.publish('chat:*', parsed.data)
          } else {
            consola.warn(`[webhook] Event validation failed for ${notification.resource}:`, parsed.error)
          }
        } catch (err) {
          consola.error(`[webhook] Failed to fetch message for ${notification.resource}:`, err)
          const errorPayload = { type: 'error' as const, data: { resource: notification.resource, fetchFailed: true }, chatId }
          const errorParsed = liveEventSchema.safeParse(errorPayload)
          if (errorParsed.success) {
            publisher.publish('chat:*', errorParsed.data)
          }
        }
      } else {
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
