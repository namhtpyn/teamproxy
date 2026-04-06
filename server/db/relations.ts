import { oauthTokens } from './schema/oauth-tokens'
import { sessions } from './schema/sessions'
import { allowedChats } from './schema/allowed-chats'
import { defineRelations } from 'drizzle-orm'

// No cross-table relations needed — each table is queried independently.
// Sessions are keyed by token, OAuth tokens by active flag, allowed_chats by chatId.
// If cross-table joins become necessary, define relations here.
export const relationsMap = defineRelations(
  { oauthTokens, sessions, allowedChats },
  () => ({}),
)
