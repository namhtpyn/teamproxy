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

    db.update(oauthTokens).set({ isActive: false }).where(eq(oauthTokens.isActive, true)).run()

    return { success: true }
  }),

  getMsAccountInfo: base.handler(async ({ context: { username } }) => {
    if (!username) {
      return { connected: false as const, accountInfo: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null }
    }

    const token = getActiveToken(db)
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

    const rawRow = db.query.oauthTokens.findFirst({
      where: { AND: [{ isActive: true }, { expiresAt: { gt: new Date() } }] },
    }).sync()

    if (!rawRow) {
      throw new ORPCError('NOT_FOUND', { message: 'No active session to export' })
    }

    const payload = {
      accessToken: rawRow.accessToken,
      refreshToken: rawRow.refreshToken,
      tokenType: rawRow.tokenType,
      scope: rawRow.scope,
      expiresAt: rawRow.expiresAt.toISOString(),
      exportedAt: new Date().toISOString(),
    }

    const data = Buffer.from(JSON.stringify(payload)).toString('base64')
    return { data }
  }),

  importSession: adminOnly
    .input(z.object({ data: z.string() }))
    .handler(async ({ input }) => {
      const decoded = JSON.parse(Buffer.from(input.data, 'base64').toString('utf8'))

      if (!decoded.accessToken || !decoded.tokenType || !decoded.scope || !decoded.expiresAt) {
        throw new ORPCError('BAD_REQUEST', { message: 'Invalid session data: missing required fields' })
      }

      const expiresAt = new Date(decoded.expiresAt)

      const existing = db.query.oauthTokens.findFirst({
        where: { isActive: true },
      }).sync()

      if (existing) {
        db.update(oauthTokens).set({ isActive: false }).where(eq(oauthTokens.isActive, true)).run()
      }

      db.insert(oauthTokens).values({
        accessToken: decoded.accessToken,
        refreshToken: decoded.refreshToken ?? null,
        tokenType: decoded.tokenType,
        scope: decoded.scope,
        expiresAt,
      }).run()

      return { success: true }
    }),
}
