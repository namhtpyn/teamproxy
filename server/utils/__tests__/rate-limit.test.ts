import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_WINDOW_MS = 60_000

vi.stubGlobal('useRuntimeConfig', () => ({
  rateLimitMaxAttempts: DEFAULT_MAX_ATTEMPTS,
  rateLimitWindowMs: DEFAULT_WINDOW_MS,
}))

// eslint-disable-next-line import/first -- vi.stubGlobal must precede dynamic imports
import { rateLimit, _resetRateLimitForTesting } from '../rate-limit'

describe('rateLimit', () => {
  beforeEach(() => {
    _resetRateLimitForTesting()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows first request', () => {
    const result = rateLimit('1.2.3.4')
    expect(result).toEqual({ allowed: true, retryAfter: 0 })
  })

  it('allows up to MAX_ATTEMPTS (5) requests', () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit('1.2.3.4').allowed).toBe(true)
    }
  })

  it('blocks request after MAX_ATTEMPTS exceeded', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('1.2.3.4')
    }
    const result = rateLimit('1.2.3.4')
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('returns correct retryAfter seconds', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('1.2.3.4')
    }
    vi.advanceTimersByTime(30_000)
    const result = rateLimit('1.2.3.4')
    expect(result.retryAfter).toBe(30)
  })

  it('resets after window expires', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('1.2.3.4')
    }
    expect(rateLimit('1.2.3.4').allowed).toBe(false)

    vi.advanceTimersByTime(60_001)
    const result = rateLimit('1.2.3.4')
    expect(result).toEqual({ allowed: true, retryAfter: 0 })
  })

  it('tracks different IPs independently', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('1.1.1.1')
    }
    expect(rateLimit('1.1.1.1').allowed).toBe(false)
    expect(rateLimit('2.2.2.2').allowed).toBe(true)
  })

  it('tracks different namespaces independently', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('1.1.1.1', 'login')
    }
    expect(rateLimit('1.1.1.1', 'login').allowed).toBe(false)
    expect(rateLimit('1.1.1.1', 'image').allowed).toBe(true)
  })

  it('resets counter for new IP after window expires', () => {
    for (let i = 0; i < 6; i++) {
      rateLimit('10.0.0.1')
    }

    vi.advanceTimersByTime(60_001)
    const result = rateLimit('10.0.0.1')
    expect(result.allowed).toBe(true)
    expect(result.retryAfter).toBe(0)
  })
})
