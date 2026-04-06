import { consola } from 'consola'
import { z } from 'zod'
import { MS_SCOPE_STRING } from './scopes'
import { TOKEN_ENDPOINT } from './types'

export const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  scope: z.string(),
  token_type: z.string(),
})

export type TokenResponse = z.infer<typeof tokenResponseSchema>

export interface TokenExchangeParams {
  grantType: 'authorization_code' | 'refresh_token'
  code?: string
  refreshToken?: string
  redirectUri?: string
}

export async function exchangeToken(
  params: TokenExchangeParams,
): Promise<TokenResponse> {
  const config = useRuntimeConfig()
  const tenantId = config.msTenantId
  const clientId = config.msClientId
  const clientSecret = config.msClientSecret

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: params.grantType,
    scope: MS_SCOPE_STRING,
  })

  if (params.code) body.set('code', params.code)
  if (params.refreshToken) body.set('refresh_token', params.refreshToken)
  if (params.redirectUri) body.set('redirect_uri', params.redirectUri)

  const response = await fetch(`${TOKEN_ENDPOINT}/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const error = await response.text()
    consola.error(`Token exchange failed (${response.status}):`, error)
    throw new Error('Microsoft authentication failed')
  }

  const data = await response.json()
  const parsed = tokenResponseSchema.safeParse(data)
  if (!parsed.success) {
    consola.error('Invalid token response shape:', data)
    throw new Error('Microsoft authentication failed')
  }
  return parsed.data
}
