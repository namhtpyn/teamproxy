import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const allowedChats = sqliteTable(
  'allowed_chats',
  {
    id: text('id')
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    chatId: text('chat_id').notNull().unique(),
    topic: text('topic').notNull().default(''),
    chatType: text('chat_type').notNull().default(''),
    allowed: integer('allowed', { mode: 'boolean' }).notNull().default(false),
    canRespond: integer('can_respond', { mode: 'boolean' }).notNull().default(false),
    msSubscriptionId: text('ms_subscription_id').unique(),
    clientState: text('client_state'),
    subscriptionExpiresAt: integer('subscription_expires_at', { mode: 'timestamp' }),
    lastMessageAt: integer('last_message_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('allowed_chats_client_state').on(table.clientState),
  ],
)

