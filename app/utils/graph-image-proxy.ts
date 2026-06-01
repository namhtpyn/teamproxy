/** Replace Graph API image URLs with local proxy URLs (for display) */
export function proxyGraphImageUrls(html: string): string {
  return html.replace(
    /(<img[^>]*\bsrc=["'])(https:\/\/graph\.microsoft\.com\/v1\.0\/)([^"']*)(["'][^>]*>)/gi,
    (_, prefix, _baseUrl, apiPath, suffix) => `${prefix}/api/graph-image?path=${encodeURIComponent(apiPath)}${suffix}`,
  )
}

/** Replace local proxy URLs back to Graph API URLs (for editing/saving) */
export function restoreGraphImageUrls(html: string): string {
  return html.replace(
    /(<img[^>]*\bsrc=["'])\/api\/graph-image\?path=([^"']*)(["'][^>]*>)/gi,
    (_, prefix, encodedPath, suffix) => `${prefix}https://graph.microsoft.com/v1.0/${decodeURIComponent(encodedPath)}${suffix}`,
  )
}
