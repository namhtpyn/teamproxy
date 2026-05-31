# Memory

## Project
MS Teams chat proxy (TeamProxy). Nuxt 4 + oRPC + Vue 3 + TanStack Vue Query + MS Graph API.

## Stack Details
- Dev server in tmux `dev-server`
- App URL: `https://personality-thank-livecam-analyses.trycloudflare.com/`
- Credentials: `admin:admin`, `user:user`
- Test via `playwright-cli open --headed` (NOT chrome-devtools, NOT curl)
- CSP blocks `api.iconify.design` — `i-lucide-*` icons won't load in prod
- CSP `img-src` allows `data: blob:` — base64 images in TipTap editor render fine. `connect-src` blocks `data:` but only affects `fetch()`, not `<img>` tags.
- Inline images: TipTap Image extension with `inline: true, allowBase64: true`. Paste inserts base64 `<img>`, send extracts to `hostedContents[]`, replaces src with `../hostedContents/N/$value`.
- **CRITICAL: Regex in loop** — never mutate string inside `while(regex.exec())` loop. Collect all matches first, then replace. `lastIndex` corruption causes missed images.
- Mention `<at>` conversion done SERVER-side only. Client sends raw HTML (with `<span class="mention">@Name</span>`) or plain text. Server's `content.replace('@Name', '<at id="N">')` handles conversion.
- When `hasImages`: client sends HTML with `<img src="../hostedContents/N/$value">`. When `!hasImages`: client sends plain text.

## Graph API
- Reaction types use unicode emoji: `👍`, `❤️`, `😂`, `😮`, `😢`, `😡`
- **CRITICAL: Graph allows only ONE reaction per user per message.** `setReaction` auto-replaces previous reaction. Optimistic update must remove old reaction before adding new.
- `setReaction`/`unsetReaction` POST returns 204 (no body) → `graphRequest` returns `undefined`
- Webhook/SSE delivers updated message with new reaction state
- **CRITICAL: `replyToId` is READ-ONLY and only applies to channel messages, NOT chat messages.** Setting it in POST body to `/chats/{id}/messages` is silently ignored.
- Chat replies use `POST /chats/{id}/messages/replyWithQuote` with `{ messageIds: ["{id}"], replyMessage: { body: {...} } }`. Response has `attachments[].contentType === "messageReference"` with JSON content containing `messageSender.user.displayName` and `messagePreview`.
- `replyWithQuote` does NOT support mentions or hostedContents (images). Falls back to regular send without reply when those are present.

## oRPC Client
- `$orpc` = TanStack query utils (for mutations like `.chats.setReaction()`)
- `$orpcClient` = raw RPC client
- Input format for raw fetch: `{ json: { ...params } }` (not just `{ ...params }`)

## Key Patterns
- Mention spans: `\x00MENTION@\x01...\x02` placeholders survive HTML stripping → restored as orange `<span>`
- Image upload: paste-only (TipTap `handlePaste` intercepts image files). No file picker button. Inline `<img>` in editor, extracted to `hostedContents` on send.
- SSE: 4 focused subscriptions (`liveMessages`, `liveVisibility`, `liveRespond`, `liveDisconnect`) via TanStack `experimental_liveOptions()`
- Reactions: optimistic update + oRPC call → SSE corrects on webhook delivery
- Reply: `replyingTo` ref in conversation-panel → reply preview bar in message-input → `replyWithQuote` Graph API → detected via `messageReference` attachment in bubble
- Never name a variable `ref` inside Vue `<script setup>` — shadows Vue's auto-imported `ref()` function causing ReferenceError
