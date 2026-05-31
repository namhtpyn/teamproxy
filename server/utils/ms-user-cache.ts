let cached: { id: string; displayName: string } | null = null

export function getCachedMsUser() {
  return cached
}

export function setCachedMsUser(user: { id: string; displayName: string }) {
  cached = user
}

export function clearCachedMsUser() {
  cached = null
}
