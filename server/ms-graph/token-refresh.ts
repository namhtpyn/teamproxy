import { exchangeToken } from './token-exchange'

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> {
  const data = await exchangeToken({
    grantType: 'refresh_token',
    refreshToken,
  })

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}
