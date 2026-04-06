interface ChatLike {
  topic: string | null
  members: Array<{ userId: string; displayName: string }>
}

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

export function getChatDisplayName(chat: ChatLike, currentUserId?: string | null): string {
  if (chat.topic) return chat.topic
  const other = chat.members.find((m) => m.userId !== currentUserId)
  return other?.displayName ?? 'Unknown'
}

export function getChatInitial(chat: ChatLike, currentUserId?: string | null): string {
  return getChatDisplayName(chat, currentUserId).charAt(0).toUpperCase()
}
