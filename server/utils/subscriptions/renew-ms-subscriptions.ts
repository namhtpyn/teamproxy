import type { MsSubscribedChat } from './ms-subscription-store'
import { updateMsSubscription, clearMsSubscription } from './ms-subscription-store'

interface MsRenewableClient {
  subscriptions: {
    renew: (id: string, params: { expirationDateTime: string }) => Promise<unknown>
  }
}

export interface MsRenewResult {
  renewed: number
  failed: number
}

export async function renewMsSubscriptions(
  client: MsRenewableClient,
  subscriptions: MsSubscribedChat[],
  expirationDateTime: string,
  onError?: (chatId: string, msSubscriptionId: string, err: unknown) => void,
): Promise<MsRenewResult> {
  let renewed = 0
  let failed = 0

  for (const sub of subscriptions) {
    try {
      await client.subscriptions.renew(sub.msSubscriptionId, { expirationDateTime })
      updateMsSubscription(sub.chatId, { subscriptionExpiresAt: new Date(expirationDateTime) })
      renewed++
    } catch (err) {
      clearMsSubscription(sub.chatId)
      failed++
      onError?.(sub.chatId, sub.msSubscriptionId, err)
    }
  }

  return { renewed, failed }
}
