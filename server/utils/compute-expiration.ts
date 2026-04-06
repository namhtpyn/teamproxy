export function computeExpiration(): string {
  // Max 1 hour for chat message subscriptions
  const expiration = new Date()
  expiration.setMinutes(expiration.getMinutes() + 55)
  return expiration.toISOString()
}
