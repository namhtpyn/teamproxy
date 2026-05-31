import { createRatelimitMiddleware } from '@orpc/experimental-ratelimit'
import { mutationLimiter } from '../../utils/rpc-ratelimit'

export const rateLimited = createRatelimitMiddleware({
  limiter: () => mutationLimiter,
  key: ({ context }) => `rpc:${context.username ?? 'anon'}`,
})
