import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { consola } from 'consola'
import { GRAPH_BASE } from '../ms-graph/graph-client'

const CACHE_DIR = process.env.IMAGE_CACHE_DIR || join(process.cwd(), '.data', 'images')

const EXT_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
}

function hashPath(graphPath: string): string {
  return createHash('sha256').update(graphPath).digest('hex').slice(0, 16)
}

function findCachedFile(hash: string): string | null {
  if (!existsSync(CACHE_DIR)) return null
  const files = readdirSync(CACHE_DIR)
  const match = files.find((f) => f.startsWith(hash + '.'))
  return match ? join(CACHE_DIR, match) : null
}

let cacheDirReady = false

function ensureCacheDir(): void {
  if (cacheDirReady) return
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true })
  }
  cacheDirReady = true
}

export function getCachedImagePath(graphPath: string): string | null {
  const hash = hashPath(graphPath)
  const filePath = findCachedFile(hash)
  return filePath && existsSync(filePath) ? filePath : null
}

export async function cacheImage(graphPath: string, accessToken: string): Promise<string | null> {
  const cached = getCachedImagePath(graphPath)
  if (cached) return cached

  const hash = hashPath(graphPath)
  const url = `${GRAPH_BASE}/${graphPath.replace(/^\//, '')}`

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      consola.warn(`[image-cache] Fetch failed for ${graphPath}: ${response.status}`)
      return null
    }

    const contentType = response.headers.get('content-type') ?? 'image/png'
    const ext = EXT_MAP[contentType] ?? '.png'
    const filePath = join(CACHE_DIR, `${hash}${ext}`)

    ensureCacheDir()
    const buffer = await response.arrayBuffer()
    writeFileSync(filePath, Buffer.from(buffer))

    consola.info(`[image-cache] Cached ${graphPath} → ${filePath}`)
    return filePath
  } catch (err) {
    consola.error(`[image-cache] Error caching ${graphPath}:`, err)
    return null
  }
}

const HOSTED_CONTENTS_RE = /chats\/[^"'\s]+\/hostedContents\/[^"'\s]+\/\$value/g

export function prefetchMessageImages(messageHtml: string | undefined, accessToken: string): void {
  if (!messageHtml) return
  const matches = messageHtml.matchAll(HOSTED_CONTENTS_RE)
  for (const match of matches) {
    cacheImage(match[0], accessToken).catch(() => {})
  }
}
