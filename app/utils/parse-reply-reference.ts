import type { ChatMessage } from '@microsoft/microsoft-graph-types'

export function parseReplyReference(attachments: ChatMessage['attachments']): { senderName: string; previewText: string } | null {
  if (!attachments || attachments.length === 0) return null
  const msgRef = attachments.find(a => a.contentType === 'messageReference')
  if (!msgRef) return null
  try {
    const data = typeof msgRef.content === 'string' ? JSON.parse(msgRef.content) : msgRef.content
    return {
      senderName: data?.messageSender?.user?.displayName ?? 'Unknown',
      previewText: (data?.messagePreview ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 80),
    }
  }
  catch {
    return null
  }
}
