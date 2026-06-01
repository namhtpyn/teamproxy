import { os } from '@orpc/server'
import type { RequestHeadersPluginContext, ResponseHeadersPluginContext } from '@orpc/server/plugins'
import type { UserRole } from '#shared/utils/enums'
import type { createGraphClient } from '../ms-graph/graph-client'

export const base = os.$context<{
  db: import('../db/client').Database
  username?: string
  role?: UserRole
  accessToken?: string
  graphClient?: ReturnType<typeof createGraphClient>
  origin: string
} & RequestHeadersPluginContext & ResponseHeadersPluginContext>()
