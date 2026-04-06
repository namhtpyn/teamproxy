import type { ChatType, MessageContentType, MessageType, SubscriptionStatus } from '#shared/utils/enums'

export interface ChatMember {
  id: string
  displayName: string
  userId: string
  email: string | null
}

export interface LastMessagePreview {
  id: string
  createdDateTime: string
  messageType: MessageType
  contentType: MessageContentType
  content: string
  senderDisplayName: string | null
}

export interface Chat {
  id: string
  chatType: ChatType
  topic: string | null
  webUrl: string | null
  createdDateTime: string
  lastUpdatedDateTime: string
  isHidden: boolean
  lastMessageReadDateTime: string | null
  members: ChatMember[]
  lastMessagePreview: LastMessagePreview | null
  canRespond: boolean
}

export interface VisibilityChat {
  id: string
  topic: string
  chatType: ChatType
  allowed: boolean
  canRespond: boolean
  members: string[]
  subscriptionStatus: SubscriptionStatus
}

export interface VisibilityChatRow extends VisibilityChat {
  name: string
}

export interface Message {
  id: string
  replyToId: string | null
  messageType: MessageType
  contentType: MessageContentType
  content: string
  createdDateTime: string
  sender: { id: string; displayName: string } | null
  sendFailed?: string
}
