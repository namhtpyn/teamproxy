# MEMORY.md

## Nuxt & Nuxt UI

- Env vars: `NUXT_` prefix required (exception: `DATABASE_URL` via `process.env`)
- `runtimeConfig` private = server-only; `public` = client-accessible
- Nuxt UI v4: `tailwindcss` peer dep; `app/assets/css/main.css` imports `tailwindcss` + `@nuxt/ui`; nuxt.config `css: ['~/assets/css/main.css']`; `<UApp>` in `app.vue`
- `UFormField` inputs need `class="w-full"`; `UAlert` use `:title` prop (slot swallowed)
- `devServer.host` always `0.0.0.0`; theme: emerald/zinc (`app/app.config.ts`)

## Drizzle ORM (node-sqlite sync)

> All ops sync via `node:sqlite` `DatabaseSync`. `await` is a no-op.

- Writes → `.run()`; `db.query.*` → `.sync()`; `db.select().from().where()` → `.all()`/`.get()`
- Where: `{ AND: [{ col: val }] }`, `{ col: { gte: value } }` — no `eq()`/`and()`; `db.select().from().where()` for `isNotNull()` etc.
- `defineRelations(() => ({}))` registers `db.query.*`; `index()`/`uniqueIndex()` in 3rd arg `sqliteTable()`
- No `schema` in `drizzle()`; `createSession`/`deleteSession`/`getActiveToken` sync — never `await`

## oRPC

- SSE: `EventPublisher` (sync, no resume) + `async function*` + `for await...of` client
- Client type: `RouterClient<T>` with `~orpc` discriminator
- Middleware: `.concat()` (not `.use()`); `os.lazy()` conflicts `DecoratedProcedure` → `lazy()` from `@orpc/server`
- `SimpleCsrfProtectionHandlerPlugin` disables `strictGetMethodPluginEnabled`; skip `ORPCError` in `onError`
- `resolveToken` narrows `username` via `context.username!`; `origin` non-optional in context
- Streaming: `eventIterator()` from `@orpc/server`; payloads: discriminated union `server/utils/event-bus.ts` (`MessageType` enum)
- Event publishing: `liveEventSchema.safeParse()` — no `as` casts
- **Input validation only** — no `.output()` Zod schemas. `eventIterator(liveEventSchema)` is the only output schema (needed for SSE serialization).

## MS Graph

- Types from `@microsoft/microsoft-graph-types` — re-exported in `server/ms-graph/types.ts`. No hand-rolled Graph types.
- Official types use `NullableOption<T>` (all fields optional+nullable). Use `!` assertion for fields guaranteed by API. Raw Graph types returned to frontend (no mappers).
- Chat perms: admin consent for enterprise Entra ID; scope mismatch → `invalid_grant` (refresh must match auth scopes)
- Webhook subs: max 1hr, set 55min; automated cron `*/15` (`ensureMsSubscriptions()` = renew + create)
- `ensureMsSubscriptions()` in `server/utils/ensure-ms-subscriptions.ts`; `createMsSubscription()` reads cached origin
- `subscribeAll`, `subscribeToChat`, `subscriptions.renew` REMOVED — cron handles all
- Webhook: POST (not GET) + `validationToken` query param; OData: `chats('id')/messages('msgId')` — regex parse
- Token endpoint: `login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`
- `graphRequest` used in `chats.ts` `getMe` — do NOT remove; token exchange: `server/ms-graph/token-exchange.ts`
- OData `before` filter: `replace(/'/g, "''")`, NO `encodeURIComponent`
- System events: `eventDetail` logged server-side in webhook handler (`graph.ts`), unknown types logged client-side in `getSystemEventText()`

## Security & Auth

- AES-256-GCM (`server/utils/crypto.ts`): SHA-256 key, `{iv}:{tag}:{cipher}` hex format, throws on non-encrypted
- `NUXT_ENCRYPTION_KEY` validated startup (min 16 chars); tokens via `encrypt()`/`decrypt()`
- Login: `timingSafeEqual` both fields → `/chats`
- Guards: `app/middleware/auth.global.ts` (unauth) · `app/middleware/admin.ts` + `definePageMeta` (non-admin)
- `useAuth()`: inflight dedup module-scoped; `onMounted` guarded `getCurrentInstance()`
- Token swap (ms-callback): insert new first, deactivate old `lt(updatedAt, now)`; failure → `?error=true`

## Rate Limiting

- Namespaced `rateLimit(ip, namespace)` — `login` and `image` separate; RPC middleware: `rateLimited` 20/min
- Image proxy (`/api/graph-image`): path must contain `/hostedContents/` AND end with `/$value`, validates `image/*` content-type

## Frontend

- `AppConversationPanel` → `AppMessageList` + `AppMessageInput` (fetches `msUserId`)
- `AppMessageList`: prepend vs append = first msg ID change; auto-scroll near bottom, "N new" when scrolled up
- Optimistic send: temp ID `temp:*`, replaced on RPC success; SSE dedup by ID
- SSE lacks `from.user.id` — sender matching unreliable
- `useChatLiveUpdates()`: SSE + sidebar; `liveAllMessages` filters by `allowed_chats` (non-admin); visibility/respond pass through
- `allowedChatIds` updates dynamically on visibility events (no reconnect); `onChatDisallowed` clears selection + URL
- `loadMessages` captures `chatId` before async (race prevention); sidebar `w-80` set by parent
- `AppMentionPicker`: ARIA combobox, text interpolation (not `v-html`)
- `role="log"` → implicit `aria-live="polite"`; `UTextarea` needs `aria-label`
- `settings.vue`: `<h1 class="sr-only">Settings</h1>` (WCAG heading hierarchy)
- Vue kebab-case pitfall: `:format-message-time="format-message-time"` → string literal. Always camelCase RHS.

## Infra

- Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:3000`; **NEVER kill `tunnel` tmux session**
- Security headers: `nitro.routeRules` (not `@nuxtjs/security`); `X-XSS-Protection` removed
- `databaseUrl` validated startup; hardcoded values → `runtimeConfig`
- DB migrations auto-run on startup inside `server/db/client.ts` via `drizzle-orm/node-sqlite/migrator` — `import.meta.dirname` is `undefined` in Nitro dev build, use `resolve(process.cwd(), 'server/db/migrations')` instead
- RPC handler: `getRequestURL(event).origin` (NOT runtimeConfig) — never hardcode `webhookBase`
- Webhook: logs source IP; batch `getMsSubscriptionsByClientStates()` → 403 on unknown
- DB cleanup: daily 3am (`sessionMaxAgeDays`/`tokenInactiveDays`)

## CI/CD

- CI: deploy-only workflow on push to `main` (no lint/typecheck/build jobs)
- Docker: multi-stage `node:22-alpine` build → `ghcr.io/namhtpyn/teamproxy`
- Deploy: composite action `.github/actions/deploy-to-portainer/` → Portainer API (PUT existing / POST new stack)
- Template: `.github/workflows/portainer/production.yml` — named volume for SQLite (`/app/data/local.db`)
- GitHub vars: `APP_DOMAIN`, `NUXT_MS_CLIENT_ID`, `NUXT_MS_TENANT_ID`, `PORTAINER_ENDPOINT_ID`, `PORTAINER_URL`
- GitHub secrets: `NUXT_APP_ADMIN`, `NUXT_APP_USER`, `NUXT_ENCRYPTION_KEY`, `NUXT_MS_CLIENT_SECRET`, `PORTAINER_ACCESS_TOKEN`

## Codebase Map

| Path | Purpose |
|---|---|
| `server/rpc/router.ts` | RPC router |
| `server/rpc/context.ts` | Context: `username` (not `sessionId`), `role`, `accessToken`, `origin` |
| `server/rpc/middleware/auth.ts` | `requireSession` · `resolveToken` · `requireAdmin`; composed: `authed` · `adminOnly` · `adminAuthed` |
| `server/rpc/procedures/chats.ts` | Core chat ops |
| `server/rpc/procedures/chat-visibility.ts` | Visibility/respond admin ops |
| `server/rpc/procedures/subscriptions.ts` | `subscriptions.list` → `{ subscriptions: [...] }` wrapper |
| `server/rpc/procedures/auth.ts` | `getStatus` · `getMicrosoftAuthUrl` (admin) · `getMsConnectionStatus` · `disconnectMs` (admin) |
| `server/utils/event-bus.ts` | SSE schemas (discriminated union, `MessageType` enum) |
| `server/utils/crypto.ts` | AES-256-GCM |
| `server/utils/ensure-ms-subscriptions.ts` | Renew + create (single entry point) |
| `server/utils/create-ms-subscription.ts` | Subscription creation (reads cached origin) |
| `server/utils/webhook-origin.ts` | Origin cache |
| `server/ms-graph/client.ts` | `GRAPH_BASE`, `graphRequest`, `withRetry()` |
| `server/ms-graph/token-exchange.ts` | Token exchange (callback + refresh) |
| `server/plugins/ensure-ms-subscriptions.ts` | Startup + cron trigger |
| `allowed_chats` schema | `.unique()` on `msSubscriptionId`, `uniqueIndex` on `clientState` |
| `sessions` schema | Index on `createdAt` for cleanup |
