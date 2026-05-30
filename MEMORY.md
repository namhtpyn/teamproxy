# Memory

## Project
MS Teams chat proxy (TeamProxy). Nuxt 4 + oRPC + Vue 3 + TanStack Vue Query + MS Graph API.

## Stack Details
- Dev server in tmux `dev-server`
- App URL: `https://personality-thank-livecam-analyses.trycloudflare.com/`
- Credentials: `admin:admin`, `user:user`
- Test via `playwright-cli open --headed` (NOT chrome-devtools, NOT curl)
- CSP blocks `api.iconify.design` — `i-lucide-*` icons won't load in prod

## Graph API
- Reaction types use unicode emoji: `👍`, `❤️`, `😂`, `😮`, `😢`, `😡`
- **CRITICAL: Graph allows only ONE reaction per user per message.** `setReaction` auto-replaces previous reaction. Optimistic update must remove old reaction before adding new.
- `setReaction`/`unsetReaction` POST returns 204 (no body) → `graphRequest` returns `undefined`
- Webhook/SSE delivers updated message with new reaction state

## oRPC Client
- `$orpc` = TanStack query utils (for mutations like `.chats.setReaction()`)
- `$orpcClient` = raw RPC client
- Input format for raw fetch: `{ json: { ...params } }` (not just `{ ...params }`)

## Key Patterns
- Mention spans: `\x00MENTION@\x01...\x02` placeholders survive HTML stripping → restored as orange `<span>`
- Image upload: paste-only (`@paste` on textarea with `preventDefault`). No file picker button.
- SSE: 4 focused subscriptions (`liveMessages`, `liveVisibility`, `liveRespond`, `liveDisconnect`) via TanStack `experimental_liveOptions()`
- Reactions: optimistic update + oRPC call → SSE corrects on webhook delivery
