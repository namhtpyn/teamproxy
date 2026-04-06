import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Database } from '../../../db/client'

const { mockGetActiveToken, mockDb } = vi.hoisted(() => {
  const mockGetActiveToken = vi.fn()
  const mockDb = {} as Database
  return { mockGetActiveToken, mockDb }
})

vi.mock('../../../db/client', () => ({
  db: mockDb,
}))

vi.mock('../../../db/get-active-token', () => ({
  getActiveToken: mockGetActiveToken,
}))

vi.mock('../../../db/schema', () => ({
  oauthTokens: Symbol('oauthTokens'),
}))

vi.mock('../../../ms-graph/scopes', () => ({
  MS_SCOPE_STRING: 'openid profile Mail.Read',
}))

// eslint-disable-next-line import/first -- vi.mock must precede dynamic imports
import { call } from '@orpc/server'
// eslint-disable-next-line import/first -- vi.mock must precede dynamic imports
import { authRouter } from '../auth'

function baseContext(overrides: Record<string, unknown> = {}) {
  return { db: mockDb, origin: 'http://localhost:3000', ...overrides }
}

describe('authRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetActiveToken.mockReturnValue(undefined)
  })

  describe('getStatus', () => {
    it('returns unauthenticated when no username in context', async () => {
      const result = await call(authRouter.getStatus, undefined, {
        context: baseContext(),
      })
      expect(result).toEqual({ authenticated: false, user: null })
    })

    it('returns authenticated user when username present', async () => {
      const result = await call(authRouter.getStatus, undefined, {
        context: baseContext({ username: 'alice', role: 'admin' }),
      })
      expect(result).toEqual({
        authenticated: true,
        user: { id: 'alice', displayName: 'alice', role: 'admin' },
      })
    })

    it('defaults role to "user" when not provided', async () => {
      const result = await call(authRouter.getStatus, undefined, {
        context: baseContext({ username: 'bob' }),
      })
      expect(result).toEqual({
        authenticated: true,
        user: { id: 'bob', displayName: 'bob', role: 'user' },
      })
    })
  })

  describe('getMsConnectionStatus', () => {
    it('returns disconnected when no username in context', async () => {
      const result = await call(authRouter.getMsConnectionStatus, undefined, {
        context: baseContext(),
      })
      expect(result).toEqual({ connected: false, expiresAt: null })
    })

    it('returns disconnected when username present but no active token', async () => {
      mockGetActiveToken.mockReturnValue(undefined)

      const result = await call(authRouter.getMsConnectionStatus, undefined, {
        context: baseContext({ username: 'alice' }),
      })
      expect(result).toEqual({ connected: false, expiresAt: null })
      expect(mockGetActiveToken).toHaveBeenCalledOnce()
    })

    it('returns connected with expiresAt when active token exists', async () => {
      const futureDate = new Date('2026-12-31T00:00:00.000Z')
      mockGetActiveToken.mockReturnValue({
        expiresAt: futureDate,
        accessToken: 'encrypted-token',
        refreshToken: null,
      })

      const result = await call(authRouter.getMsConnectionStatus, undefined, {
        context: baseContext({ username: 'alice' }),
      })
      expect(result).toEqual({
        connected: true,
        expiresAt: '2026-12-31T00:00:00.000Z',
      })
    })
  })
})
