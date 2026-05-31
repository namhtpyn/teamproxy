import { ORPCError } from '@orpc/server'
import { base } from '../context'
import { getActiveToken } from '../../db/get-active-token'
import type { Database } from '../../db/client'
import type { UserRole } from '#shared/utils/enums'

function resolveActiveToken(db: Database) {
  const token = getActiveToken(db)
  if (!token) {
    throw new ORPCError('UNAUTHORIZED', { message: 'No active Microsoft Graph token' })
  }
  return token
}

const requireSession = base.middleware(async ({ context: { username }, next }) => {
  if (!username) {
    throw new ORPCError('UNAUTHORIZED', { message: 'No session cookie provided' })
  }
  return next()
})

function resolveTokenWithRole(role: UserRole) {
  return base.middleware(async ({ context, next }) => {
    const token = resolveActiveToken(context.db)
    return next({ context: { username: context.username!, accessToken: token.accessToken, role: context.role ?? role } })
  })
}

const resolveToken = resolveTokenWithRole('user')
const resolveAdminToken = resolveTokenWithRole('admin')

const requireAdmin = base.middleware(async ({ context: { role }, next }) => {
  if (role !== 'admin') {
    throw new ORPCError('FORBIDDEN', { message: 'Admin access required' })
  }
    return next({ context: { role: 'admin' as UserRole } })
})

export const authed = base.use(requireSession.concat(resolveToken))

export const adminOnly = base.use(requireSession.concat(requireAdmin))

export const adminAuthed = base.use(requireSession.concat(requireAdmin).concat(resolveAdminToken))
