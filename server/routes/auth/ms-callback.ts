import { defineEventHandler, getQuery, createError } from 'h3'
import { eq, lt } from 'drizzle-orm'
import { db } from '../../db/client'
import { oauthTokens } from '../../db/schema'
import { exchangeToken } from '../../ms-graph/token-exchange'
import { ensureMsSubscriptions } from '../../utils/ensure-ms-subscriptions'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code

  if (!code || typeof code !== 'string') {
    const error = query.error
    const errorDesc = query.error_description
    if (error) {
      throw createError({
        statusCode: 400,
        message: `Microsoft auth failed: ${error} — ${errorDesc ?? 'unknown error'}`,
      })
    }
    throw createError({ statusCode: 400, message: 'Missing authorization code' })
  }

  const redirectUri = `${getRequestURL(event).origin}/auth/ms-callback`

  let data
  try {
    data = await exchangeToken({
      grantType: 'authorization_code',
      code,
      redirectUri,
    })
  } catch (err) {
    console.warn('Token exchange failed:', err)
    return sendRedirect(event, '/settings?error=true')
  }

  const now = new Date()

  db.insert(oauthTokens).values({
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    tokenType: data.token_type,
    scope: data.scope,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    isActive: true,
    updatedAt: now,
  }).run()

  db.delete(oauthTokens)
    .where(lt(oauthTokens.updatedAt, now))
    .run()

  ensureMsSubscriptions().catch(() => {})

  return sendRedirect(event, '/settings?connected=true')
})
