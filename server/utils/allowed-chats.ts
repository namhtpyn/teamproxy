import { db } from '../db/client'

export function getAllowedChats() {
  return db.query.allowedChats.findMany({
    where: { allowed: true },
  }).sync()
}

export function getAllowedChat(chatId: string) {
  return db.query.allowedChats.findFirst({
    where: { chatId },
  }).sync()
}
