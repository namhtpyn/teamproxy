import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const oauthTokens = sqliteTable(
  'oauth_tokens',
  {
    id: text('id')
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    tokenType: text('token_type').default('Bearer').notNull(),
    scope: text('scope').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow().notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).defaultNow().notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  },
  (table) => [index('oauth_tokens_active_expires').on(table.isActive, table.expiresAt)],
)

