import { z } from 'zod'
import { authed } from '../middleware/auth'
import { getMsSubscribedChats } from '../../utils/ms-subscription-store'

export const subscriptionsRouter = {
  list: authed
    .output(
      z.object({
        subscriptions: z.array(
          z.object({
            chatId: z.string(),
            msSubscriptionId: z.string(),
            expiresAt: z.string(),
          }),
        ),
      }),
    )
    .handler(async () => {
      return {
        subscriptions: getMsSubscribedChats().map((s) => ({
          chatId: s.chatId,
          msSubscriptionId: s.msSubscriptionId,
          expiresAt: s.subscriptionExpiresAt.toISOString(),
        })),
      }
    }),
}
