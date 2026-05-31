import type { ChatMessage, ChatMessageInfo, ChatMessageReaction, ConversationMember } from '@microsoft/microsoft-graph-types'
import type { ChatType, MessageType } from '#shared/utils/enums'
import type { Chat, ChatMember, LastMessagePreview } from '~/types/chat'

export function getMessageContent(msg: ChatMessage): string {
  return msg.body?.content ?? ''
}

export function getSender(msg: ChatMessage): { id: string; displayName: string } | null {
  const user = msg.from?.user
  if (!user) return null
  return { id: user.id ?? '', displayName: user.displayName ?? 'Unknown' }
}

export function getEventDetail(msg: ChatMessage): Record<string, unknown> | null {
  return msg.eventDetail as Record<string, unknown> | null
}

export function getChatMembers(chat: Chat): ChatMember[] {
  return (chat.members ?? []).map((m: ConversationMember) => {
    const ext = m as ConversationMember & { userId?: string | null; email?: string | null }
    const userId = typeof ext.userId === 'string' ? ext.userId : null
    const email = typeof ext.email === 'string' ? ext.email : null
    return {
      id: m.id ?? '',
      displayName: m.displayName ?? 'Unknown',
      userId,
      email,
    }
  })
}

export function getChatTopic(chat: Chat): string | null {
  return chat.topic ?? null
}

export function getChatType(chat: Chat): ChatType {
  return (chat.chatType ?? 'unknownFutureValue') as ChatType
}

export function getLastMessagePreview(chat: Chat): LastMessagePreview | null {
  const preview = chat.lastMessagePreview
  if (!preview) return null
  return {
    id: preview.id ?? '',
    createdDateTime: preview.createdDateTime ?? new Date().toISOString(),
    messageType: (preview.messageType ?? 'message') as MessageType,
    contentType: (preview.body?.contentType ?? 'text') as MessageContentType,
    content: preview.body?.content ?? '',
    senderDisplayName: preview.from?.user?.displayName ?? null,
  }
}

export function getLastMessageReadDateTime(chat: Chat): string | null {
  return chat.viewpoint?.lastMessageReadDateTime ?? null
}

export function setLastMessagePreview(chat: Chat, preview: LastMessagePreview): void {
  chat.lastMessagePreview = {
    id: preview.id,
    createdDateTime: preview.createdDateTime,
    messageType: preview.messageType,
    body: { content: preview.content, contentType: preview.contentType },
    from: preview.senderDisplayName
      ? { user: { id: '', displayName: preview.senderDisplayName } }
      : undefined,
  } as unknown as ChatMessageInfo
}

export function setLastMessageReadDateTime(chat: Chat, dateTime: string): void {
  if (!chat.viewpoint) {
    (chat as unknown as Record<string, unknown>).viewpoint = {
      isHidden: false,
      lastMessageReadDateTime: dateTime,
    }
  } else {
    chat.viewpoint.lastMessageReadDateTime = dateTime
  }
}

// Map legacy reaction type strings to unicode emoji
const REACTION_TYPE_MAP: Record<string, string> = {
  like: '👍',
  heart: '❤️',
  laugh: '😂',
  surprised: '😮',
  sad: '😢',
  angry: '😡',
}

export function resolveReactionEmoji(reactionType: string): string {
  if (reactionType.length > 2 || /[\u{1F000}-\u{1FFFF}]/u.test(reactionType)) return reactionType
  return REACTION_TYPE_MAP[reactionType] ?? reactionType
}

export interface GroupedReaction {
  emoji: string
  reactionType: string
  count: number
  hasOwn: boolean
}

export function groupReactions(
  reactions: ChatMessageReaction[] | undefined,
  msUserId?: string | null,
): GroupedReaction[] {
  if (!reactions?.length) return []
  const map = new Map<string, GroupedReaction>()
  for (const r of reactions) {
    const raw = r.reactionType ?? ''
    const emoji = resolveReactionEmoji(raw)
    const existing = map.get(raw)
    const isOwn = !!msUserId && r.user?.user?.id === msUserId
    if (existing) {
      existing.count++
      if (isOwn) existing.hasOwn = true
    } else {
      map.set(raw, { emoji, reactionType: raw, count: 1, hasOwn: isOwn })
    }
  }
  return Array.from(map.values())
}
