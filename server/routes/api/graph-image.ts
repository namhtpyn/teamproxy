import { createReadStream } from 'node:fs'
import { extname } from 'node:path'
import { defineEventHandler, getQuery, createError, setHeader, sendStream, send, type H3Event } from 'h3'
import { consola } from 'consola'
import { getActiveToken } from '../../db/get-active-token'
import { db } from '../../db/client'
import { GRAPH_BASE } from '../../ms-graph/graph-client'
import { getCachedImagePath, cacheImage } from '../../utils/image-cache'

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
}

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualGQAAAABJRU5ErkJggg==',
  'base64',
)

function servePlaceholder(event: H3Event) {
  setHeader(event, 'content-type', 'image/png')
  setHeader(event, 'cache-control', 'no-store')
  return send(event, TRANSPARENT_PNG)
}

export default defineEventHandler(async (event) => {
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

  const cachedPath = getCachedImagePath(normalized)
  if (cachedPath) {
    const ext = extname(cachedPath)
    const contentType = EXT_TO_CONTENT_TYPE[ext] ?? 'image/png'
    setHeader(event, 'content-type', contentType)
    setHeader(event, 'cache-control', 'public, max-age=86400')
    return sendStream(event, createReadStream(cachedPath))
  }

  const token = getActiveToken(db)
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const url = new URL(normalized, `${GRAPH_BASE}/`).toString()

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  })

  consola.info(`[graph-image] Graph response: ${response.status} ${response.statusText}`)

  if (!response.ok) {
    if (response.status === 404 || response.status === 410) {
      return servePlaceholder(event)
    }
    throw createError({ statusCode: response.status, statusMessage: 'Failed to fetch image' })
  }

  const rawContentType = response.headers.get('content-type') ?? ''
  const contentType = rawContentType.startsWith('image/') ? rawContentType : 'image/png'
  setHeader(event, 'content-type', contentType)
  setHeader(event, 'cache-control', 'public, max-age=86400')

  const buffer = await response.arrayBuffer()
  void cacheImage(normalized, token.accessToken)

  return send(event, Buffer.from(buffer))
})
