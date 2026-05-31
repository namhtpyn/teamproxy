const attempts = new Map<string, { count: number; resetAt: number }>()

function pruneExpired() {
  if (attempts.size <= 1000) return
  const now = Date.now()
  for (const [key, val] of attempts) {
    if (val.resetAt < now) attempts.delete(key)
  }
}

export function rateLimit(ip: string, namespace = 'default'): { allowed: boolean; retryAfter: number } {
  pruneExpired()
  const config = useRuntimeConfig()
  const maxAttempts = config.rateLimitMaxAttempts
  const windowMs = config.rateLimitWindowMs
  const now = Date.now()
  const key = `${namespace}:${ip}`
  const entry = attempts.get(key)

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  entry.count++
  if (entry.count > maxAttempts) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  return { allowed: true, retryAfter: 0 }
}

