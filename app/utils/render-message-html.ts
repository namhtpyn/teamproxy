import DOMPurify from 'dompurify'
import { proxyGraphImageUrls } from './graph-image-proxy'

function replaceParagraphsOutsideTables(html: string): string {
  // Split on <table>...</table> blocks, only transform <p> outside tables
  const parts = html.split(/(<table[\s\S]*?<\/table>)/gi)
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part
      return part
        .replace(/<p>/gi, '')
        .replace(/<\/p>/gi, '<br>')
    })
    .join('')
}

export function renderMessageHtml(rawContent: string): string {
  if (!rawContent) return ''
  const raw = proxyGraphImageUrls(rawContent)
    .replace(/<emoji[^>]*\balt=["']([^"']*)["'][^>]*>/gi, '$1')
    .replace(/<at[^>]*>([^<]*)<\/at>/gi, '<span style="color:#c24e00;font-weight:600">@$1</span>')
  const withoutParagraphs = replaceParagraphsOutsideTables(raw)
  const styled = withoutParagraphs
    .replace(/<table/gi, '<table style="border-collapse:collapse;width:100%;margin:4px 0;font-size:inherit"')
    .replace(/<td/gi, '<td style="border:1px solid rgba(128,128,128,0.3);padding:4px 8px"')
    .replace(/<th/gi, '<th style="border:1px solid rgba(128,128,128,0.3);padding:4px 8px;font-weight:600;background:rgba(128,128,128,0.1)"')
    .replace(/(<img[^>]*?)>/gi, '$1 class="inline-chat-img" style="max-width:100%;max-height:200px;border-radius:8px;display:block;margin:4px 0;cursor:zoom-in;object-fit:contain" loading="lazy">')
    .replace(/<a\s+/gi, '<a target="_blank" rel="noopener noreferrer" style="color:#6264a7" ')
    .replace(/<br>\s*$/i, '')
    .trim()
  if (import.meta.client) {
    return DOMPurify.sanitize(styled, { ADD_ATTR: ['target', 'loading'] })
  }
  return styled
}
