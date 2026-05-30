import { defineEventHandler, getQuery, createError, setHeader, sendStream, getRequestIP } from 'h3'
import { getActiveToken } from '../../db/get-active-token'
import { db } from '../../db/client'
import { GRAPH_BASE } from '../../ms-graph/graph-client'
import { rateLimit } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const limited = rateLimit(getRequestIP(event, { xForwardedFor: true }) ?? 'unknown', 'image')
  if (!limited.allowed) {
    throw createError({ statusCode: 429, message: 'Too many image requests' })
  }

  const rawSession = getCookie(event, 'session') ?? undefined
  const session = rawSession ? await resolveSession(rawSession) : undefined
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const { path } = getQuery(event)
  if (!path || typeof path !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing path parameter' })
  }

  const normalized = path.replace(/\/\.\.(\/|$)/g, '/').replace(/\/\.\.$/, '')
  if (!normalized.includes('/hostedContents/') || !normalized.endsWith('/$value')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid image path' })
  }

  const token = getActiveToken(db)
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const accessToken = token.accessToken
  const url = `${GRAPH_BASE}${normalized}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw createError({ statusCode: response.status, statusMessage: 'Failed to fetch image' })
  }

  const rawContentType = response.headers.get('content-type') ?? ''
  const contentType = rawContentType.startsWith('image/') ? rawContentType : 'image/png'
  setHeader(event, 'content-type', contentType)
  setHeader(event, 'cache-control', 'public, max-age=86400')

  if (response.body) {
    await sendStream(event, response.body as ReadableStream)
  }
})
