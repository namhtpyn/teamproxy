export const CHAT_TYPES = ['oneOnOne', 'group', 'meeting', 'unknownFutureValue'] as const
export type ChatType = (typeof CHAT_TYPES)[number]

export const MESSAGE_TYPES = ['message', 'chatEvent', 'typing', 'unknownFutureValue', 'systemEventMessage'] as const
export type MessageType = (typeof MESSAGE_TYPES)[number]

export const MESSAGE_CONTENT_TYPES = ['text', 'html'] as const
export type MessageContentType = (typeof MESSAGE_CONTENT_TYPES)[number]

export const USER_ROLES = ['admin', 'user'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const MS_SUBSCRIPTION_STATUSES = ['active', 'expired', 'none'] as const
export type SubscriptionStatus = (typeof MS_SUBSCRIPTION_STATUSES)[number]
