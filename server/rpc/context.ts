import { os } from '@orpc/server'
import type { RequestHeadersPluginContext, ResponseHeadersPluginContext } from '@orpc/server/plugins'
import type { UserRole } from '#shared/utils/enums'

export const base = os.$context<{
  db: import('../db/client').Database
  username?: string
  role?: UserRole
  accessToken?: string
  origin: string
} & RequestHeadersPluginContext & ResponseHeadersPluginContext>()
