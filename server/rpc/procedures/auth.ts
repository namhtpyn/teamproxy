import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ORPCError } from '@orpc/server'
import { base } from '../context'
import { adminOnly } from '../middleware/auth'
import { db } from '../../db/client'
import { oauthTokens } from '../../db/schema'
import { MS_SCOPE_STRING } from '../../ms-graph/scopes'
import { getActiveToken } from '../../db/get-active-token'
import { createGraphClient } from '../../ms-graph/graph-client'
import { disconnectAllSubscriptions } from '../../utils/disconnect-all-subscriptions'
import { getEventPublisher } from '../../utils/event-bus'

export const authRouter = {
  getStatus: base.handler(async ({ context: { username, role } }) => {
    if (!username) {
      return { authenticated: false, user: null }
    }

    return {
      authenticated: true,
      user: {
        id: username,
        displayName: username,
        role: role ?? 'user',
      } as const,
    }
  }),

  getMicrosoftAuthUrl: adminOnly.handler(async ({ context: { origin } }) => {
    const config = useRuntimeConfig()
    const tenantId = config.msTenantId
    const clientId = config.msClientId
    const redirectUri = `${origin}/auth/ms-callback`

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: MS_SCOPE_STRING,
      response_mode: 'query',
    })

    return {
      url: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`,
    }
  }),

  getMsConnectionStatus: base.handler(async ({ context: { username } }) => {
    if (!username) {
      return { connected: false, expiresAt: null }
    }

    const token = getActiveToken(db)

    return {
      connected: !!token,
      expiresAt: token?.expiresAt?.toISOString() ?? null,
    }
  }),

  disconnectMs: adminOnly.handler(async () => {
    await disconnectAllSubscriptions()

    const publisher = getEventPublisher()
    publisher.publish('chat:*', {
      type: 'disconnect' as const,
      data: { reason: 'Teams connection disconnected by admin' },
    })

    db.delete(oauthTokens).run()

    return { success: true }
  }),

  getMsAccountInfo: base.handler(async ({ context: { username } }) => {
    if (!username) {
      return { connected: false as const, accountInfo: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null }
    }

    let token
    try {
      token = getActiveToken(db)
    } catch {
      return { connected: false as const, accountInfo: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null }
    }
    if (!token) {
      return { connected: false as const, accountInfo: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null }
    }

    const client = createGraphClient({ accessToken: token.accessToken })
    const me = await client.getMe()

    const refreshExpiresAt = new Date(token.expiresAt.getTime() + (90 * 24 - 1) * 60 * 60 * 1000)

    return {
      connected: true as const,
      accountInfo: {
        displayName: me.displayName,
        email: me.mail ?? me.userPrincipalName ?? null,
      },
      accessTokenExpiresAt: token.expiresAt.toISOString(),
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    }
  }),

  exportSession: adminOnly.handler(async () => {
    const token = getActiveToken(db)
    if (!token) {
      throw new ORPCError('NOT_FOUND', { message: 'No active session to export' })
    }

    const payload = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenType: token.tokenType,
      scope: token.scope,
      expiresAt: token.expiresAt.toISOString(),
      exportedAt: new Date().toISOString(),
    }

    const data = Buffer.from(JSON.stringify(payload)).toString('base64')
    return { data }
  }),

  importSession: adminOnly
    .input(z.object({ data: z.string() }))
    .handler(async ({ input }) => {
      let decoded: Record<string, unknown>
      try {
        decoded = JSON.parse(Buffer.from(input.data, 'base64').toString('utf8'))
      } catch {
        throw new ORPCError('BAD_REQUEST', { message: 'Invalid session data: malformed base64 or JSON' })
      }

      if (!decoded.accessToken || !decoded.tokenType || !decoded.scope || !decoded.expiresAt) {
        throw new ORPCError('BAD_REQUEST', { message: 'Invalid session data: missing required fields' })
      }

      const expiresAt = new Date(decoded.expiresAt as string)

      db.delete(oauthTokens).run()

      db.insert(oauthTokens).values({
        accessToken: decoded.accessToken as string,
        refreshToken: decoded.refreshToken ? decoded.refreshToken as string : null,
        tokenType: decoded.tokenType as string,
        scope: decoded.scope as string,
        expiresAt,
      }).run()

      return { success: true }
    }),
}
