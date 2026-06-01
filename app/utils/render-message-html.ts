import DOMPurify from 'dompurify'
import { proxyGraphImageUrls } from './graph-image-proxy'

export function renderMessageHtml(rawContent: string): string {
  if (!rawContent) return ''
  const raw = proxyGraphImageUrls(rawContent)
    .replace(/<emoji[^>]*\balt=["']([^"']*)["'][^>]*>/gi, '$1')
    .replace(/<at[^>]*>([^<]*)<\/at>/gi, '<span style="color:#c24e00;font-weight:600">@$1</span>')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '<br>')
    .replace(/(<img[^>]*?)>/gi, '$1 class="inline-chat-img" style="max-width:100%;max-height:200px;border-radius:8px;display:block;margin:4px 0;cursor:zoom-in;object-fit:contain" loading="lazy">')
    .replace(/<a\s+/gi, '<a target="_blank" rel="noopener noreferrer" style="color:#6264a7" ')
    .replace(/<br>\s*$/i, '')
    .trim()
  if (import.meta.client) {
    return DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'loading'] })
  }
  return raw
}
