import { MemoryRatelimiter } from '@orpc/experimental-ratelimit/memory'

// TODO: Read these from runtimeConfig when event context can be passed to module-level middleware
/** Rate limiter for RPC mutation endpoints (sendMessage, subscribe). */
export const mutationLimiter = new MemoryRatelimiter({
  maxRequests: 20,
  window: 60_000, // 20 requests per minute
})

/** Rate limiter for subscription endpoints (lower limit). */
export const subscriptionLimiter = new MemoryRatelimiter({
  maxRequests: 10,
  window: 60_000, // 10 requests per minute
})
