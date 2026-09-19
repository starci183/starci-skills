# Lane v5-5 (qwen) — wire todo-fe feature screens to existing i18n dictionaries

SCOPE (exclusive): `examples/todo-app-frontend/src/components/**`, `src/messages/**`, `src/features/**` — do NOT touch `src/i18n/**`, `src/modules/**`, `src/app/**` (v5-2 owns i18n/theme plumbing; another lane is mid-move — import `useTranslations`/`Link` from `next-intl` and `@/i18n/navigation` as they exist NOW; if a path moves under you, follow it).

## Context
`src/messages/{en,vi}.json` already contain ~185 translated keys, but only shell/theme/metadata consume them — feature screens (TasksPage, sign-in, profile, etc.) hardcode English strings. Audit v4-5 flagged this as feature-scale follow-up.

## Tasks
1. Inventory every hardcoded user-facing string in `src/components/pages/**`, `src/components/overlays/**`, `src/components/layouts/**`, `src/features/**` (skip test/spec files — tests stay English anyway; skip classNames/styles).
2. Map each string to an existing key in `messages/en.json`/`vi.json`; where a key is missing, add BOTH en and vi entries (vi translation must be real Vietnamese, consistent tone with existing keys — this is a lang file so Vietnamese is allowed here).
3. Rewire components to `useTranslations(<namespace>)` / `getTranslations` (server) per next-intl convention already in the app. Keep the `index`/`component` split: index (connected) may call `useTranslations`; the pure `component.tsx` twin should receive translated strings via props ONLY if it stays server-safe — check how existing wired components do it and follow that.
4. Keep keys organized by page/feature namespace as the existing dictionaries do.
5. Gates: `npx eslint src` → 0; `npx tsc --noEmit` → clean; `npm run vitest` → green; `npm run build` → green. Verify en+vi key parity (no missing keys in either locale).
6. Report → `.claude/ex-testing/lint/v5-5-REPORT.md`.

## Rules
- No new deps. English source/comments; Vietnamese ONLY inside `messages/vi.json`. Don't touch files v5-2 owns.
