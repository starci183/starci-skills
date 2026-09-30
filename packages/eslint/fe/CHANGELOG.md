# Changelog

## 6.0.0 - unreleased (lanes C0, F0)

- New law `status-colors` (R61 `FE_STYLE_TOKEN_ONLY`): `status-text-uses-soft-foreground` refuses a class that paints text, an icon or a
  text decoration with a solid status tone (`text-success`, `fill-danger`, `stroke-warning`, `decoration-info`, with any variant, opacity or
  `!`), read from `className`/`class`, `cn()`/`clsx()` arguments, conditionals, arrays, constants and `classes` entries. The soft pair
  (`text-<tone>-soft-foreground`, `bg-<tone>-soft`), a solid fill with its own ink (`bg-<tone> text-<tone>-foreground`) and solid borders,
  rings and outlines pass. The tones come from `lib/status-tones.generated.mjs`, generated from the grammar by
  `packages/stylelint` (`npm run vocabulary`), never listed in the rule.

- **Breaking: `starciFeConfig({ hfs: loadHfs(import.meta.url) })` replaces `starciFeConfig({ layout })`.** The factory reads the
  repository's `hfs.json` and the shipped slot manifest (`runtime/`, refreshed by `packages/hfs/scripts/sync-runtime.mjs`), lints
  every app's and every workspace package's `src/` with typed linting (`parserOptions.projectService`) and the e2e tree
  syntax-only, ignores build output, `__generated__/` and `.starci/`, and puts the slot view in `settings.starci.hfs`
  (`lib/hfs.mjs` `hfsOf(context)`); `lib/types.mjs` holds the type-aware helpers. `LAYOUTS`/`LAYOUT_GLOBS` are deleted.
- **Breaking: the `lint-adoption` law and its `effective-config` audit are deleted**, with `audits`/`auditOwners`: the
  managed `eslint.config.mjs` one-liner that `hfs check` compares with its render (R17) is the one proof that no rule is off.
- `linterOptions` lives in `lib/config.mjs` only (the copy in `lint-escape-hatch.mjs` is gone).
- New peer dependency `typescript >=5.9`; `@typescript-eslint/parser` is a dependency. Tests build typed cases with
  `fixtures/typed/tester.mjs` (`typedTester`, `slotTester`, `at`).

- **Breaking: `no-direct-heroicon-import` is deleted.** It was a second name for a second copy of
  `no-vendor-icon-outside-icon-leaf` (icon law); one obligation has one rule (redundancy RED20). The copy in
  `vendor-boundary.mjs` is gone; `no-vendor-icon-outside-icon-leaf` is unchanged.
- New law `size-growth` (R20 `HFS_SIZE_GROWTH`): `file-size-growth` refuses a new source file over the line budget and an existing file over it that is longer than at the parent commit. The budget is `ruleParams.fe.fileLines` of the slot manifest, read through the slot view (`hfsOf(context).ruleParams`, the package's own `runtime/` copy) (`packages/hfs/scripts/sync-runtime.mjs` keeps it equal to the runtime's); the rule takes no option.
- **Breaking: `no-internal-starci-href` is deleted.** It was a second, weaker copy of `no-hardcoded-route` (which already refuses a
  route literal in any JSX `href` and any navigation call, specs excluded); one obligation has one rule. `no-hardcoded-route` gained a
  passing case for `mailto:` on `<a>` and a violating case for `<a href="/tasks">`. R93 no longer lists it.
- **Fix: `no-direct-const-alias` fired on `export const generateMetadata = x` in a Next route segment file.** The names Next reserves
  (`generateMetadata`, `metadata`, `viewport`, `dynamic`, ... in `lib/next.mjs`, the list of the architecture machine's
  `NEXT_RESERVED_EXPORTS`) are exempt when the file is a route segment file (slot `fe.route`, stem `page`/`layout`/`template`/...);
  a non-reserved alias in a route file and a reserved name elsewhere still fire. The rule now needs the slot view (`hfsOf`).
- **Fix: `no-barrel-spec` fired on every `index.spec.ts`.** It now reads and parses the sibling `index.ts(x)` and fires only when the
  sibling holds nothing but import and export declarations (a barrel); an `index.ts` with a function, class or value (starci-next-fe
  `modules/browser-storage`) may have its spec, and a missing sibling is no finding. It also covers `.tsx`.
- **Fix: `no-mocked-translations` refused a `next-intl/server` mock that serves the real catalogue.** A server helper has no provider to
  render inside; the mock is allowed when its factory (or a `vi.hoisted` block it reads) uses an import that resolves into the app's
  `modules/i18n/messages/`. Client `next-intl` mocks, literal/key-echoing server mocks and automocks still fire, now with a
  server-specific message (`mockedServer`) naming `createTranslator` over the real messages. The rule needs the slot view (`hfsOf`).
- **Fix: `no-hand-typed-wire` fired on `(await response.json()) as unknown`, the narrowing entry `no-type-assertion` allows.** It now
  fires only when a value read from `.json()` (directly or through a `const`) is asserted or annotated to a type that is not `unknown`
  and not imported from a `__generated__/` module (decided from the file's import declarations). **Breaking:** the `declared` branch
  (a name suffix `Wire|Dto|DTO|Response|Payload` on an interface or alias in `modules/api`) and the `graphqlType` branch (a name
  pattern `GraphQl*`) are deleted; detection by name is not a detection.
- Every rule is catalogued under an HFS rule id (R91 FE_SOURCE_FORM, R92 FE_COMPONENT_API, R93 FE_VENDOR_BOUNDARY added).
- **One client, one Outcome, one i18n stack, grammar components (lane F0-D).**
  - `lib/scope.mjs`: `isConfigModule`, `isApiClient` and the new `isOutcomeModule` are slot questions (`fe.modules.config`, `fe.transport.client` / `fe.package.api.client`, `fe.transport.outcome` / `fe.package.api.outcome`) taking the rule `context`, not path regexes; `PACKAGE_TIERS` is deleted (`use-client-only-at-boundary` asks slot `fe.package.ui` and reads the tier below the package root); `slotOfFile`, `inSlot` and `globalReferences` (scope-resolved globals) are new. Their rule tests run under `slotTester()`/`typedTester()` with `at("apps/web/src/...")` filenames.
  - `fetch-only-in-api-client` resolves the global `fetch` (and `globalThis.fetch`, `window.fetch`, `self.fetch`, aliases, destructuring), `new Request`, `new EventSource`, `navigator.sendBeacon` by scope, and fetch libraries (axios, ky, got, undici, ofetch, graphql-request, urql, `@apollo/*`, `@urql/*`) by module specifier; the one file allowed is slot `fe.transport.client` or `fe.package.api.client`. `client-fetch-has-signal` and `no-shared-transport-state` ask the same slots (the shared api package is covered).
  - `client-maps-auth-to-refused` judges a real branch: the fetch response's status (typed `Response`) compared with 401 and 403 whose consequent builds `kind: "refused"`; three literals anywhere no longer pass.
  - New `one-outcome-union` (R51): a union alias of object types sharing a literal `ok` or `kind` discriminant is declared only in the outcome slot.
  - New `i18n-stack-in-one-module` (R59): `defineRouting`, `createNavigation`, `getRequestConfig`, `createMiddleware` (by import specifier) are called only in slot `fe.package.i18n`, or `fe.modules.i18n` of a one-app repository. `no-second-i18n-stack` stays: it refuses another i18n library, a different obligation.
  - New `no-raw-structural-element` (`grammar-boundary`, R62): raw `h1-h6 p span hr label form fieldset dl dt dd table..th ul ol li header footer nav section main figure figcaption` in app slots and non-`ui` packages; `div br aside article` have no grammar component and stay allowed.

- **Breaking: the timer rule is now `effect-subscription-needs-cleanup`** (`FE_EFFECT_CLEANUP`, no alias). Inside a React `useEffect` / `useLayoutEffect` callback (resolved through the import) and inside a `useSyncExternalStore` subscribe (also when passed by name), every `setTimeout` / `setInterval` handle, `requestAnimationFrame` id, `addEventListener` (target, type, listener), `.observe`d `ResizeObserver` / `IntersectionObserver` / `MutationObserver`, `WebSocket` / `EventSource` / `BroadcastChannel` and subscription object (`unsubscribe` / `off` / `close` in its type) must be released by the returned cleanup against the SAME handle (scope binding or member path), not by any `clearTimeout` in it. The `/modules/` exemption is gone: outside an effect a timer or frame is accepted only when the function that starts it releases it (the 5.1.2 returned-closure acceptance and the API client's `finally` both hold structurally). Typed linting is required.
- **`no-data-fetch-in-effect` sees indirect loads.** A call executed synchronously in the effect body whose value is a promise (`void load()` with `load` async anywhere, an SWR `mutate()` / `refresh()`), is `.then`-ed, or is `void`-ed and untyped is a finding; a promise started inside a listener or timer callback the effect registers is not. The effect is React's export, resolved through the import.
- **New rule `server-module-marks-server-only`** (R55, new code `FE_SERVER_ONLY_MARK`): a module that imports `next/headers`, `next/server`, `next-intl/server`, a Node built-in, or a module that resolves to a file starting with `import "server-only"` must itself start with `import "server-only"`. Route files (slots `fe.route`, `fe.source-root-pinned`) are exempt. `client-no-server-import` also refuses `next-intl/server` and `next/server`.
- **`no-hardcoded-copy` (R58)** reads template literals with substitutions whose static parts hold a word (`${count} installed`) in JSX children and copy attributes, and any object property whose value is a whole sentence under any key (`{ ready: "Your course is ready" }`); class names, URLs, ids, keys, units and format tokens still pass.
- **`no-inline-lint-config` (R18)** also refuses `NOSONAR`, `@sonar-ignore`, `istanbul ignore`, `c8 ignore`, `v8 ignore`, `prettier-ignore` and `stylelint-disable` comments.
- New `lib/bindings.mjs` (scope bindings, imports, stable keys), `lib/platform.mjs` (platform symbols) and `lib/react.mjs` (React exports by import).

## 5.1.2 - 2026-09-30


## 5.1.1 - 2026-09-30

- **Fix: `use-client-only-at-boundary` knew only the app layout.** A workspace package keeps its grammar tiers directly under `src/` (`packages/<pkg>/src/{composites,branches,leaves}`, the `fe.package.ui` slot), but the rule accepted the directive only under `/components/...`, so nivo-fe's `packages/nivo-ui` reported 13 false findings. The tier names come from `PACKAGE_TIERS` in `lib/scope.mjs` (the slot's layers, no repo name); a package branch or leaf is a boundary, a package composite is not, and the app layout is unchanged.
- **Fix: the `monorepo` layout scanned only `packages/ui`.** `LAYOUT_GLOBS.monorepo` named the shared package literally (`packages/ui/src/**`), so a workspace package with any other name (nivo-fe's `packages/nivo-ui`) was governed by no starci-fe rule and a deliberate bare `<img>` there printed nothing. The source glob is now `packages/*/src/**/*.{ts,tsx}` and the e2e glob adds `packages/*/e2e/**/*.{ts,tsx}`; every package is judged by the same rules.

## 5.1.0 - 2026-09-29

Round 2 of the FE enforcers, measured on nivo-fe, starci-next-fe and miamia-fe. Twenty-two rules, every one an error; no rule of 5.0.0 changed. Each is registered in `knowledge/hfs/rules.yaml` under the catalogue rule it enforces, with a Vietnamese failure code.

- **Type safety (R22, `FE_TYPE_ESCAPE`)**: `no-type-assertion` (`as T`, `<T>x`; `as const` and `as unknown` stay), `no-non-null-assertion`, `no-explicit-any`. `no-double-cast` now has a why entry.
- **Lists (R65, `FE_LIST_KEY`)**, new law `lists`: `list-item-has-key`, `no-index-key`, `no-inline-literal-prop-in-list`.
- **Runtime hygiene (R65, R50)**, new law `hygiene`: `effect-subscription-needs-cleanup` (`FE_EFFECT_CLEANUP`), `no-data-fetch-in-effect` (`FE_EFFECT_FETCH`), `no-empty-catch` (`FE_SWALLOWED_ERROR`), `no-console` (`FE_CONSOLE_CALL`).
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
