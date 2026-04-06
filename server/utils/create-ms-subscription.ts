import { consola } from 'consola'
import { createGraphClient } from '../ms-graph/graph-client'
import type { GraphSubscription } from '../ms-graph/types'
import { updateMsSubscription } from './ms-subscription-store'
import { computeExpiration } from './compute-expiration'
import { getWebhookOrigin } from './webhook-origin'

export async function createMsSubscription(
  chatId: string,
  accessToken: string,
): Promise<{ success: boolean; error?: string }> {
  const origin = getWebhookOrigin()
  if (!origin) {
    return { success: false, error: 'No webhook origin available' }
  }

  const clientState = crypto.randomUUID()
  const expirationDateTime = computeExpiration()
  const client = createGraphClient({ accessToken })

  try {
    const result: GraphSubscription = await client.subscriptions.create({
      changeType: 'created',
      notificationUrl: `${origin}/webhook/graph`,
      resource: `/chats/${chatId}/messages`,
      expirationDateTime,
      clientState,
    })

    updateMsSubscription(chatId, {
      msSubscriptionId: result.id,
      clientState: result.clientState,
      subscriptionExpiresAt: new Date(result.expirationDateTime),
    })

    return { success: true }
  } catch (err) {
    consola.error(`Failed to create subscription for chat ${chatId}:`, err)
    return { success: false, error: 'Failed to create webhook subscription' }
  }
}
