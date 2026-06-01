import { db } from '../../db/client'
import { allowedChats } from '../../db/schema'
import { eq, inArray, and, isNotNull } from 'drizzle-orm'

export type MsSubscribedChat = {
  id: string
  chatId: string
  msSubscriptionId: string
  clientState: string
  subscriptionExpiresAt: Date
  allowed: boolean
}

type AllowedChatRow = {
  id: string
  chatId: string
  msSubscriptionId: string | null
  clientState: string | null
  subscriptionExpiresAt: Date | null
  allowed: boolean
}

function toMsSubscribedChat(row: AllowedChatRow): MsSubscribedChat | null {
  if (!row.msSubscriptionId || !row.clientState || !row.subscriptionExpiresAt) return null
  return {
    id: row.id,
    chatId: row.chatId,
    msSubscriptionId: row.msSubscriptionId,
    clientState: row.clientState,
    subscriptionExpiresAt: row.subscriptionExpiresAt,
    allowed: row.allowed,
  }
}

export function getMsSubscribedChats(): MsSubscribedChat[] {
  const rows = db
    .select()
    .from(allowedChats)
    .where(and(eq(allowedChats.allowed, true), isNotNull(allowedChats.msSubscriptionId)))
    .all()

  return rows.flatMap((r) => {
    const sub = toMsSubscribedChat(r)
    return sub ? [sub] : []
  })
}

export function getMsSubscriptionsByClientStates(
  clientStates: string[],
): Map<string, MsSubscribedChat> {
  if (clientStates.length === 0) return new Map()
  const rows = db
    .select()
    .from(allowedChats)
    .where(inArray(allowedChats.clientState, clientStates))
    .all()

  const map = new Map<string, MsSubscribedChat>()
  for (const row of rows) {
    const chat = toMsSubscribedChat(row)
    if (chat) map.set(chat.clientState, chat)
  }
  return map
}

export function updateMsSubscription(
  chatId: string,
  patch: {
    msSubscriptionId?: string | null
    clientState?: string | null
    subscriptionExpiresAt?: Date | null
  },
): void {
  db.update(allowedChats).set(patch).where(eq(allowedChats.chatId, chatId)).run()
}

export function updateLastMessageAt(chatId: string, timestamp: Date): void {
  db.update(allowedChats).set({ lastMessageAt: timestamp }).where(eq(allowedChats.chatId, chatId)).run()
}

export function getLastMessageAt(chatId: string): Date | null {
  const row = db
    .select({ lastMessageAt: allowedChats.lastMessageAt })
    .from(allowedChats)
    .where(eq(allowedChats.chatId, chatId))
    .get()
  return row?.lastMessageAt ?? null
}

export function clearMsSubscription(chatId: string): void {
  db.update(allowedChats)
    .set({ msSubscriptionId: null, clientState: null, subscriptionExpiresAt: null })
    .where(eq(allowedChats.chatId, chatId))
    .run()
}
