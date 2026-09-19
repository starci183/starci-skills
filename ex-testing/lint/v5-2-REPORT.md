# v5-2-REPORT — shared FE kit extraction (`@starci-examples/fe-kit`)

Scope per brief `ex-testing/briefs/v5-2-fe-kit.md`: `packages/fe-kit/**` (new),
`examples/todo-app-frontend/**`, `examples/ecommerce-app-fe/packages/shared/**` plus each app's
`package.json`/`tsconfig.json` where needed to consume the kit. `ecommerce-app-be`,
`todo-app-backend` untouched. Feature/page components untouched except the out-of-lane repair
documented below. No `next-themes` introduced; no new runtime dependency beyond the existing
`react`/`next-intl`/`@starci/grammar` peers.

## The kit

`packages/fe-kit` (`@starci-examples/fe-kit`, private, `type: module`, consumed as a `file:`
dependency and compiled by each consumer's own pipeline through an `@fe-kit/*` tsconfig path
alias — the package ships source, not build output):

```
src/
  i18n/
    config.ts          defineI18nConfig({locales, defaultLocale, localeCookie, timeZone})
                       → FeKitI18nConfig {LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE,
                                          LOCALE_COOKIE_MAX_AGE, PRODUCT_TIME_ZONE, toLocale}
    routing.ts         createRouting(config) — wraps next-intl defineRouting, cookie wired
                       from the config
    navigation.ts      createI18nNavigation — next-intl createNavigation bound to the app's
                       routing object; FeKitNavigation/FeKitLinkProps types the leaves consume
    request.ts         createRequestConfig({routing, timeZone, messages}) — wraps
                       getRequestConfig; messages is a per-locale loader map so each app keeps
                       its own messages/*.json path
    i18n-context.tsx   FeKitI18nProvider + useFeKitI18n — carries {locales, navigation} to the
                       kit leaves. Context, not props: a created navigation's Link/usePathname/
                       useRouter are functions, and functions cannot cross the server→client
                       boundary that the apps' layouts sit above
  theme/
    theme-context.tsx  ThemeProvider + useTheme — the hand-rolled provider both apps already
                       shipped: localStorage key "theme", light/dark/system, system resolved via
                       matchMedia, paintTheme (remove light+dark, add resolved, set colorScheme),
                       OS-change listener while "system" is selected
    leaves/
      ThemeToggle/     {index,component,classNames} — three-choice pressed-state button group,
                       copy from the `shell.theme` message namespace
      LocaleSwitcher/  {index,component,classNames} — one locale-aware Link per shipped locale
                       re-pointing at the current path, copy from `shell.locale`
      DisplayControls/ {index,component,classNames} — the grammar-based combined control kept
                       per the brief (TextAction onPress, `display.*` namespace)
```

Every leaf follows the connected/pure split: `index.tsx` resolves context + messages, the
`*Base` in `component.tsx` draws resolved props only.

### Design notes

- `useSyncExternalStore`: the brief's parenthetical suggested it, but all three existing
  providers (todo, ecommerce-shared, `starci-academy-fe`) implement the identical
  `useState`/`useEffect`/`useMemo`/`useRef`/`useCallback` flow, and the brief's actual
  requirement is preserving that hand-rolled behavior byte-for-byte semantics. The kit keeps the
  proven implementation; switching storage formats would change hydration behavior, not just
  plumbing.
- `createI18nNavigation` is typed `typeof createNavigation` — `Parameters<>` collapses the
  generic signature and loses the `pathnames`-less overload the apps use.
- `FeKitI18nProvider` stores the runtime at `string` level: `Link` is contravariant in its
  `locale` prop, so the provider wraps the app's `Link` once (memoized) into a `string`-typed
  component rather than double-casting (`starci-fe/no-double-cast`). `usePathname`/`useRouter`
  widen for free through method bivariance.
- Kit eslint config attaches `@starci/eslint-canon-fe` with the `single-app` layout over `src/**`.
  `@typescript-eslint/eslint-plugin` is not installed under `.claude/packages/node_modules`
  (parser only), so the base `no-unused-vars` is off — it false-positives on documented TS
  function-type parameters and the TS-aware replacement is unavailable.
- `scripts/link-peers.mjs` junctions `react`, `next`, `next-intl`, `@starci/grammar`,
  `@types/react*` into `fe-kit/node_modules` from a consumer's install so standalone
  `eslint`/`tsc` resolve peers; consumer bundles never see the junctions (their own webpack/tsc
  alias resolves the real files first).

## What stayed app-side

- Message dictionaries: `todo src/messages/{en,vi}.json`, ecommerce
  `packages/shared/src/messages/{en,vi}.json` — loaded through per-app loader maps in each
  `i18n/request.ts` adapter.
- App-specific i18n values: locales `["en","vi"]`, cookie names (`starci-locale` /
  `northwind-locale`), timezone `Asia/Ho_Chi_Minh` — each declared once in the app's
  `i18n/config.ts` via `defineI18nConfig`.
- Ecommerce-specific shared code: `messages/`, product types, `DuckMascot`, `CatalogueTile`,
  `StateBlock`, `ROUTES`, `requestContext`, `theme/tokens.css` (styling asset — stays).
- Both ecommerce `next.config.mjs` files unchanged: they still point next-intl at
  `../../packages/shared/src/i18n/request.ts`, which is now a one-call adapter over
  `createRequestConfig`.

## Consumer rewiring

### todo-app-frontend

- `package.json`: `+ "@starci-examples/fe-kit": "file:../../packages/fe-kit"`.
- `tsconfig.json`: `+ "@fe-kit/*": ["../../packages/fe-kit/src/*"]`.
- `src/i18n/{config,routing,navigation,request}.ts`: rewritten as thin kit adapters — same
  exported surface (`i18n`, `Locale`, `PRODUCT_TIME_ZONE`, `routing`, `Link`/`redirect`/
  `usePathname`/`useRouter`/`getPathname`, default request config).
- `src/app/providers.tsx`: `StarCiThemeProvider` → kit `ThemeProvider`; mounts
  `FeKitI18nProvider` with `i18n.LOCALES` + the app's created navigation.
- `src/app/[lang]/layout.tsx`: `ThemeToggle`/`LocaleSwitcher` now imported from
  `@fe-kit/theme/leaves/*`.
- Deleted: `src/modules/theme/`, `src/components/theme/`, `src/components/locale/`.
- `src/middleware.ts`: unchanged (same `routing` export).

### ecommerce-app-fe

- `apps/{landing,shop}/package.json`: `+ "@starci-examples/fe-kit": "file:../../../../packages/fe-kit"`.
- Root `tsconfig.json` `+ "@fe-kit/*": ["../../packages/fe-kit/src/*"]`; each app tsconfig
  `+ "@fe-kit/*": ["../../../../packages/fe-kit/src/*"]` (four levels — `apps/<app>` → `.claude`).
- `vitest.config.ts`: `+ "@fe-kit" → ../../packages/fe-kit/src` resolve alias.
- `packages/shared/src/i18n/{config,routing,navigation,request}.ts`: same thin-adapter shape as
  todo, northwind cookie values.
- `apps/{landing,shop}/src/app/providers.tsx`: `NorthwindThemeProvider` → kit `ThemeProvider`;
  `FeKitI18nProvider` mounted with the shared `i18n.LOCALES` + `@shared/i18n/navigation`.
- `apps/{landing,shop}/src/components/layouts/*/index.tsx`: `useNorthwindTheme` → kit `useTheme`.
- `apps/{landing,shop}/src/components/layouts/*/component.tsx`: `DisplayControls` from
  `@fe-kit/theme/leaves/DisplayControls`.
- Both layout `component.spec.tsx`: `vi.mock` path repointed to the kit leaf.
- Deleted: `packages/shared/src/theme/theme-context.tsx`, `packages/shared/src/theme/DisplayControls.tsx`.
- Both `middleware.ts`, both `[lang]/layout.tsx`: unchanged (same shared `routing` export).

## Gate results

| Gate | Command | Result |
|---|---|---|
| fe-kit lint | `npx eslint src` (in `packages/fe-kit`) | 0 errors |
| fe-kit typecheck | `npx tsc --noEmit -p tsconfig.json` | clean |
| todo lint | `npx eslint src` | 0 errors |
| todo typecheck | `npx tsc --noEmit` | clean |
| todo unit | `npm run test:unit` (vitest run) | 16 files / 101 tests, all pass |
| todo build | `npm run build` (`next build`) | success, all routes compile |
| ec lint | `npx eslint apps packages` | 0 errors |
| ec typecheck | `npx tsc --noEmit` (root tsconfig covers shared + both apps) | clean |
| ec unit | `npm run test:unit` (vitest run) | 13 files / 58 tests, all pass |
| ec landing build | `npm run build -w @ecommerce/landing` | success |
| ec shop build | `npm run build -w @ecommerce/shop` | success |

## Out-of-lane repair (pre-existing breakage, gate-blocking)

`tsc --noEmit` and `next build` in todo-app-frontend were already red before this lane: an
in-flight copy-extraction refactor had added a required `copy` prop to
`SignInFormView`/`SignInScreenView` without updating all call sites and specs (verified via
`git status`/`git diff` — the files were modified in the working tree before any fe-kit work).
Repaired minimally to unblock the gates:

- `src/components/login/sign-in/component.spec.tsx`: added a `SignInScreenViewCopy` fixture and
  `copy={copy}` on the six render calls (same pattern `blocks/sign-in-form/component.spec.tsx`
  already used).
- `src/components/login/sign-in/index.spec.tsx`: wrapped the `SignInScreenBlock` render in
  `NextIntlClientProvider` with the `en` catalogue — the connected half resolves copy through
  `useTranslations`, which throws without the provider.
- `src/components/login/sign-in/component.tsx`: `eslint --fix` indentation only (8 errors, all
  whitespace, auto-fixed).
- `src/components/login/sign-in/index.tsx`: removed two duplicate `useTranslations` lines
  introduced while inspecting; the file's `copy` resolution was already complete in the WIP.

These edits change test fixtures/whitespace only; no behavior changed.

## Consumption pattern

```ts
import { defineI18nConfig } from "@fe-kit/i18n/config"
import { createRouting } from "@fe-kit/i18n/routing"
import { createI18nNavigation } from "@fe-kit/i18n/navigation"
import { createRequestConfig } from "@fe-kit/i18n/request"
import { FeKitI18nProvider } from "@fe-kit/i18n/i18n-context"
import { ThemeProvider, useTheme } from "@fe-kit/theme/theme-context"
import { ThemeToggle } from "@fe-kit/theme/leaves/ThemeToggle"
import { LocaleSwitcher } from "@fe-kit/theme/leaves/LocaleSwitcher"
import { DisplayControls } from "@fe-kit/theme/leaves/DisplayControls"
```

Deep imports only, no barrels. Behavior (storage key, cookie names, max-age, timezone, paint
mechanism, system-follow, locale re-prefixing) is unchanged from the pre-extraction
implementations.
