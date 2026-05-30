import type { Chat } from '~/types/chat'
import { getChatMembers, getChatTopic } from './graph-helpers'

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getChatDisplayName(chat: Chat, currentUserId?: string | null): string {
  const topic = getChatTopic(chat)
  if (topic) return topic
  if (!currentUserId) return ''
  const members = getChatMembers(chat)
  const other = members.find((m) => m.userId !== currentUserId)
  return other?.displayName ?? 'Unknown'
}

export function getChatInitial(chat: Chat, currentUserId?: string | null): string {
  const name = getChatDisplayName(chat, currentUserId)
  return name ? name.charAt(0).toUpperCase() : ''
}
