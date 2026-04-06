import { graphRequest, graphPaginate, GraphAPIError } from './client'
import type { Chat, ChatMessage, Channel, Team, Subscription } from './types'

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

export function createGraphClient({ accessToken }: GraphClientOptions) {
  return {
    chats: {
      list(params?: ODataQueryParams): AsyncGenerator<Chat[]> {
        return graphPaginate<Chat>({
          method: 'GET',
          path: '/me/chats',
          query: params as Record<string, string>,
          accessToken,
        })
      },
      messages(chatId: string, params?: ODataQueryParams): AsyncGenerator<ChatMessage[]> {
        return graphPaginate<ChatMessage>({
          method: 'GET',
          path: `/chats/${chatId}/messages`,
          query: params as Record<string, string>,
          accessToken,
        })
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
      getMessage(resource: string): Promise<unknown> {
        let apiPath: string
        if (resource.startsWith('/')) {
          apiPath = resource.replace(/^\/v1\.0/, '')
        } else {
          const url = new URL(resource)
          apiPath = url.pathname.replace(/^\/v1\.0/, '')
        }
        return graphRequest<unknown>({
          method: 'GET',
          path: apiPath,
          accessToken,
        })
      },
    },
    teams: {
      async list(): Promise<Team[]> {
        const data = await graphRequest<{ value: Team[] }>({
          method: 'GET',
          path: '/me/joinedTeams',
          accessToken,
        })
        return data?.value ?? []
      },
      channels: {
        list(teamId: string): AsyncGenerator<Channel[]> {
          return graphPaginate<Channel>({
            method: 'GET',
            path: `/teams/${teamId}/channels`,
            accessToken,
          })
        },
        messages: {
          list(teamId: string, channelId: string, params?: ODataQueryParams): AsyncGenerator<ChatMessage[]> {
            return graphPaginate<ChatMessage>({
              method: 'GET',
              path: `/teams/${teamId}/channels/${channelId}/messages`,
              query: params as Record<string, string>,
              accessToken,
            })
          },
        },
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
