export type { ChatMember, LastMessagePreview, OptimisticChatMessage } from '#shared/types'
export type { ChatListItem as Chat } from '#shared/types'
export type { VisibilityChat } from '#shared/types'
import type { VisibilityChat } from '#shared/types'

/** Client-computed name field for visibility table rows */
export type VisibilityChatRow = VisibilityChat & { name: string }
