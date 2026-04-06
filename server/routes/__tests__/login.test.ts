import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

const {
  mockReadBody,
  mockSetCookie,
  mockDeleteCookie,
  mockGetCookie,
  mockGetRequestIP,
  mockCreateError,
  mockCreateSession,
  mockDeleteSession,
  mockTimingSafeEqual,
} = vi.hoisted(() => ({
  mockReadBody: vi.fn(),
  mockSetCookie: vi.fn(),
  mockDeleteCookie: vi.fn(),
  mockGetCookie: vi.fn(),
  mockGetRequestIP: vi.fn(),
  mockCreateError: vi.fn(),
  mockCreateSession: vi.fn().mockReturnValue('test-session-token'),
  mockDeleteSession: vi.fn().mockReturnValue(undefined),
  mockTimingSafeEqual: vi.fn(),
}))

vi.stubGlobal('useRuntimeConfig', () => ({
  appAdmin: 'admin:secret',
  appUser: 'user:pass',
  sessionMaxAge: 2592000,
  rateLimitMaxAttempts: 5,
  rateLimitWindowMs: 60000,
}))

vi.mock('h3', () => ({
  defineEventHandler: (fn: (...args: unknown[]) => unknown) => fn,
  readBody: mockReadBody,
  setCookie: mockSetCookie,
  deleteCookie: mockDeleteCookie,
  getCookie: mockGetCookie,
  getRequestIP: mockGetRequestIP,
  createError: mockCreateError,
}))

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>()
  return {
    ...actual,
    timingSafeEqual: mockTimingSafeEqual,
  }
})

vi.mock('../../utils/session-store', () => ({
  createSession: mockCreateSession,
  deleteSession: mockDeleteSession,
}))

// eslint-disable-next-line import/first -- vi.mock must precede dynamic imports
import { _resetRateLimitForTesting } from '../../utils/rate-limit'
// eslint-disable-next-line import/first
import handler from '../auth/login'

type HttpMethod = 'GET' | 'POST' | 'DELETE'

function createMockEvent(method: HttpMethod) {
  const req = new IncomingMessage(new Socket())
  const res = new ServerResponse(req)
  return {
    __is_event__: true,
    node: { req, res },
    context: {} as Record<string, unknown>,
    _method: method,
    _path: '/',
    _handled: false,
    _onBeforeResponseCalled: undefined as boolean | undefined,
    _onAfterResponseCalled: undefined as boolean | undefined,
    get method() { return this._method },
    get path() { return this._path },
    get headers() { return new Headers() },
    get handled() { return this._handled },
    get req() { return this.node.req },
    get res() { return this.node.res },
    respondWith: vi.fn(),
    toString: () => `[H3Event ${method}]`,
    toJSON: () => `[H3Event ${method}]`,
    // Nitro extensions on H3Event
    fetch: vi.fn(),
    $fetch: vi.fn(),
    waitUntil: vi.fn(),
    captureError: vi.fn(),
  }
}

function mockErrorImpl({ statusCode, message }: { statusCode: number; message: string }) {
  return Object.assign(new Error(message), { statusCode })
}

describe('POST /auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetRateLimitForTesting()
    mockGetRequestIP.mockReturnValue('127.0.0.1')
    mockReadBody.mockResolvedValue({ username: 'admin', password: 'secret' })
    mockCreateError.mockImplementation(mockErrorImpl)
    mockTimingSafeEqual.mockImplementation((a: Buffer, b: Buffer) => a.equals(b))
  })

  it('returns { success: true } on valid admin credentials', async () => {
    const result = await handler(createMockEvent('POST'))
    expect(result).toEqual({ success: true })
  })

  it('returns { success: true } on valid user credentials', async () => {
    mockReadBody.mockResolvedValue({ username: 'user', password: 'pass' })
    const result = await handler(createMockEvent('POST'))
    expect(result).toEqual({ success: true })
  })

  it('returns 401 on invalid username', async () => {
    mockReadBody.mockResolvedValue({ username: 'wrong', password: 'secret' })
    await expect(handler(createMockEvent('POST'))).rejects.toThrow('Invalid credentials')
    expect(mockCreateError).toHaveBeenCalledWith({ statusCode: 401, message: 'Invalid credentials' })
  })

  it('returns 401 on invalid password', async () => {
    mockReadBody.mockResolvedValue({ username: 'admin', password: 'wrongpass' })
    await expect(handler(createMockEvent('POST'))).rejects.toThrow('Invalid credentials')
  })

  it('sets httpOnly session cookie with correct options', async () => {
    await handler(createMockEvent('POST'))
    expect(mockSetCookie).toHaveBeenCalledWith(
      expect.anything(),
      'session',
      'test-session-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 2592000,
      }),
    )
  })

  it('rate limits after 5 failed attempts (returns 429)', async () => {
    mockReadBody.mockResolvedValue({ username: 'admin', password: 'wrong' })
    for (let i = 0; i < 5; i++) {
      await handler(createMockEvent('POST')).catch(() => {})
    }
    await expect(handler(createMockEvent('POST'))).rejects.toThrow('Too many login attempts')
    expect(mockCreateError).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 429 }),
    )
  })

  it('uses timingSafeEqual for username and password comparison', async () => {
    await handler(createMockEvent('POST'))
    expect(mockTimingSafeEqual).toHaveBeenCalledTimes(2)
    const [userA, userB] = mockTimingSafeEqual.mock.calls[0]!
    expect(userA.toString()).toBe('admin')
    expect(userB.toString()).toBe('admin')
    const [passA, passB] = mockTimingSafeEqual.mock.calls[1]!
    expect(passA.toString()).toBe('secret')
    expect(passB.toString()).toBe('secret')
  })
})

describe('DELETE /auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { success: true } on valid session token', async () => {
    mockGetCookie.mockReturnValue('valid-token')
    const result = await handler(createMockEvent('DELETE'))
    expect(result).toEqual({ success: true })
    expect(mockDeleteSession).toHaveBeenCalledWith('valid-token')
  })

  it('deletes session cookie', async () => {
    mockGetCookie.mockReturnValue('valid-token')
    await handler(createMockEvent('DELETE'))
    expect(mockDeleteCookie).toHaveBeenCalledWith(expect.anything(), 'session', { path: '/' })
  })

  it('returns { success: true } even with no session cookie', async () => {
    mockGetCookie.mockReturnValue(undefined)
    const result = await handler(createMockEvent('DELETE'))
    expect(result).toEqual({ success: true })
    expect(mockDeleteSession).not.toHaveBeenCalled()
  })
})

describe('method validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateError.mockImplementation(mockErrorImpl)
  })

  it('returns 405 for GET requests', async () => {
    await expect(handler(createMockEvent('GET'))).rejects.toThrow('Method not allowed')
    expect(mockCreateError).toHaveBeenCalledWith({ statusCode: 405, message: 'Method not allowed' })
  })
})
