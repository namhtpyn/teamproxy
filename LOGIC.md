# LOGIC.md

MS Teams chat proxy. Login → curated chats → read/send messages real-time.

## Auth

App auth (local creds → session cookie) + MS auth (OAuth 2.0 → encrypted token in DB).

### Login/Logout

Credentials on `/login` → timing-safe compare → match = session row (UUID, username, role) → `session` (httpOnly) + `auth` (client-readable) cookies → `/chats`. Logout = DELETE session, clear cookies → `/login`.

### Session & Guards

RPC: `session` cookie → DB lookup → valid if `createdAt` ≤ `sessionMaxAgeDays` → context: `username` + `role`. Global guard: unauth blocked from `/chats` `/settings`. Admin guard: non-admin blocked from `/settings`.

Roles: `admin`/`user`, set at login, stored in session + `auth` cookie.

## MS OAuth

Connect (admin) → tenant OAuth URL → MS login → `/auth/ms-callback` exchanges code → Zod validate → AES-256-GCM encrypt → DB store (old deactivated) → webhook subs → `/settings?connected=true`. Refresh: 5min cron, expiring-within-10min tokens. Failure = deactivate (admin re-links). Disconnect = mark inactive (never delete). Status = active non-expired row; read-only all users, connect/disconnect admin-only.

## Messages

### Incoming (Teams → App)

Chat msg → Graph POST `/webhook/graph` (OData resource + `clientState`) → batch-validate clientStates (403 unknown) → fetch full msg → schema validate → publish event bus `chat:*` → `liveAllMessages` SSE (non-admin: allowed chats only) → client append if selected, sidebar preview update all → auto-scroll near bottom, "N new" button if scrolled up.

### Outgoing (App → Teams)

Submit → temp msg `temp:*` → `sendMessage` RPC (allowed + respond check) → mentions→`<at>` tags, images→HTML → Graph send → success: replace temp (dedup later SSE); failure: inline error.

### Load History

Select chat → `getMessages` RPC → Graph OData `before` filter (more) / none (initial) → prepend → scroll preserved.

## Webhook Subs

Per-chat change-notifications. Max 1hr, set 55min. Create: admin enables OR cron detects missing → UUID clientState → Graph validates → stored `allowed_chats`. Renew: 15min cron, expiring-within-1hr → +55min; failure clears for re-creation. Delete: admin disables → Graph delete + clear + visibility event. Gap: expired until next cron, messages lost. Origin: first HTTP request, cached.

## Real-time Events

In-process publisher `chat:*`. Types: `message` · `error` · `visibility` · `respond`. Retained 300s. `liveAllMessages` = SSE generator, non-admin filtered, visibility/respond always pass. Client: auto-reconnect 1s→30s backoff, dispatches sidebar + panel. Admin toggle → optimistic UI → event → all clients via SSE; failure reverts.

## Permissions

| | Admin | User |
|---|---|---|
| `/settings` | ✅ | ❌ |
| Connect/disconnect MS | ✅ | — |
| View chats | all | allowed only |
| Toggle visibility/respond | ✅ | — |
| Read msgs | ✅ | ✅ allowed |
| Send msgs | ✅ | ✅ if respond on |
| MS status | r/w | r/o |

RPC: `base` (none) · `authed` (session+token=user) · `adminOnly` (session+admin) · `adminAuthed` (admin+token).

## Cron

| | | |
|---|---|---|
| 5min | token refresh | expiring-within-10min |
| 15min | sub renewal | expiring + missing |
| 3am | cleanup | old sessions + inactive tokens |

## Encryption

AES-256-GCM. Key: SHA-256(`NUXT_ENCRYPTION_KEY`), min 16 chars. Format: `{iv}:{tag}:{cipher}` hex.
