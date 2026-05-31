import type { GraphRequestOptions, ODataError } from './types'

export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000
const REQUEST_TIMEOUT_MS = 30_000

export class GraphAPIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'GraphAPIError'
  }
}

export class GraphAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GraphAuthError'
  }
}

async function withRetry(fn: () => Promise<Response>): Promise<Response> {
  let retryCount = 0
  let backoffMs = INITIAL_BACKOFF_MS

  while (true) {
    const response = await fn()

    if (response.status === 429) {
      if (++retryCount > MAX_RETRIES) {
        throw new GraphAPIError(429, 'rate_limited', 'Too many requests. Please retry after some time.')
      }
      const retryAfter = response.headers.get('Retry-After')
      const waitMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 || backoffMs : backoffMs
      await new Promise(resolve => setTimeout(resolve, waitMs))
      backoffMs *= 2
      continue
    }

    if (response.status === 401) {
      throw new GraphAuthError('Access token is invalid or expired. Please re-authenticate.')
    }

    if (!response.ok) {
      let errorBody: ODataError | null = null
      try {
        errorBody = (await response.json()) as ODataError
      } catch { /* non-JSON error body */ }
      throw new GraphAPIError(
        response.status,
        errorBody?.error?.code ?? 'unknown_error',
        errorBody?.error?.message ?? response.statusText,
      )
    }

    return response
  }
}

export async function graphRequest<T>(options: GraphRequestOptions): Promise<T | undefined> {
  const { method, path, rawUrl, body, query, accessToken } = options

  const queryParams = (!rawUrl && query && Object.keys(query).length > 0) ? new URLSearchParams(query) : null
  const url = rawUrl ?? `${GRAPH_BASE}${path}${queryParams ? `?${queryParams}` : ''}`

  const response = await withRetry(async () =>
    fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }),
  )

  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return response.json()
  }

  return undefined
}
