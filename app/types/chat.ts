import type { Chat as GraphChat, ChatMessage } from '@microsoft/microsoft-graph-types'
import type { MessageContentType, MessageType, SubscriptionStatus } from '#shared/utils/enums'

export interface ChatMember {
  id: string
  displayName: string
  userId: string | null
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

/** Client-side Chat type: raw Graph Chat + canRespond */
export type Chat = GraphChat & { canRespond: boolean }

/** Optimistic message extension */
export type OptimisticChatMessage = ChatMessage & { sendFailed?: string }

/** Visibility table row: raw Graph Chat + admin fields */
export type VisibilityChat = Chat & { allowed: boolean; subscriptionStatus: SubscriptionStatus }

export type VisibilityChatRow = VisibilityChat & { name: string }
