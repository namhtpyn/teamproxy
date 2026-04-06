import { eq } from 'drizzle-orm'
import { USER_ROLES } from '#shared/utils/enums'
import { base } from '../context'
import { adminOnly } from '../middleware/auth'
import { db } from '../../db/client'
import { oauthTokens } from '../../db/schema'
import { MS_SCOPE_STRING } from '../../ms-graph/scopes'
import { getActiveToken } from '../../db/get-active-token'

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
    db.update(oauthTokens).set({ isActive: false }).where(eq(oauthTokens.isActive, true)).run()

    return { success: true }
  }),
}
