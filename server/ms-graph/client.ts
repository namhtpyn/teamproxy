import type { GraphRequestOptions, ODataError } from './types'

export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const MAX_RETRIES = 3
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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/** Returns 'RETRY_429' sentinel when caller should retry, throws on error, returns Response on success. */
async function handleGraphResponse(response: Response): Promise<Response | 'RETRY_429'> {
  if (response.status === 429) {
    return 'RETRY_429'
  }

  if (response.status === 401) {
    throw new GraphAuthError('Authentication failed: token expired or invalid')
  }

  if (!response.ok) {
    let errorBody: ODataError | null = null
    try {
      errorBody = (await response.json()) as ODataError
    } catch { /* non-JSON error body */ }
    const message = errorBody?.error?.message ?? `Graph API error: ${response.status}`
    const code = errorBody?.error?.code ?? 'unknown'
    throw new GraphAPIError(response.status, code, message)
  }

  return response
}

async function retryOrThrow(
  result: Response | 'RETRY_429',
  response: Response,
  retryCount: number,
  backoffMs: number,
): Promise<{ shouldRetry: false } | { shouldRetry: true; retryCount: number; backoffMs: number }> {
  if (result !== 'RETRY_429') return { shouldRetry: false }

  const nextRetry = retryCount + 1
  if (nextRetry > MAX_RETRIES) {
    throw new GraphAPIError(429, 'rate_limited', 'Rate limit exceeded after max retries')
  }
  const retryAfter = response.headers.get('Retry-After')
  const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : NaN
  const waitMs = !isNaN(retrySeconds) && retrySeconds > 0 ? retrySeconds * 1000 : backoffMs
  await sleep(waitMs)
  return { shouldRetry: true, retryCount: nextRetry, backoffMs: backoffMs * 2 }
}

export async function graphRequest<T>(options: GraphRequestOptions): Promise<T | undefined> {
  const { method, path, body, query, accessToken } = options

  let url = `${GRAPH_BASE}${path}`
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams(query)
    url += `?${params.toString()}`
  }

  const successResponse = await withRetry(async () => {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    return { response, result: await handleGraphResponse(response) }
  })

  const contentType = successResponse.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return successResponse.json()
  }

  return undefined
}

async function withRetry(
  fn: () => Promise<{ response: Response; result: Response | 'RETRY_429' }>,
): Promise<Response> {
  let retryCount = 0
  let backoffMs = 1000

  while (true) {
    const { response, result } = await fn()
    const retry = await retryOrThrow(result, response, retryCount, backoffMs)
    if (retry.shouldRetry) {
      retryCount = retry.retryCount
      backoffMs = retry.backoffMs
      continue
    }
    return result as Response
  }
}
