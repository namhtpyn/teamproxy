import { z } from 'zod'
import { MemoryPublisher } from '@orpc/experimental-publisher/memory'

export const liveEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), chatId: z.string(), data: z.object({
    id: z.string(),
  }).passthrough().nullable() }),
  z.object({ type: z.literal('error'), chatId: z.string().optional(), data: z.object({ resource: z.string() }).passthrough() }),
  z.object({ type: z.literal('visibility'), chatId: z.string(), data: z.object({ allowed: z.boolean() }) }),
  z.object({ type: z.literal('respond'), chatId: z.string(), data: z.object({ canRespond: z.boolean() }) }),
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
