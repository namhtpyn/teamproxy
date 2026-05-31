import { graphRequest, GraphAPIError, GRAPH_BASE } from './client'
export { graphRequest } from './client'
export { GraphAPIError } from './client'
export { GraphAuthError } from './client'
export { GRAPH_BASE } from './client'
import type { Chat, ChatMessage, Subscription } from './types'

export interface GraphClientOptions {
  accessToken: string
}

export interface ODataQueryParams {
  $expand?: string
  $filter?: string
  $orderby?: string
  $top?: string | number
  $skip?: string | number
  $select?: string
}

export interface CreateSubscriptionParams {
  changeType: string
  notificationUrl: string
  resource: string
  expirationDateTime: string
  clientState: string
}

export interface RenewSubscriptionParams {
  expirationDateTime: string
}

function toQueryParams(params?: ODataQueryParams): Record<string, string> | undefined {
  if (!params) return undefined
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) result[key] = String(value)
  }
  return result
}

export interface BatchResponseItem {
  id: string
  status: number
  body?: unknown
}

export function createGraphClient({ accessToken }: GraphClientOptions) {
  return {
    async batch(requests: Array<{ id: string; method: string; url: string }>): Promise<BatchResponseItem[]> {
      const data = await graphRequest<{ responses: BatchResponseItem[] }>({
        method: 'POST',
        path: '/$batch',
        body: { requests },
        accessToken,
      })
      return data?.responses ?? []
    },

    async getMe(): Promise<{ id: string; displayName: string; mail: string | null; userPrincipalName: string | null }> {
      const me = await graphRequest<{ id: string; displayName: string; mail: string | null; userPrincipalName: string | null }>({
        method: 'GET',
        path: '/me',
        query: { $select: 'id,displayName,mail,userPrincipalName' },
        accessToken,
      })
      if (!me) throw new GraphAPIError(500, 'no_response', 'Empty response fetching user profile')
      return me
    },
    chats: {
      async list(params?: ODataQueryParams): Promise<{ value: Chat[]; nextLink?: string }> {
        const data = await graphRequest<{ value: Chat[]; '@odata.nextLink'?: string }>({
          method: 'GET',
          path: '/me/chats',
          query: toQueryParams(params),
          accessToken,
        })
        return { value: data?.value ?? [], nextLink: data?.['@odata.nextLink'] }
      },
      async messages(chatId: string, params?: ODataQueryParams): Promise<{ value: ChatMessage[]; nextLink?: string }> {
        const data = await graphRequest<{ value: ChatMessage[]; '@odata.nextLink'?: string }>({
          method: 'GET',
          path: `/chats/${chatId}/messages`,
          query: toQueryParams(params),
          accessToken,
        })
        return { value: data?.value ?? [], nextLink: data?.['@odata.nextLink'] }
      },
      send(chatId: string, body: { contentType: string; content: string }, replyToId?: string, mentions?: Array<{
        id: number
        mentionText: string
        mentioned: { user: { id: string; displayName: string } }
      }>, hostedContents?: Array<{
        temporaryId: string
        contentBytes: string
        contentType: string
      }>): Promise<ChatMessage | undefined> {
        const reqBody: Record<string, unknown> = { body }
        if (replyToId) reqBody.replyToId = replyToId
        if (mentions && mentions.length > 0) reqBody.mentions = mentions
        if (hostedContents && hostedContents.length > 0) {
          reqBody.hostedContents = hostedContents.map(hc => ({
            '@microsoft.graph.temporaryId': hc.temporaryId,
            contentBytes: hc.contentBytes,
            contentType: hc.contentType,
          }))
        }
        return graphRequest<ChatMessage>({
          method: 'POST',
          path: `/chats/${chatId}/messages`,
          body: reqBody,
          accessToken,
        })
      },
      async replyWithQuote(chatId: string, messageId: string, body: { contentType: string; content: string }): Promise<ChatMessage | undefined> {
        return graphRequest<ChatMessage>({
          method: 'POST',
          path: `/chats/${chatId}/messages/replyWithQuote`,
          body: {
            messageIds: [messageId],
            replyMessage: { body },
          },
          accessToken,
        })
      },
      getMessage(resource: string): Promise<ChatMessage | undefined> {
        let apiPath: string
        if (resource.startsWith('/')) {
          apiPath = resource.replace(/^\/v1\.0/, '')
        } else {
          const url = new URL(resource)
          apiPath = url.pathname.replace(/^\/v1\.0/, '')
        }
        return graphRequest<ChatMessage>({
          method: 'GET',
          path: apiPath,
          accessToken,
        })
      },
      async setReaction(chatId: string, messageId: string, reactionType: string): Promise<void> {
        await graphRequest({
          method: 'POST',
          path: `/chats/${chatId}/messages/${messageId}/setReaction`,
          body: { reactionType },
          accessToken,
        })
      },
      async unsetReaction(chatId: string, messageId: string, reactionType: string): Promise<void> {
        await graphRequest({
          method: 'POST',
          path: `/chats/${chatId}/messages/${messageId}/unsetReaction`,
          body: { reactionType },
          accessToken,
        })
      },
      async softDeleteMessage(userId: string, chatId: string, messageId: string): Promise<void> {
        await graphRequest({
          method: 'POST',
          path: `/users/${userId}/chats/${chatId}/messages/${messageId}/softDelete`,
          accessToken,
        })
      },
      async updateMessage(chatId: string, messageId: string, body: { contentType: string; content: string }): Promise<void> {
        await graphRequest({
          method: 'PATCH',
          path: `/chats/${chatId}/messages/${messageId}`,
          body: { body },
          accessToken,
        })
      },
      async pinMessage(chatId: string, messageId: string): Promise<void> {
        await graphRequest({
          method: 'POST',
          path: `/chats/${chatId}/pinnedMessages`,
          body: {
            'message@odata.bind': `https://graph.microsoft.com/v1.0/chats/${chatId}/messages/${messageId}`,
          },
          accessToken,
        })
      },
      async unpinMessage(chatId: string, messageId: string): Promise<void> {
        await graphRequest({
          method: 'DELETE',
          path: `/chats/${chatId}/pinnedMessages/${messageId}`,
          accessToken,
        })
      },
    },
    subscriptions: {
      async create(params: CreateSubscriptionParams): Promise<Subscription> {
        const result = await graphRequest<Subscription>({
          method: 'POST',
          path: '/subscriptions',
          body: params,
          accessToken,
        })
        if (!result) throw new GraphAPIError(500, 'no_response', 'Empty response creating subscription')
        return result
      },
      async renew(id: string, params: RenewSubscriptionParams): Promise<void> {
        return graphRequest({
          method: 'PATCH',
          path: `/subscriptions/${id}`,
          body: params,
          accessToken,
        })
      },
      async delete(id: string): Promise<void> {
        return graphRequest({
          method: 'DELETE',
          path: `/subscriptions/${id}`,
          accessToken,
        })
      },
    },
  }
}
