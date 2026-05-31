import { db } from '../db/client'
import { allowedChats } from '../db/schema'
import type { InferSelectModel } from 'drizzle-orm'

type AllowedChat = InferSelectModel<typeof allowedChats>

let cache: { data: AllowedChat[]; expiresAt: number } | null = null
const TTL_MS = 5000

export function getAllowedChats() {
  if (cache && Date.now() < cache.expiresAt) return cache.data
  const data = db.query.allowedChats.findMany({
    where: { allowed: true },
  }).sync()
  cache = { data, expiresAt: Date.now() + TTL_MS }
  return data
}

export function getAllowedChat(chatId: string) {
  return db.query.allowedChats.findFirst({
    where: { chatId },
  }).sync()
}

export function invalidateAllowedChatsCache() {
  cache = null
}
