# Changelog

## 6.0.0 - unreleased (lane C0)

- **Breaking: `no-direct-heroicon-import` is deleted.** It was a second name for a second copy of
  `no-vendor-icon-outside-icon-leaf` (icon law); one obligation has one rule (redundancy RED20). The copy in
  `vendor-boundary.mjs` is gone; `no-vendor-icon-outside-icon-leaf` is unchanged.
- `no-internal-starci-href` gained its RuleTester cases.
- Every rule is catalogued under an HFS rule id (R91 FE_SOURCE_FORM, R92 FE_COMPONENT_API, R93 FE_VENDOR_BOUNDARY added).

## 5.1.2 - 2026-09-30

- **Fix: `timer-needs-effect-cleanup` refused a correctly cleaned-up timer outside an effect.** nivo-fe `useNow` starts its `setInterval` inside the `subscribe` given to `useSyncExternalStore` and clears it in the unsubscribe that `subscribe` returns; the rule knew only `useEffect` cleanups and reported it. A timer is now also accepted when a function enclosing it directly returns a function (arrow expression body, or the last top-level `return`) that calls `clearTimeout`/`clearInterval` (bare, `window.` or `globalThis.`) on the same identifier the timer handle was stored in (`const id = ...` or `id = ...`). Detection is structural, not by name. A timer with no stored handle, a returned cleanup that clears another handle, or no returned cleanup at all is still refused.

## 5.1.1 - 2026-09-30

- **Fix: `use-client-only-at-boundary` knew only the app layout.** A workspace package keeps its grammar tiers directly under `src/` (`packages/<pkg>/src/{composites,branches,leaves}`, the `fe.package.ui` slot), but the rule accepted the directive only under `/components/...`, so nivo-fe's `packages/nivo-ui` reported 13 false findings. The tier names come from `PACKAGE_TIERS` in `lib/scope.mjs` (the slot's layers, no repo name); a package branch or leaf is a boundary, a package composite is not, and the app layout is unchanged.
- **Fix: the `monorepo` layout scanned only `packages/ui`.** `LAYOUT_GLOBS.monorepo` named the shared package literally (`packages/ui/src/**`), so a workspace package with any other name (nivo-fe's `packages/nivo-ui`) was governed by no starci-fe rule and a deliberate bare `<img>` there printed nothing. The source glob is now `packages/*/src/**/*.{ts,tsx}` and the e2e glob adds `packages/*/e2e/**/*.{ts,tsx}`; every package is judged by the same rules.

## 5.1.0 - 2026-09-29

Round 2 of the FE enforcers, measured on nivo-fe, starci-next-fe and miamia-fe. Twenty-two rules, every one an error; no rule of 5.0.0 changed. Each is registered in `knowledge/hfs/rules.yaml` under the catalogue rule it enforces, with a Vietnamese failure code.

- **Type safety (R22, `FE_TYPE_ESCAPE`)**: `no-type-assertion` (`as T`, `<T>x`; `as const` and `as unknown` stay), `no-non-null-assertion`, `no-explicit-any`. `no-double-cast` now has a why entry.
- **Lists (R65, `FE_LIST_KEY`)**, new law `lists`: `list-item-has-key`, `no-index-key`, `no-inline-literal-prop-in-list`.
- **Runtime hygiene (R65, R50)**, new law `hygiene`: `timer-needs-effect-cleanup` (`FE_EFFECT_CLEANUP`), `no-data-fetch-in-effect` (`FE_EFFECT_FETCH`), `no-empty-catch` (`FE_SWALLOWED_ERROR`), `no-console` (`FE_CONSOLE_CALL`).
- **Formatting (R59, `FE_I18N_FORMATTER`)**, new law `formatting`: `use-intl-formatter` (`toLocale*String`, `new Intl.*Format`, displayed `toFixed`, currency glued to a template, date libraries).
- **Next conventions**: `page-exports-metadata` (R54, `FE_PAGE_METADATA_MISSING`), `no-null-suspense-fallback` (R53, `FE_SUSPENSE_NULL_FALLBACK`), `navigation-from-intl` and `no-native-anchor` (R59, `FE_I18N_NAVIGATION`), `no-hardcoded-route` (R57, `FE_ROUTE_HARDCODED`).
- **Client boundary (R55)**: `client-no-server-import` (`FE_CLIENT_SERVER_IMPORT`), `web-storage-only-in-modules` (`FE_STORAGE_OUTSIDE_MODULES`), `no-dangerous-html` (`FE_DANGEROUS_HTML`).
- **Native controls (R62, `FE_NATIVE_IMAGE`)**: `no-native-img`, `image-has-size`.
- **Transport (R51, `FE_OUTCOME_KIND_UNHANDLED`)**: `outcome-kinds-exhaustive`.
- `lib/ast.mjs` holds the JSX attribute, call-name and effect-callback readers the new laws share. One doc page per new law; type-safety gained its page.

## 5.0.0 - 2026-09-29

HFS Phase 0 item 0.6. Breaking: the factory signature, the retired rules and the level of every rule.

- **`starciFeConfig({ layout })`** returns two flat-config blocks (source and e2e) and owns the law: every published rule at `error` (the factory throws if one is not), the React Hooks rules (`eslint-plugin-react-hooks` 7, recommended set lifted to `error`, `set-state-in-effect` and `refs` required), and `linterOptions` (`noInlineConfig` plus `reportUnusedDisableDirectives: "error"`). The `plugin`, `recommended` and `linterOptions` inputs are gone. `eslint-plugin-react-hooks >=7` is a new peer dependency.
- **`vn-ok` is removed entirely.** `no-second-language-in-source` and `no-hardcoded-copy-in-vocabulary` are replaced by `no-hardcoded-copy` (R58): no literal copy at any tier, in any language, no pragma, no endonym or `resources/` exemption. Same notion of literal as nivo-fe's `check-i18n-catalog.mjs` (a word is two or more letters). A `vn-ok:` comment is now itself a finding of `no-inline-lint-config`, which also refuses `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-env` and inline `eslint rule:` config, and now covers specs and the e2e tree.
- New laws and rules: `env-owner` (R49: `no-env-outside-config`, `no-hardcoded-endpoint-fallback`), `transport` (R50-R52: `fetch-only-in-api-client`, `client-fetch-has-signal`, `no-shared-transport-state`, `client-maps-auth-to-refused`, `no-http-status-collapse`, `no-hand-typed-wire`), `client-boundary` (R55: `use-client-only-at-boundary`), `hooks-folder` (R56 lint half: `hooks-folder-holds-hooks-only`), `next-conventions` (`no-middleware-file`, `locale-segment-is-locale`, `no-second-i18n-stack`, `html-lang-from-locale`), `brand-values` (R61 TypeScript half: `no-raw-brand-value`), `native-controls` (R62: `no-native-form-control`), `size-and-state-budget` (R65: `component-line-budget`, `unit-hook-budget`, `no-hand-rolled-polling`), `e2e-shape` (R66, seven rules on `e2e/**` and `playwright.config.*`), `spec-quality` (R67 and the real-catalogue half of R60: six rules).
- `sourceRecommended` and `e2eRecommended` are exported beside `recommended` (their union); the effective-config audit compares a production probe against `sourceRecommended`.
- `why[rule]` is `{ code, vi, fixVi }`: the catalogue finding code and the Vietnamese why for every rule of the catalogued laws.
- One doc page per law under `docs/`.
