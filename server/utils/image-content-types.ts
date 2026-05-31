export const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
}

export const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  ...Object.fromEntries(Object.entries(CONTENT_TYPE_TO_EXT).map(([k, v]) => [v, k])),
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
}
