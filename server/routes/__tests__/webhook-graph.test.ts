import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

const {
  mockGetQuery,
  mockReadBody,
  mockSetResponseStatus,
  mockGetActiveToken,
  mockPublish,
  mockGetSubscriptionsByClientStates,
  mockGetMessage,
} = vi.hoisted(() => ({
  mockGetQuery: vi.fn(),
  mockReadBody: vi.fn(),
  mockSetResponseStatus: vi.fn(),
  mockGetActiveToken: vi.fn(),
  mockPublish: vi.fn(),
  mockGetSubscriptionsByClientStates: vi.fn(),
  mockGetMessage: vi.fn(),
}))

vi.mock('h3', () => ({
  defineEventHandler: (fn: (...args: unknown[]) => unknown) => fn,
  getQuery: mockGetQuery,
  readBody: mockReadBody,
  setResponseStatus: mockSetResponseStatus,
  getRequestIP: () => '127.0.0.1',
}))

vi.mock('consola', () => ({
  consola: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), ready: vi.fn() },
}))

vi.mock('../../db/client', () => ({
  db: {},
}))

vi.mock('../../db/get-active-token', () => ({
  getActiveToken: mockGetActiveToken,
}))

vi.mock('../../utils/event-bus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/event-bus')>()
  return {
    ...actual,
    getEventPublisher: () => ({ publish: mockPublish }),
  }
})

vi.mock('../../utils/ms-subscription-store', () => ({
  getMsSubscriptionsByClientStates: mockGetSubscriptionsByClientStates,
}))

vi.mock('../../ms-graph/graph-client', () => ({
  createGraphClient: () => ({
    chats: { getMessage: mockGetMessage },
  }),
}))

// eslint-disable-next-line import/first -- vi.mock must precede dynamic imports
import handler from '../webhook/graph'

type HttpMethod = 'GET' | 'POST'

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

function makeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    chatId: 'chat1',
    msSubscriptionId: 'sub1',
    clientState: 'cs1',
    subscriptionExpiresAt: new Date('2026-01-01'),
    allowed: true,
    ...overrides,
  }
}

describe('validation token handshake', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with the validation token when query param is a string', async () => {
    mockGetQuery.mockReturnValue({ validationToken: 'abc123' })
    const result = await handler(createMockEvent('GET'))
    expect(result).toBe('abc123')
    expect(mockSetResponseStatus).toHaveBeenCalledWith(expect.anything(), 200)
  })

  it('returns 200 with validation token when it is an array with one element', async () => {
    mockGetQuery.mockReturnValue({ validationToken: ['token-A', 'token-B'] })
    const result = await handler(createMockEvent('GET'))
    expect(result).toBe('token-A')
    expect(mockSetResponseStatus).toHaveBeenCalledWith(expect.anything(), 200)
  })
})

describe('notification processing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetQuery.mockReturnValue({})
  })

  it('returns 202 for valid POST with notifications', async () => {
    mockReadBody.mockResolvedValue({
      value: [
        { resource: "chats('c1')/messages('m1')", changeType: 'created', clientState: 'cs1' },
      ],
    })
    mockGetSubscriptionsByClientStates.mockReturnValue(new Map([['cs1', makeSub()]]))
    mockGetActiveToken.mockResolvedValue({ accessToken: 'tok' })
    mockGetMessage.mockResolvedValue({
      id: 'm1',
      body: { content: 'hello', contentType: 'text' },
      from: { user: { displayName: 'Test User' } },
      createdDateTime: '2026-01-01T00:00:00Z',
      messageType: 'message',
    })

    const result = await handler(createMockEvent('POST'))
    expect(result).toEqual({ success: true })
    expect(mockSetResponseStatus).toHaveBeenCalledWith(expect.anything(), 202)
  })

  it('returns 403 when notification has missing clientState', async () => {
    mockReadBody.mockResolvedValue({
      value: [
        { resource: "chats('c1')/messages('m1')", changeType: 'created' },
      ],
    })

    const result = await handler(createMockEvent('POST'))
    expect(result).toEqual({ error: 'Missing clientState in notification' })
    expect(mockSetResponseStatus).toHaveBeenCalledWith(expect.anything(), 403)
  })

  it('returns 403 when notification has unknown clientState', async () => {
    mockReadBody.mockResolvedValue({
      value: [
        { resource: "chats('c1')/messages('m1')", changeType: 'created', clientState: 'unknown' },
      ],
    })
    mockGetSubscriptionsByClientStates.mockReturnValue(new Map())

    const result = await handler(createMockEvent('POST'))
    expect(result).toEqual({ error: 'Unknown or disallowed subscription' })
    expect(mockSetResponseStatus).toHaveBeenCalledWith(expect.anything(), 403)
  })

  it('returns 202 when no notifications in body', async () => {
    mockReadBody.mockResolvedValue({ value: [] })

    const result = await handler(createMockEvent('POST'))
    expect(result).toEqual({ success: true })
    expect(mockSetResponseStatus).toHaveBeenCalledWith(expect.anything(), 202)
  })

  it('returns 202 when body is empty/malformed', async () => {
    mockReadBody.mockResolvedValue({})

    const result = await handler(createMockEvent('POST'))
    expect(result).toEqual({ success: true })
    expect(mockSetResponseStatus).toHaveBeenCalledWith(expect.anything(), 202)
  })
})

describe('edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetQuery.mockReturnValue({})
  })

  it('returns 405 for GET requests without validation token', async () => {
    const result = await handler(createMockEvent('GET'))
    expect(result).toEqual({ error: 'Method not allowed' })
    expect(mockSetResponseStatus).toHaveBeenCalledWith(expect.anything(), 405)
  })

  it('handles multiple notifications in a single batch', async () => {
    mockReadBody.mockResolvedValue({
      value: [
        { resource: "chats('c1')/messages('m1')", changeType: 'created', clientState: 'cs1' },
        { resource: "chats('c2')/messages('m2')", changeType: 'created', clientState: 'cs2' },
      ],
    })
    mockGetSubscriptionsByClientStates.mockReturnValue(
      new Map([
        ['cs1', makeSub({ id: '1', clientState: 'cs1', chatId: 'c1' })],
        ['cs2', makeSub({ id: '2', clientState: 'cs2', chatId: 'c2' })],
      ]),
    )
    mockGetActiveToken.mockResolvedValue({ accessToken: 'tok' })
    mockGetMessage.mockResolvedValue({
      id: 'm1',
      body: { content: 'hello', contentType: 'text' },
      from: { user: { displayName: 'Test User' } },
      createdDateTime: '2026-01-01T00:00:00Z',
      messageType: 'message',
    })

    const result = await handler(createMockEvent('POST'))
    expect(result).toEqual({ success: true })
    expect(mockPublish).toHaveBeenCalledTimes(2)
  })
})
