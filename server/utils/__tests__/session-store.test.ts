import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRun, mockSync, mockValues, mockWhere } = vi.hoisted(() => {
  ;(globalThis as { useRuntimeConfig?: () => Record<string, unknown> }).useRuntimeConfig = () => ({
    databaseUrl: ':memory:',
    encryptionKey: 'a'.repeat(32),
    sessionMaxAgeDays: 30,
  })
  const mockRun = vi.fn()
  const mockSync = vi.fn()
  const mockValues = vi.fn().mockReturnValue({ run: mockRun })
  const mockWhere = vi.fn().mockReturnValue({ run: mockRun })
  return { mockRun, mockSync, mockValues, mockWhere }
})

vi.mock('../../db/client', () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: mockValues }),
    query: {
      sessions: {
        findFirst: vi.fn().mockReturnValue({ sync: mockSync }),
      },
    },
    delete: vi.fn().mockReturnValue({ where: mockWhere }),
  },
}))

vi.mock('../../db/schema', () => ({
  sessions: Symbol('sessions'),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: vi.fn((col, val) => ({ col, val })),
  }
})

// eslint-disable-next-line import/first -- vi.mock must precede dynamic imports
import { createSession, resolveSession, deleteSession } from '../session-store'
// eslint-disable-next-line import/first -- vi.mock must precede dynamic imports
import { db } from '../../db/client'
// eslint-disable-next-line import/first -- vi.mock must precede dynamic imports
import { sessions } from '../../db/schema'
// eslint-disable-next-line import/first -- vi.mock must precede dynamic imports
import { eq } from 'drizzle-orm'

describe('session-store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValues.mockReturnValue({ run: mockRun })
    mockSync.mockReturnValue(undefined)
    mockWhere.mockReturnValue({ run: mockRun })
  })

  describe('createSession', () => {
    it('creates a session and returns a UUID token', async () => {
      const token = await createSession('alice', 'admin')
      expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('calls db.insert with the sessions table and correct values', async () => {
      const token = await createSession('bob', 'user')
      expect(db.insert).toHaveBeenCalledWith(sessions)
      expect(mockValues).toHaveBeenCalledWith({
        token,
        username: 'bob',
        role: 'user',
      })
      expect(mockRun).toHaveBeenCalledOnce()
    })
  })

  describe('resolveSession', () => {
    it('returns user data when token exists', async () => {
      mockSync.mockReturnValue({
        token: 'abc-123',
        username: 'charlie',
        role: 'admin',
      })

      const result = await resolveSession('abc-123')
      expect(result).toEqual({ username: 'charlie', role: 'admin' })
    })

    it('returns undefined when token not found', async () => {
      mockSync.mockReturnValue(undefined)

      const result = await resolveSession('nonexistent')
      expect(result).toBeUndefined()
    })
  })

  describe('deleteSession', () => {
    it('calls db.delete with sessions table and correct where clause', async () => {
      await deleteSession('token-to-delete')
      expect(db.delete).toHaveBeenCalledWith(sessions)
      expect(eq).toHaveBeenCalledWith(sessions.token, 'token-to-delete')
      expect(mockRun).toHaveBeenCalledOnce()
    })
  })
})
