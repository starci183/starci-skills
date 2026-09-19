# Lane v5-6 (qwen) — ec-fe unit suite: coverage 0.0% → 40.48%

Date: 2026-09-19. Scope honored: writes only inside
`examples/ecommerce-app-fe` (spec files + the harness/config edits the brief allows:
`package.json`, `vitest.config.ts`, `vitest.setup.ts`, root + both app `tsconfig.json`,
`sonar-project.properties`, `.gitignore`) plus this report. No other repo touched, no
git operations, no `packages/shared/src/theme/**` or `packages/shared/src/i18n/**` edits.

## 1. Coverage number achieved

`npx vitest run --coverage` → **40.48% statements / 54.05% branch / 36.00% funcs /
40.48% lines** over the whole analysed tree (`apps/*/src/**`, `packages/shared/src/**`,
`all: true` default, so untested files stay in the denominator — the number is not
flattered by exclusions).

Every surface this lane was asked to cover is at **100%** (stmts/branch/funcs/lines):

| Surface | % |
|---|---|
| `packages/shared/src/leaves/CatalogueTile` | 100 |
| `packages/shared/src/leaves/StateBlock` | 100 |
| `packages/shared/src/leaves/DuckMascot` | 100 |
| `apps/landing/.../LandingPage/component.tsx` | 100 |
| `apps/landing/.../SiteLayout/component.tsx` | 100 |
| `apps/shop/.../BrowsePage/component.tsx` | 100 |
| `apps/shop/.../CartPage/component.tsx` | 100 |
| `apps/shop/.../CheckoutPage/component.tsx` | 100 |
| `apps/shop/.../AccountPage/component.tsx` | 100 |
| `apps/shop/.../ShopRootPage/component.tsx` | 100 |
| `apps/shop/.../ShopLayout/component.tsx` | 100 |
| `apps/shop/src/modules/money.ts` | 100 |
| `apps/landing/src/modules/shop-url.tsx` | 100 |
| every `classNames.ts` twin | 100 |

The residual 59.5% is the honest remainder: the connected `index.tsx` halves (8 files,
server-side reads through `next-intl/server` + the API modules), the route shells
(`app/**/page.tsx`, `layout.tsx`, `providers.tsx`), `middleware.ts`, `modules/config/**`
(server-only env reads), and `modules/api/{http,catalog,orders,identity}.ts`. None of
those is a "stable surface" under this brief; they are the next lane's work, not a gap
here. `apps/*/src/modules/routes.ts` (two constant maps) is deliberately left
unspecified rather than padded with a tautological test.

## 2. Harness (mirrored from todo-fe, same versions)

- Root devDeps added with **todo-fe's declared ranges, nothing new**: `vitest@^2.1.2`,
  `@vitest/coverage-v8@^2.1.2`, `@testing-library/react@^16.0.1`,
  `@testing-library/dom@^10.4.2`, `@testing-library/jest-dom@^6.5.0`, `jsdom@^25.0.1`.
  Resolved tree = `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2,
  `@testing-library/jest-dom` 6.9.1, `jsdom` 25.0.1 — identical to todo-fe's installed
  copies. `vitest`/`@vitest/coverage-v8` resolve to **2.1.2** here where todo-fe's lock
  carries **2.1.9**: same declared range (`^2.1.2`), same major/minor, the only
  difference is which patch each app's own lockfile pinned. No runtime dependency added,
  no `next-themes`, no second copy of anything.
- `vitest.config.ts` at the monorepo root: jsdom environment, `esbuild.jsx:
  automatic`, `include: apps/*/src/**/*.spec.{ts,tsx}` + `packages/*/src/**`,
  `globals: false`, v8 provider, reporters `text`/`lcov`/`json-summary`,
  `reportsDirectory: 'coverage'` → **`coverage/lcov.info` at the repo root** (57 SF
  entries), exactly where `sonar.javascript.lcov.reportPaths` already pointed.
- `vitest.setup.ts`: `cleanup()` on `afterEach` + `@testing-library/jest-dom/vitest`.
- Scripts: `"test:unit": "vitest run"`, `"test:coverage": "vitest run --coverage"`
  (todo-fe's names).
- tsconfig: root `include` gained `vitest.config.ts`/`vitest.setup.ts`; both app
  tsconfigs gained `../../vitest.setup.ts` so `next build`'s own typecheck sees the
  jest-dom matcher augmentation (todo-fe needs no equivalent only because its `include`
  is `**/*.ts(x)`).
- sonar: `sonar.tests=apps,packages` (was `apps`) so the co-located specs under
  `packages/shared/src/leaves/**` are classified as tests; `test.inclusions`,
  `exclusions` and `coverage.exclusions` already matched `**/*.spec.ts(x)` and are
  unchanged. `.gitignore` gained `coverage` (todo-fe's line).

## 3. Specs — 13 files, 58 tests, behavior not snapshots

Real grammar components are mounted (`@starci/grammar/common` 0.4.13, published), and
assertions are made on the reader-visible contract, no snapshots anywhere:

- `CatalogueTile` — name as card label + amount as the label-row fact; blurb only when
  the row has one; a served `imageUrl` used untouched; no image → neutral aria-hidden
  initial letter and **no `<img>` element at all** (the "no broken/fabricated image URL"
  rule); initial comes from the name's first letter, uppercased.
- `StateBlock` — title + reason stated; the mascot joins only when the caller marks a
  genuine empty surface; mascot stays decorative; the caller's way out renders after the
  notice and keeps its href.
- `DuckMascot` — inline SVG artwork at brand 64 (never an `<img>`), `size` resizes both
  edges, glyph-contract props (`role`, `aria-label`, `focusable`, `data-*`) land on the
  root so it mounts in an Icon slot without an adapter.
- `LandingPageBase` — hero heading/lede, both doors (cross-app hand-off carries the
  locale-joined shop origin; the secondary is the in-page `#catalogue` anchor), mascot on
  the welcome surface and aria-hidden, teaser tiles priced from minor units (`$89.00`,
  never `8900`), an empty curation still holds the labelled region, pillar cards.
- `SiteLayoutBase` / `ShopLayoutBase` — wordmark → home, named `navigation` landmark,
  section links on their prefixed hrefs, `isCurrent` → `aria-current="page"` on the one
  current section only, the body lands in `main`, the landing repeats the shop hand-off
  in header and footer, an empty nav still frames the page.
- `BrowsePageBase` — the whole `state` union: `ready` (tiles in service order, served
  image used as served, row without one takes the neutral tile), `empty` (mascot
  present), `failed` (mascot absent, refusal text verbatim, no empty-state copy leaking
  in), heading stands in all three situations.
- `CartPageBase` / `CheckoutPageBase` — the honest blocked/empty surfaces: doors that
  exist carry their hrefs, the pending contract is stated, and no fabricated
  "order placed"/pay affordance appears.
- `AccountPageBase` — all three states; the counted list; every row's label, line count
  and amount; `STATUS_TONE` pinned for all four statuses (`open`→accent, `paid`→success,
  `shipped`→neutral, `cancelled`→warning); a full history is not an empty state.
- `ShopRootPageBase` — draws nothing.
- `money.ts` — minor units never surfaced, the locale table honored (EUR decimal comma,
  VND scaled), an unlisted code still readable, a non-currency code falls back to a
  tagged number.
- `shop-url.tsx` — the provider carries the server-resolved origin untouched, two
  mountings keep their own answers, a missing provider throws instead of inventing an
  origin.

Canon-fe law respected: specs are `.spec.tsx`/`.spec.ts` twins beside their owner (no
`.test.` suffix, no separate test tree), 4-space indent, double quotes, no semicolons,
English-only, no inline lint directives, no `data-testid` invented.

## 4. Gates (each exit captured through a marker file, because cmd.exe masks the real one)

All five re-run in one sweep at 17:09 local against the tree as v5-2 left it — every
marker `PASS`:

| Gate | Command | Result |
|---|---|---|
| unit | `npm run test:unit` | **PASS** — `Test Files 13 passed (13)`, `Tests 58 passed (58)` |
| lint | `npx eslint "apps/**/*.spec.ts" "apps/**/*.spec.tsx" "packages/**/*.spec.tsx"` | **PASS** — empty output, exit 0 |
| types | `npx tsc --noEmit` (root, specs + harness included) | **PASS** — no diagnostics, exit 0 |
| coverage | `npm run test:coverage` | **PASS** — green, 40.48% statements, `coverage/lcov.info` written at the root |
| build | `npm run build` (`@ecommerce/landing` then `@ecommerce/shop`) | **PASS** — `✓ Compiled successfully` for both |

## 5. v5-2 collision — followed, not blocked on (brief rule honored)

`starci-v5-2-fe-kit` (devin) moved the theme/i18n kit out of this repo into
`.claude/packages/fe-kit` **while this lane was running**, which is exactly the
"if v5-2 moves a file you spec'd mid-flight, follow the move" case:

1. Two `npm run build` attempts failed with `Module not found: Can't resolve
   '@fe-kit/i18n/i18n-context'`, `'@fe-kit/theme/theme-context'`,
   `'@fe-kit/theme/leaves/DisplayControls'` (raw npm exit 1, recorded honestly). The
   import traces were `src/app/providers.tsx`, `src/components/layouts/*/{index,component}.tsx`
   and `packages/shared/src/i18n/config.ts` — files v5-2 owns, none of them a spec, and
   `tsc` resolved `@fe-kit/*` the whole time (webpack needed the bundler-side alias the
   kit's own doc describes). No change on this lane's side was involved or needed.
2. The same move rewrote the mock specifier in my two layout specs
   (`@shared/theme/DisplayControls` → `@fe-kit/theme/leaves/DisplayControls`) and added
   the `@fe-kit` alias to my `vitest.config.ts`. Both were re-verified after the move
   rather than reverted: the suite is green against the new paths (13/13, 58/58), and so
   is the build. Note for the coordinator: those two files now carry another lane's
   edits inside my lane's scope.
3. `packages/shared/src/{theme,i18n}` were still on disk at last look (v5-2's shims at
   0% in the table above). If the extraction deletes them, the coverage denominator
   drops and this number moves up on its own; nothing in my specs asserts against
   `theme/**` or `i18n/**`, so the suite survives either way.

## 6. Files

Created: `vitest.config.ts`, `vitest.setup.ts`, 13 spec files —
`packages/shared/src/leaves/{CatalogueTile,StateBlock,DuckMascot}/index.spec.tsx`,
`apps/landing/src/components/pages/LandingPage/component.spec.tsx`,
`apps/landing/src/components/layouts/SiteLayout/component.spec.tsx`,
`apps/landing/src/modules/shop-url.spec.tsx`,
`apps/shop/src/components/layouts/ShopLayout/component.spec.tsx`,
`apps/shop/src/components/pages/{BrowsePage,CartPage,CheckoutPage,AccountPage,ShopRootPage}/component.spec.tsx`,
`apps/shop/src/modules/money.spec.ts`.

Modified: `package.json` (6 devDeps + 2 scripts), `package-lock.json` (from
`npm install`), root `tsconfig.json`, `apps/{landing,shop}/tsconfig.json`,
`sonar-project.properties`, `.gitignore`.
