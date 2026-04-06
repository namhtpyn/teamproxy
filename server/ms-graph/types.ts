import type { ChatType, MessageContentType, MessageType } from '#shared/utils/enums'
export type { MessageType }

export interface GraphRequestOptions {
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH'
  path: string
  body?: unknown
  query?: Record<string, string>
  accessToken: string
}

export interface GraphPaginationResponse<T> {
  value: T[]
  '@odata.nextLink'?: string
}

export interface ODataError {
  error: {
    code: string
    message: string
  }
}

export type { TokenResponse } from './token-exchange'

export const TOKEN_ENDPOINT = 'https://login.microsoftonline.com'

type ChannelMembershipType = 'standard' | 'private' | 'unknownFutureValue'

interface GraphUser {
  id: string
  displayName: string
  userId?: string
  email?: string
  emailAddress?: string
}

export interface GraphChatMember {
  id: string
  displayName: string
  userId: string
  email: string | null
}

interface GraphMessageBody {
  contentType: MessageContentType
  content: string
}

interface GraphChatMessagePreview {
  id: string
  createdDateTime: string
  messageType: MessageType
  body?: GraphMessageBody
  from?: { user?: GraphUser }
}

interface GraphChatViewpoint {
  isHidden: boolean
  lastMessageReadDateTime: string | null
}

export interface GraphChat {
  id: string
  chatType: ChatType
  topic: string | null
  webUrl: string | null
  createdDateTime: string
  lastUpdatedDateTime: string
  members: GraphChatMember[]
  lastMessagePreview: GraphChatMessagePreview | null
  viewpoint: GraphChatViewpoint | null
}

export interface GraphChatMessage {
  id: string
  replyToId?: string
  messageType?: MessageType
  body: GraphMessageBody | null
  createdDateTime: string
  from: { user?: GraphUser } | null
  attachments?: Array<{
    id: string
    contentType: string
    name: string
    contentUrl: string
    size: number
  }>
  lastModifiedDateTime?: string
}

export interface GraphChannel {
  id: string
  displayName: string
  description: string | null
  isFavoriteByDefault: boolean | null
  email: string | null
  createdDateTime: string
  membershipType: ChannelMembershipType
}

export interface GraphTeam {
  id: string
  displayName: string
  description?: string
  isArchived: boolean | null
  createdDateTime: string
  memberSettings?: unknown
  guestSettings?: unknown
  messagingSettings?: unknown
  funSettings?: unknown
}

export interface GraphSubscription {
  id: string
  resource: string
  changeType: string
  expirationDateTime: string
  notificationUrl?: string
  clientState: string
  lifecycleNotificationUrl?: string
}

