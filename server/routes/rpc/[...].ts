import { RPCHandler } from '@orpc/server/fetch'
import { ORPCError, onError } from '@orpc/server'
import { RequestHeadersPlugin, ResponseHeadersPlugin, SimpleCsrfProtectionHandlerPlugin } from '@orpc/server/plugins'
import { RatelimitHandlerPlugin } from '@orpc/experimental-ratelimit'
import { consola } from 'consola'
import { appRouter } from '../../rpc/router'
import { db } from '../../db/client'
import { resolveSession } from '../../utils/session-store'
import { GraphAPIError, GraphAuthError } from '../../ms-graph/client'

const handler = new RPCHandler(appRouter, {
  plugins: [new SimpleCsrfProtectionHandlerPlugin(), new RequestHeadersPlugin(), new ResponseHeadersPlugin(), new RatelimitHandlerPlugin()],
  interceptors: [
    onError((error) => {
      if (error instanceof ORPCError) return
      if (error instanceof GraphAuthError) {
        throw new ORPCError('UNAUTHORIZED', { message: error.message })
      }
      if (error instanceof GraphAPIError) {
        if (error.status === 404) {
          throw new ORPCError('NOT_FOUND', { message: error.message })
        }
        if (error.status === 429) {
          throw new ORPCError('TOO_MANY_REQUESTS', { message: error.message })
        }
        throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Microsoft Graph API error' })
      }
      consola.error('[oRPC]', error)
    }),
  ],
})

export default defineEventHandler(async (event) => {
  const request = toWebRequest(event)

  const rawSession = getCookie(event, 'session') ?? undefined
  const session = rawSession ? await resolveSession(rawSession) : undefined

  const origin = getRequestURL(event).origin

  const { response } = await handler.handle(request, {
    prefix: '/rpc',
    context: {
      db,
      username: session?.username,
      role: session?.role,
      origin,
    },
  })

  if (response) {
    return response
  }

  setResponseStatus(event, 404, 'Not Found')
  return 'Not found'
})
