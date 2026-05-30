import { consola } from 'consola'
import { db } from '../db/client'
import { getActiveToken } from '../db/get-active-token'
import { createGraphClient } from '../ms-graph/graph-client'
import { getMsSubscribedChats, clearMsSubscription } from './ms-subscription-store'

export async function disconnectAllSubscriptions(): Promise<void> {
  const token = getActiveToken(db)

  if (token) {
    const client = createGraphClient({ accessToken: token.accessToken })
    const subscribed = getMsSubscribedChats()

    await Promise.allSettled(
      subscribed.map(async (sub) => {
        try {
          await client.subscriptions.delete(sub.msSubscriptionId)
        } catch (err) {
          consola.warn(
            `Failed to delete Graph subscription ${sub.msSubscriptionId} for chat ${sub.chatId}:`,
            err,
          )
        }
      }),
    )
  }

  const subscribed = getMsSubscribedChats()
  for (const sub of subscribed) {
    clearMsSubscription(sub.chatId)
  }
}
