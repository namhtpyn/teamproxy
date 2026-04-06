import { eq } from 'drizzle-orm'
import { consola } from 'consola'
import { db } from '../db/client'
import { oauthTokens } from '../db/schema'
import { decrypt, encrypt } from '../utils/crypto'
import { refreshAccessToken } from '../ms-graph/token-refresh'

export default defineTask({
  meta: {
    name: 'refresh-tokens',
    description: 'Refresh OAuth tokens expiring within 10 minutes',
  },
  async run(_event) {
    const now = new Date()
    const threshold = new Date(now.getTime() + 10 * 60 * 1000)

    const expiring = db.query.oauthTokens.findMany({
      where: {
        AND: [
          { isActive: true },
          { expiresAt: { lte: threshold } },
          { refreshToken: { isNotNull: true } },
        ],
      },
    }).sync()

    if (expiring.length === 0) {
      consola.info('[refresh-tokens] No tokens expiring within 10 minutes')
      return {}
    }

    let refreshed = 0
    let failed = 0

    for (const token of expiring) {
      try {
        if (!token.refreshToken) continue
        const result = await refreshAccessToken(decrypt(token.refreshToken))

        db.update(oauthTokens)
          .set({
            accessToken: encrypt(result.accessToken),
            refreshToken: encrypt(result.refreshToken),
            expiresAt: new Date(Date.now() + result.expiresIn * 1000),
            updatedAt: new Date(),
          })
          .where(eq(oauthTokens.id, token.id))
          .run()

        refreshed++
      } catch (err) {
        consola.error(`[refresh-tokens] Failed to refresh token ${token.id}:`, err)
        db.update(oauthTokens).set({ isActive: false }).where(eq(oauthTokens.id, token.id)).run()
        failed++
      }
    }

    consola.info(`[refresh-tokens] Refreshed: ${refreshed}, Failed: ${failed}`)
    return {}
  },
})
