import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  username: text('username').notNull(),
  role: text('role', { enum: ['admin', 'user'] })
    .notNull()
    .default('user'),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow().notNull(),
}, (table) => [
  index('sessions_created_at_idx').on(table.createdAt),
])

