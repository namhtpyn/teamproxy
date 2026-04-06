import { describe, it, expect } from 'vitest'
import { computeExpiration } from '../compute-expiration'

describe('computeExpiration', () => {
  it('returns an ISO 8601 datetime string', () => {
    const result = computeExpiration()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('returns a date approximately 55 minutes in the future', () => {
    const result = computeExpiration()
    const parsed = new Date(result)
    const now = Date.now()
    const diffMs = parsed.getTime() - now
    const diffMin = diffMs / 60000
    // Should be close to 55 minutes (allow 1 minute tolerance)
    expect(diffMin).toBeGreaterThan(54)
    expect(diffMin).toBeLessThan(56)
  })
})
