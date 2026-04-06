import { createRatelimitMiddleware } from '@orpc/experimental-ratelimit'
import { mutationLimiter, subscriptionLimiter } from '../../utils/rpc-ratelimit'

export const rateLimited = createRatelimitMiddleware({
  limiter: () => mutationLimiter,
  key: ({ context }) => `rpc:${context.username ?? 'anon'}`,
})

export const subscriptionRateLimited = createRatelimitMiddleware({
  limiter: () => subscriptionLimiter,
  key: ({ context }) => `sub:${context.username ?? 'anon'}`,
})
