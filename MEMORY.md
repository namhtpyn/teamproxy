# MEMORY.md

## Nuxt UI v4

- Must install `tailwindcss` as peer dep, create `app/assets/css/main.css` with `@import "tailwindcss"` + `@import "@nuxt/ui"`, add `css: ['~/assets/css/main.css']` to nuxt.config, wrap app.vue with `<UApp>`
- `UFormField` renders labels horizontally — inputs need `class="w-full"`
- `UAlert` default slot content gets swallowed — use `:title` prop

## Nuxt Config

- Env vars need `NUXT_` prefix — `MS_CLIENT_ID` doesn't work, must be `NUXT_MS_CLIENT_ID`
- Exception: `DATABASE_URL` read directly by `process.env` in db client
- `runtimeConfig` private values are server-only; `public` sub-key is client-accessible

## Microsoft Graph

- Chat permissions require admin consent for enterprise Entra ID
- Scope mismatch causes `invalid_grant` on refresh — refresh MUST use same scopes as authorization
- Webhook subscriptions for chat messages max 1 hour — `computeExpiration` set to 55 min
- Subscription management is fully automated (no manual `subscribeAll`): `server/plugins/ensure-ms-subscriptions.ts` captures origin on first HTTP request and triggers initial ensure; cron `*/15 * * * *` calls `ensureMsSubscriptions()` which both renews expiring AND creates missing subscriptions for allowed chats
- `ensureMsSubscriptions()` in `server/utils/ensure-ms-subscriptions.ts` — single entry point for renew + create. Renewal works without origin (Graph PATCH), creation needs origin (cached in `server/utils/webhook-origin.ts`)
- `createMsSubscription()` moved to `server/utils/create-ms-subscription.ts` — no longer takes `origin` param, reads from `getWebhookOrigin()` cache
- `subscribeAll`, `subscribeToChat` RPC procedures REMOVED — replaced by automatic ensure on startup + cron
- `subscriptions.renew` RPC procedure REMOVED — cron handles it. `subscriptions.list` kept for admin visibility
- Webhook validation: MS Graph sends POST (not GET) with `validationToken` as query param
- Notifications use OData resource format: `chats('id')/messages('msgId')` not REST paths — parse with regex
- `login.microsoftonline.com` is token endpoint base; tenant-specific: `/{tenantId}/oauth2/v2.0/token`

## oRPC

- Built-in SSE via `EventPublisher` + `async function*` handler + `for await...of` on client
- `EventPublisher` (synchronous, no resume) vs `MemoryPublisher` (resume but has module resolution issues)
- Client type derivation: `RouterClient<T>` type with `~orpc` discriminator pattern; check docs for latest approach
- `onError` interceptor on RPCHandler can normalize errors before client receives them
- `os.lazy()` has type constraint conflicts with `DecoratedProcedure` — use standalone `lazy()` from `@orpc/server`
- Middleware composition uses `.concat()` (NOT `.use()` which is for procedure builders)
- `SimpleCsrfProtectionHandlerPlugin` implicitly disables `strictGetMethodPluginEnabled`
- `resolveToken` middleware narrows `username` to `string` via `context.username!` in context merge
- `origin` is non-optional in base context (dynamically resolved from `getRequestURL(event).origin` in RPC handler)
- `ORPCError` instances should be skipped in `onError` interceptor (intentional control flow, not system errors)

## Drizzle ORM v1 beta (node-sqlite sync driver)

- **CRITICAL**: `drizzle-orm/node-sqlite` uses `node:sqlite` `DatabaseSync` — ALL operations are synchronous
- **Write queries** (`insert`, `update`, `delete`) return query builders — MUST call `.run()` to execute
- **Read queries** (`db.query.*`) return `SQLiteSyncRelationalQuery` — MUST call `.sync()` to execute
- **`db.select().from().where()`** returns query builder — MUST call `.all()` or `.get()` to execute
- **`await` on sync operations is a no-op** — it does NOT execute the query. This was the root cause of all DB writes silently failing
- `db.transaction()` sync callbacks work but `.run()` still needed inside — prefer no-transaction for simple ops
- `{ mode: 'timestamp' }` stores Date as milliseconds internally
- Where clauses use object-filter syntax: `{ AND: [{ col: val }] }` not callbacks; multiple object props are implicitly ANDed
- **`db.query.*.where()` does NOT support SQL builders** like `eq()`/`and()` — use object-filter syntax only
- No need to pass `schema` to `drizzle()` constructor — only `relations` is required
- `db.query` where clause doesn't support SQL operators like `isNotNull()` — use `db.select().from().where()` for those
- `defineRelations()` with empty body `() => ({})` registers tables for `db.query.*` API
- Use `index()` and `uniqueIndex()` in 3rd arg of `sqliteTable()` for secondary indexes
- Use `.unique()` on column defs for single-column unique constraints
- Relational query `where` uses `{ col: { gte: value } }` syntax — no need to import `gte`/`eq` etc.

## Encryption

- AES-256-GCM via `server/utils/crypto.ts` — `encrypt()`/`decrypt()` functions
- Key derivation: `createHash('sha256').update(secret).digest()` (not zero-padding)
- Format: `{iv_hex}:{authTag_hex}:{ciphertext_hex}` — throws on non-encrypted input (no backward compat)
- `ENCRYPTION_KEY` env var → `NUXT_ENCRYPTION_KEY` in runtimeConfig, validated at startup (min 16 chars)
- All token writes go through `encrypt()`, reads through `decrypt()`
- Token exchange response validated with Zod schema before use

## Infra

- Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:3000`) works without account
- **NEVER kill the `tunnel` tmux session** — it persists across conversations
- tmux sessions persist dev server across commands
- Stale cookies after DB reset cause auth confusion — clear cookies or handle gracefully
- Security headers via `nitro.routeRules` (not `@nuxtjs/security` module) — includes HSTS, CSP, X-Frame-Options, etc.
- Rate limiting: namespaced via `rateLimit(ip, namespace)` — `'login'` and `'image'` use separate counters
- RPC rate limit middleware in `server/rpc/middleware/rate-limit.ts` — `rateLimited` (20/min)
- RPC rate limiters in `server/utils/rpc-ratelimit.ts`; `RatelimitHandlerPlugin` on RPCHandler for HTTP headers
- Image proxy (`/api/graph-image`) validates path contains `/hostedContents/` AND ends with `/$value` (full Graph path like `/chats/{id}/messages/{id}/hostedContents/{id}/$value`), validates `image/*` content-type, rate-limited (separate namespace)
- RPC handler uses `getRequestURL(event).origin` (NOT runtimeConfig) to dynamically get the URL — never hardcode `webhookBase`
- Login uses `timingSafeEqual` for both username and password comparison
- `AppMentionPicker.vue` uses text interpolation + CSS classes (not `v-html`) for highlight
- Webhook validation: batch `getMsSubscriptionsByClientStates()` then reject 403 on unknown
- `graph_subscriptions` table merged into `allowed_chats` (ms_subscription_id, client_state, subscription_expires_at columns)
- DB cleanup task runs daily at 3am (configurable via `sessionMaxAgeDays`/`tokenInactiveDays`)
- `devServer.host` always `0.0.0.0` (no env var gating). No `vite.server.allowedHosts` needed.
- Hardcoded values (session max age, webhook base, rate limits, cleanup thresholds) configurable via `runtimeConfig`
- `X-XSS-Protection` header removed (deprecated, ignored by modern browsers)
- Webhook endpoint logs source IP on POST for audit trail
- `databaseUrl` validated at startup in `validate-config.ts`
- Session resolution checks `createdAt` against `sessionMaxAgeDays` (no stale sessions between cleanup runs)

## Preferences

- No pre-commit hooks (user explicitly opted out)

## Code Organization

- RPC procedures: `server/rpc/procedures/` — chat visibility admin ops in `chat-visibility.ts`, core chat ops in `chats.ts`, subscription listing in `subscriptions.ts`
- Shared helpers: `server/utils/ms-subscription-status.ts` for `'active'|'expired'|'none'` logic
- Token exchange: `server/ms-graph/token-exchange.ts` shared by auth callback and token refresh
- `GRAPH_BASE` exported from `server/ms-graph/client.ts`
- Retry logic in `server/ms-graph/client.ts` uses shared `withRetry()` helper
- Streaming procedures use `eventIterator()` from `@orpc/server` for `.output()` schemas
- SSE event payloads use discriminated union schema in `server/utils/event-bus.ts` (typed `MessageType` enum, not `z.string()`)
- Token swap in ms-callback: insert new token first, then deactivate old via `lt(updatedAt, now)`
- `allowed_chats` schema: `.unique()` on `msSubscriptionId`, `uniqueIndex` on `clientState`
- `sessions` schema: index on `createdAt` for cleanup task
- RPC context field `username` (not `sessionId`) — holds the login username
- `requireAdmin` middleware narrows `role` to `'admin' as const` in context
- OData `before` filter: escape single quotes (`replace(/'/g, "''")`), NO `encodeURIComponent` (double-encodes via URLSearchParams)
- `subscriptions.list` returns `{ subscriptions: [...] }` object wrapper (consistent with other list endpoints)

## Frontend Patterns

- Auth guards via `app/middleware/auth.global.ts` (not inline watchers)
- Admin guard via `app/middleware/admin.ts` with `definePageMeta({ middleware: ['admin'] })`
- Shared `AppLoadingSpinner` component, `formatDateTime`/`formatMessageTime` auto-imported from `app/utils/formatters.ts`
- `AppConversationPanel` splits into `AppMessageList` + `AppMessageInput`; fetches `msUserId` and passes to both
- Optimistic message sending: `handleSubmit` adds temp message (id: `temp:*`), `appendIncomingMessage` deduplicates by stripping HTML tags and matching content. SSE webhook payloads do NOT include `from.user.id` (only `displayName`), so sender matching is unreliable — content-only match for temp messages. On SSE replacement, optimistic sender (with `id`) is preserved when SSE payload lacks sender `id`.
- `useChatLiveUpdates()` composable encapsulates SSE connections + sidebar state mutations
- `useAuth()` inflight dedup uses module-scoped `inflightPromise` (not per-invocation)
- Responsive: sidebar hidden on mobile when chat selected, back button in conversation header
- `app/app.config.ts` configures theme: emerald primary, zinc neutral
- `error.vue` at app root for error boundary
- Login redirects to `/chats` (not `/settings`)
- `useAuth()` `onMounted` guarded with `getCurrentInstance()` check for middleware usage
- Vue kebab-case prop binding pitfall: `:format-message-time="format-message-time"` passes the **string literal** `"format-message-time"`, not the JS variable `formatMessageTime`. Always use camelCase on the RHS of `:binding`.
- Mention picker: ARIA combobox pattern with `aria-activedescendant`, option IDs, `tabindex="-1"` on options
- `AppChatSidebar` width (`w-80`) controlled by parent `chats.vue`, not self
- `liveAllMessages` filters message events by `allowed_chats` for non-admin users; visibility/respond events pass through for ALL users so client UI stays in sync
- `allowedChatIds` set in `liveAllMessages` handler is updated dynamically when visibility events arrive (so newly-allowed chats' messages pass through without reconnecting)
- `useChatLiveUpdates` accepts `onChatDisallowed` callback — invoked when selected chat's visibility is disabled (clears `currentChat` + URL query in `chats.vue`)
- `ms-callback.ts` wraps `exchangeToken` in try-catch, redirects to `?error=true` on failure
- `AppConversationPanel.loadMessages` captures `chatId` before async to prevent stale-data race on rapid chat switching
- `AppMessageList` watcher distinguishes prepend (load-more) vs append (incoming) by checking if first message ID changed — prepend preserves scroll position, append auto-scrolls only if near bottom
- `subscriptions.list` returns `{ subscriptions: [...] }` object wrapper (consistent with other list endpoints)

## Round 5 Discoveries

- Webhook event publishing now uses `liveEventSchema.safeParse()` before publishing — no more unsafe `as` casts
- `graphRequest` IS used in `chats.ts` `getMe` procedure — do NOT remove that import
- `ChangeType` export removed from `types.ts` (was unused)
- `role="log"` already implies `aria-live="polite"` — explicit `aria-live` is redundant
- `settings.vue` needs `<h1 class="sr-only">Settings</h1>` for heading hierarchy (WCAG 1.3.1)
- `UTextarea` in `AppMessageInput.vue` needs `aria-label` — placeholder alone isn't sufficient
- `createSession`, `deleteSession`, `getActiveToken` are all synchronous (Drizzle node-sqlite sync driver) — do NOT `await` them
