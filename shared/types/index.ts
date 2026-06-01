import type { Chat as GraphChat, ChatMessage } from '@microsoft/microsoft-graph-types'
import type { MessageContentType, MessageType, SubscriptionStatus } from '../utils/enums'

// --- Chat types ---

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

/** Chat with canRespond flag (used in chat list) */
export type ChatListItem = GraphChat & { canRespond: boolean }

/** Chat with visibility fields (used in admin settings) */
export type VisibilityChat = GraphChat & {
  allowed: boolean
  canRespond: boolean
  subscriptionStatus: SubscriptionStatus
}

// --- Message types ---

/** Optimistic message extension for client-side send state */
export type OptimisticChatMessage = ChatMessage & { sendFailed?: string }

// --- API response types ---

export interface ChatListResponse {
  chats: ChatListItem[]
}

export interface MessageListResponse {
  messages: ChatMessage[]
  nextCursor?: string
}

export interface SendMessageResponse {
  message: ChatMessage
}

export interface VisibilityListResponse {
  chats: VisibilityChat[]
  nextCursor?: string
}

export interface SetVisibilityResponse {
  success: boolean
  subscriptionStatus: SubscriptionStatus
  subscriptionError?: string
}

export interface AuthStatus {
  authenticated: boolean
  user: { id: string; displayName: string | null; role?: string } | null
}

export interface MsConnectionStatus {
  connected: boolean
  expiresAt: string | null
}

export interface MsAccountInfo {
  connected: boolean
  accountInfo: { displayName: string; email: string | null } | null
  accessTokenExpiresAt: string | null
  refreshTokenExpiresAt: string | null
}

export interface SubscriptionInfo {
  chatId: string
  msSubscriptionId: string
  expiresAt: string
}

export interface SubscriptionListResponse {
  subscriptions: SubscriptionInfo[]
}
