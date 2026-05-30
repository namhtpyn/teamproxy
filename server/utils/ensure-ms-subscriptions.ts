import { consola } from 'consola'
import { db } from '../db/client'
import { getActiveToken } from '../db/get-active-token'
import { createGraphClient } from '../ms-graph/graph-client'
import { getMsSubscribedChats, getLastMessageAt } from './ms-subscription-store'
import { getAllowedChats } from './allowed-chats'
import { computeExpiration } from './compute-expiration'
import { renewMsSubscriptions } from './renew-ms-subscriptions'
import { createMsSubscription } from './create-ms-subscription'
import { getWebhookOrigin } from './webhook-origin'
import { backfillMissedMessages } from './backfill-missed-messages'

export async function ensureMsSubscriptions(): Promise<{ renewed: number; created: number; failed: number }> {
  const now = new Date()
  const token = getActiveToken(db, now)
  if (!token) {
    consola.warn('[ensure-ms-subscriptions] No active token')
    return { renewed: 0, created: 0, failed: 0 }
  }

  const client = createGraphClient({ accessToken: token.accessToken })
  const expirationDateTime = computeExpiration()

  // 1. Renew expiring subscriptions (always works, doesn't need origin)
  const soon = new Date(now.getTime() + 60 * 60 * 1000)
  const subscribed = getMsSubscribedChats()
  const expiring = subscribed.filter(s => s.subscriptionExpiresAt > now && s.subscriptionExpiresAt < soon)

  let renewed = 0
  let failed = 0

  if (expiring.length > 0) {
    const result = await renewMsSubscriptions(client, expiring, expirationDateTime, (_chatId, msSubId, err) => {
      consola.error(`[ensure-ms-subscriptions] Renew failed ${msSubId}:`, err)
    })
    renewed = result.renewed
    failed = result.failed
  }

  // 2. Create subscriptions for allowed chats missing active subscriptions (needs origin)
  const origin = getWebhookOrigin()
  let created = 0

  if (origin) {
    const allowed = getAllowedChats()
    const activeIds = new Set(subscribed.filter(s => s.subscriptionExpiresAt > now).map(s => s.chatId))
    const missing = allowed.filter(c => !activeIds.has(c.chatId))

    for (const chat of missing) {
      const result = await createMsSubscription(chat.chatId, token.accessToken)
      if (result.success) {
        created++
        const lastMessageAt = getLastMessageAt(chat.chatId)
        if (lastMessageAt) {
          try {
            await backfillMissedMessages(chat.chatId, lastMessageAt, token.accessToken)
          } catch (err) {
            consola.error(`[ensure-ms-subscriptions] Backfill failed for ${chat.chatId}:`, err)
          }
        }
      }
      else failed++
    }
  } else {
    consola.info('[ensure-ms-subscriptions] No origin cached, skipping creation')
  }

  if (renewed > 0 || created > 0 || failed > 0) {
    consola.info(`[ensure-ms-subscriptions] Renewed: ${renewed}, Created: ${created}, Failed: ${failed}`)
  }

  return { renewed, created, failed }
}
