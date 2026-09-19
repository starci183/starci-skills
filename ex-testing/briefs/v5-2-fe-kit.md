# Lane v5-2 — extract shared FE plumbing → `packages/fe-kit`, rewire todo-fe + ec-fe

SCOPE (exclusive): `packages/fe-kit/**` (new), `examples/todo-app-frontend/**`, `examples/ecommerce-app-fe/packages/shared/**` + each app's `package.json`/`tsconfig`/`next.config.mjs`/eslint config ONLY where needed to consume the kit. Do not touch `ecommerce-app-be`, `todo-app-backend`, or FE feature/page components beyond import rewiring.

## Context

`starci-academy-fe` deliberately hand-rolls the theme provider (next-themes injects a `<script>` that React 19 reports as inert → Next dev overlay treats it as a product issue — do NOT switch to next-themes). That provider + the next-intl plumbing are now duplicated between `todo-app-frontend` and `ecommerce-app-fe/packages/shared`. Consolidate into one shared package consumed by both FE repos.

## Tasks

1. Create `packages/fe-kit/` (`@starci-examples/fe-kit`, private, `file:` dep): `src/` in canon package shape —
   - `theme/`: the hand-rolled provider (`useSyncExternalStore`, storage key, system-follow, `paintTheme`, `useTheme`) + the display-controls leaf (`ThemeToggle`, `DisplayControls`, `LocaleSwitcher` — compare todo-fe's `src/components/theme/DisplayControls` vs ec-fe's shared equivalents; keep the better/grammar-based implementation). React + `next-intl` as peer deps.
   - `i18n/`: `routing.ts`, `navigation.ts` (`createNavigation` wrapper), `request.ts` (`getRequestConfig`), `config.ts` (LOCALES/DEFAULT_LOCALE types) — the near-identical copies in both repos. Keep app-specific bits (LOCALES list if it differs, message loading) parameterizable — e.g. `request.ts` factory taking the app's messages map.
2. Rewire **todo-app-frontend**: `file:` dep + tsconfig path alias (e.g. `@fe-kit/*`), delete its local `src/modules/theme/theme-context.tsx`/`src/components/theme/`/`src/i18n/*` duplicates, point imports at the kit. Keep `src/messages/{en,vi}.json` and the app's own locale UI wiring.
3. Rewire **ecommerce-app-fe**: same for `packages/shared/src/theme` + `packages/shared/src/i18n` machinery. `packages/shared` KEEPS: ec-domain copy (`messages/`), product types, `DuckMascot`, `CatalogueTile`, `StateBlock`, `ROUTES`, `requestContext`. Only generic plumbing moves to fe-kit.
4. Gates: each repo `npx eslint src packages` (or existing globs) → 0; `npx tsc --noEmit` → clean; `npm run vitest`/`npm run build` per app → green. Kit code must satisfy canon-fe (deep imports, JSDoc, file-layout).
5. Report → `D:/Repositories/starci-academy-backend/.claude/ex-testing/lint/v5-2-REPORT.md`.

## Rules

- No next-themes. No new runtime deps beyond `next-intl`/react peers.
- English source; Vietnamese only inside `messages/vi.json`.
- Keep the `index`+`component` surface convention inside the kit's own leaves (they are leaves: `leaves/<Name>/{index,component,classNames}`).
