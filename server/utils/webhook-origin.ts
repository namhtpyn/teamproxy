let cachedOrigin: string | null = null

export function getWebhookOrigin(): string | null {
  return cachedOrigin
}

export function setWebhookOrigin(origin: string): void {
  cachedOrigin = origin
}
