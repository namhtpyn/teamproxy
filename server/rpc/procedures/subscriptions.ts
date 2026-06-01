import { authed } from '../middleware/auth'
import { getMsSubscribedChats } from '../../utils/subscriptions/ms-subscription-store'

export const subscriptionsRouter = {
  list: authed.handler(async () => {
    return {
      subscriptions: getMsSubscribedChats().map((s) => ({
        chatId: s.chatId,
        msSubscriptionId: s.msSubscriptionId,
        expiresAt: s.subscriptionExpiresAt.toISOString(),
      })),
    }
  }),
}
