# TeamProxy

MS Teams chat proxy. Login → curated chats → read/send messages in real-time.

## Stack

- **Nuxt 4** + **Vue 3** (Composition API, `<script setup>`)
- **Nuxt UI v4** (Tailwind CSS v4)
- **oRPC** (type-safe RPC)
- **Drizzle ORM** (SQLite via `node:sqlite`)
- **MS Graph API** (OAuth 2.0, webhooks, SSE)

## Setup

```bash
pnpm install
cp .env.example .env   # fill in required vars
pnpm db:migrate
pnpm dev               # http://localhost:3000
```

### Required env vars

| Variable | Purpose |
|---|---|
| `NUXT_DATABASE_URL` | SQLite path |
| `NUXT_APP_ADMIN` / `NUXT_APP_USER` | Login credentials |
| `NUXT_MS_CLIENT_ID` | MS Entra ID app ID |
| `NUXT_MS_CLIENT_SECRET` | MS Entra ID client secret |
| `NUXT_MS_TENANT_ID` | MS Entra ID tenant |
| `NUXT_ENCRYPTION_KEY` | AES-256-GCM key (min 16 chars) |

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run tests (Vitest) |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm db:generate` | Generate migrations |
| `pnpm db:migrate` | Run migrations |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm format` / `pnpm format:check` | Prettier |

## Architecture

```
app/          → Pages, components, composables, layouts
server/
  rpc/        → oRPC router, context, middleware, procedures
  ms-graph/   → Graph API client, token exchange
  utils/      → Crypto, event bus, webhook helpers
shared/       → Shared types
```

- **Auth**: Local session cookie + MS OAuth (admin connects, encrypted tokens in DB)
- **Real-time**: In-process event bus → SSE to clients
- **Webhooks**: Per-chat Graph change notifications, 15min renewal cron
- **Roles**: `admin` (full control) / `user` (allowed chats only)
