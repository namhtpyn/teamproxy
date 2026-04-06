import { decrypt } from '../utils/crypto'
import type { Database } from './client'

export function getActiveToken(db: Database, expiresAfter: Date = new Date()) {
  const token = db.query.oauthTokens.findFirst({
    where: {
      AND: [{ isActive: true }, { expiresAt: { gt: expiresAfter } }],
    },
  }).sync()
  if (token) {
    return {
      ...token,
      accessToken: decrypt(token.accessToken),
      refreshToken: token.refreshToken ? decrypt(token.refreshToken) : null,
    }
  }
  return token
}
