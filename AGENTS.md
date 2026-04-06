# Agent Instructions

## Startup

1. Read `MEMORY.md` then `LOGIC.md` — avoid re-discovering known issues
2. Load relevant skills via `skill` tool (registry below)
3. Check `nuxt.config.ts` when touching server code

## Hard Rules

- **Filenames**: kebab-case only. Overrides Nuxt component conventions.
- **Type safety**: never `as any`, `@ts-ignore`, `@ts-expect-error`
- **Commits**: never unless explicitly asked
- **Tests**: never delete failing tests
- **Pre-commit hooks**: none (user opted out)
- **Token efficiency**: MANDATE. All `.md` files must be maximally terse. No prose, no filler, no decorative formatting. Every word must earn its place. When updating any doc, also trim/merge/remove anything that can be compressed.

## Self-Evolution

- `MEMORY.md` — your persistent memory brain. Update when you learn/discover anything worth remembering. Fix/remove stale entries. Optimized for you to grep/search, not for humans.
- `LOGIC.md` — update when logic changes (features, flows, behavior). Pure text, no code. Optimized for you to grep/search, not for humans.
- `AGENTS.md` — update with new instructions as project evolves.

## Skills (load via `skill` tool; user-installed > built-in)

**User-installed (priority):** `nuxt` · `nuxt-ui` · `orpc-guide` · `playwright-cli`

**Built-in:** `vue` · `vue-best-practices` (MUST for Vue tasks) · `vueuse-functions` · `vitest` · `vue-testing-best-practices` · `pnpm` · `agent-browser`
