import { lt } from 'drizzle-orm'
import { consola } from 'consola'
import { db } from '../db/client'
import { oauthTokens, sessions } from '../db/schema'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export default defineTask({
  meta: {
    name: 'cleanup-expired',
    description: 'Clean up expired sessions and inactive OAuth tokens',
  },
  async run(_event) {
    const config = useRuntimeConfig()
    const now = new Date()
    const sessionMaxAge = config.sessionMaxAgeDays * MS_PER_DAY
    const sessionThreshold = new Date(now.getTime() - sessionMaxAge)
    const tokenMaxAge = config.tokenInactiveDays * MS_PER_DAY
    const tokenThreshold = new Date(now.getTime() - tokenMaxAge)

    const deletedSessions = db
      .delete(sessions)
      .where(lt(sessions.createdAt, sessionThreshold))
      .run()

    const deletedTokens = db
      .delete(oauthTokens)
      .where(lt(oauthTokens.updatedAt, tokenThreshold))
      .run()

    consola.info(
      `[cleanup-expired] Sessions: ${deletedSessions.changes}, Tokens: ${deletedTokens.changes}`,
    )
    return {}
  },
})
