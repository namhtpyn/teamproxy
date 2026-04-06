import type { SubscriptionStatus } from '#shared/utils/enums'

export function getMsSubscriptionStatus(
  sub: { msSubscriptionId: string | null; subscriptionExpiresAt: Date | null } | undefined,
): SubscriptionStatus {
  if (!sub?.msSubscriptionId) return 'none'
  if (sub.subscriptionExpiresAt && sub.subscriptionExpiresAt > new Date()) return 'active'
  return 'expired'
}
