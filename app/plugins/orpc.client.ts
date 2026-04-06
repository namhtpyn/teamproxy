import type { RouterClient } from '@orpc/server'
import type { AppRouter } from '#server/rpc/router'
import { ORPCError } from '@orpc/server'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { ClientRetryPlugin, DedupeRequestsPlugin, SimpleCsrfProtectionLinkPlugin } from '@orpc/client/plugins'

export default defineNuxtPlugin(() => {
  const link = new RPCLink({
    url: `${window.location.origin}/rpc`,
    headers: () => ({}),
    plugins: [
      // Plugin order matters: CSRF headers must be added before dedupe/retry process requests
      new SimpleCsrfProtectionLinkPlugin(),
      new DedupeRequestsPlugin({
        filter: ({ request }) => request.method === 'GET',
        groups: [{ condition: () => true, context: {} }],
      }),
      new ClientRetryPlugin({
        default: {
          retry: ({ path }) => {
            const fullPath = path.join('.')
            if (fullPath === 'auth.getStatus' || fullPath.startsWith('chats.list') || fullPath.startsWith('chats.getMessages')) {
              return 2
            }
            return 0
          },
          retryDelay: 1000,
          shouldRetry: ({ error }) => {
            const code = error instanceof ORPCError ? error.code : undefined
            return code === 'NETWORK_ERROR' || code === 'TIMEOUT'
          },
        },
      }),
    ],
  })

  const client: RouterClient<AppRouter> = createORPCClient(link)

  return { provide: { orpc: client } }
})
