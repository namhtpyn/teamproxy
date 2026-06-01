import { consola } from 'consola'
import { createGraphClient } from '../../ms-graph/graph-client'
import { liveEventSchema, getEventPublisher } from '../event-bus'
import { updateLastMessageAt } from './ms-subscription-store'

export async function backfillMissedMessages(
  chatId: string,
  since: Date,
  accessToken: string,
): Promise<void> {
  const client = createGraphClient({ accessToken })
  const publisher = getEventPublisher()

  const result = await client.chats.messages(chatId, {
    $filter: `lastModifiedDateTime gt ${since.toISOString()}`,
    $orderby: 'lastModifiedDateTime asc',
    $top: 50,
  })
  const messages = result.value

  if (messages.length === 0) {
    consola.info(`[backfill] No missed messages for chat ${chatId}`)
    return
  }

  for (const message of messages) {
    if (message.eventDetail) {
      consola.info(
        `[backfill] eventDetail type=${(message.eventDetail as Record<string, unknown>)['@odata.type'] ?? 'unknown'}`,
      )
    }

    const parsed = liveEventSchema.safeParse({ type: 'message', chatId, data: message })
    if (parsed.success) {
      publisher.publish('chat:*', parsed.data)
    }
  }

  const lastMessage = messages[messages.length - 1]!
  if (lastMessage.createdDateTime) {
    updateLastMessageAt(chatId, new Date(lastMessage.createdDateTime))
  }

  consola.info(`[backfill] Published ${messages.length} missed messages for chat ${chatId}`)
}
