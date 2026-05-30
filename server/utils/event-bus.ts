import { z } from 'zod'
import { MemoryPublisher } from '@orpc/experimental-publisher/memory'

export const messageEventSchema = z.object({
  type: z.literal('message'),
  chatId: z.string(),
  data: z.object({ id: z.string() }).passthrough().nullable(),
})

export const visibilityEventSchema = z.object({
  type: z.literal('visibility'),
  chatId: z.string(),
  data: z.object({ allowed: z.boolean() }),
})

export const respondEventSchema = z.object({
  type: z.literal('respond'),
  chatId: z.string(),
  data: z.object({ canRespond: z.boolean() }),
})

export const disconnectEventSchema = z.object({
  type: z.literal('disconnect'),
  chatId: z.string().optional(),
  data: z.object({ reason: z.string() }),
})

export const liveEventSchema = z.discriminatedUnion('type', [
  messageEventSchema,
  z.object({ type: z.literal('error'), chatId: z.string().optional(), data: z.object({ resource: z.string() }).passthrough() }),
  visibilityEventSchema,
  respondEventSchema,
  disconnectEventSchema,
])

type ChatMessageEvent = z.infer<typeof liveEventSchema>

let publisher: MemoryPublisher<Record<string, ChatMessageEvent>> | null = null

export function getEventPublisher(): MemoryPublisher<Record<string, ChatMessageEvent>> {
  if (!publisher) {
    publisher = new MemoryPublisher<Record<string, ChatMessageEvent>>({
      resumeRetentionSeconds: 300,
    })
  }
  return publisher
}
