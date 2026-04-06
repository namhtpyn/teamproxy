import { defineEventHandler, readBody, setCookie, deleteCookie, getCookie, createError, getRequestIP } from 'h3'
import { timingSafeEqual } from 'node:crypto'
import { createSession, deleteSession, type UserRole } from '../../utils/session-store'
import { rateLimit } from '../../utils/rate-limit'

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function verifyPassword(input: string, stored: string): boolean {
  const inputBuf = Buffer.from(input)
  const storedBuf = Buffer.from(stored)
  return inputBuf.length === storedBuf.length && timingSafeEqual(inputBuf, storedBuf)
}

function parseCredentials(
  value: string | undefined,
): { username: string; password: string } | null {
  if (!value) return null
  const colonIndex = value.indexOf(':')
  if (colonIndex <= 0) return null
  return {
    username: value.slice(0, colonIndex),
    password: value.slice(colonIndex + 1),
  }
}

export default defineEventHandler(async (event) => {
  if (event.method === 'POST') {
    const body = await readBody(event)
    const { username, password } = body ?? {}

    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
    const { allowed, retryAfter } = rateLimit(ip, 'login')
    if (!allowed) {
      throw createError({
        statusCode: 429,
        message: `Too many login attempts. Try again in ${retryAfter} seconds.`,
      })
    }

    const config = useRuntimeConfig()
    const admin = parseCredentials(config.appAdmin)
    const user = parseCredentials(config.appUser)

    let role: UserRole | null = null

    if (admin && safeEqual(username ?? '', admin.username) && verifyPassword(password ?? '', admin.password)) {
      role = 'admin'
    }

    if (!role && user && safeEqual(username ?? '', user.username) && verifyPassword(password ?? '', user.password)) {
      role = 'user'
    }

    if (!role) {
      throw createError({ statusCode: 401, message: 'Invalid credentials' })
    }

    const sessionToken = createSession(username, role)
    setCookie(event, 'session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: config.sessionMaxAge,
      path: '/',
    })

    return { success: true }
  }

  if (event.method === 'DELETE') {
    const rawSession = getCookie(event, 'session')
    if (rawSession) {
      deleteSession(rawSession)
    }
    deleteCookie(event, 'session', { path: '/' })
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
