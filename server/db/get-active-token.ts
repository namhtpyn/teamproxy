import type { Database } from './client'

export function getActiveToken(db: Database, expiresAfter: Date = new Date()) {
  const token = db.query.oauthTokens.findFirst({
    where: {
      AND: [{ isActive: true }, { expiresAt: { gt: expiresAfter } }],
    },
  }).sync()
  return token
}
