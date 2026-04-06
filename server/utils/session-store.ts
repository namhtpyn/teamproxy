import { db } from '../db/client'
import { sessions } from '../db/schema'
import { eq } from 'drizzle-orm'
import type { UserRole } from '#shared/utils/enums'

export function createSession(username: string, role: UserRole): string {
  const token = crypto.randomUUID()
  db.insert(sessions).values({ token, username, role }).run()
  return token
}

export function resolveSession(
  token: string,
): { username: string; role: UserRole } | undefined {
  const config = useRuntimeConfig()
  const threshold = new Date(Date.now() - config.sessionMaxAgeDays * 86_400_000)
  const row = db.query.sessions.findFirst({
    where: { AND: [{ token }, { createdAt: { gte: threshold } }] },
  }).sync()
  return row ? { username: row.username, role: row.role as UserRole } : undefined
}

export function deleteSession(token: string): void {
  db.delete(sessions).where(eq(sessions.token, token)).run()
}
