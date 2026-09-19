# Lane v4-5 — todo-fe verification + FE convention audit

Convention source: `.claude/ex-testing/FE-CONVENTION.md`. Scope honored: writes only
inside `examples/todo-app-frontend/**` (none needed — see below) and this report;
`examples/ecommerce-app-fe/**` audited read-only.

Repo paths: `D:/Repositories/starci-academy-backend/.claude/examples/{todo-app-frontend,ecommerce-app-fe}`.

## 1. todo-fe gates

Run from `examples/todo-app-frontend`:

| Gate | Result |
|---|---|
| `npx eslint .` | 0 problems |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 16 files / 101 tests, all green |
| `npx vitest run --coverage` | green; `coverage/lcov.info` produced (45 KB, 106 SF entries) |

Coverage caveat: the first `--coverage` run died in `V8CoverageProvider.readCoverageFiles`
(`SyntaxError: Unexpected end of JSON input`) on a truncated stale shard,
`coverage/.tmp/coverage-6.json` (<5 bytes, leftover from an interrupted run). Deleted
`coverage/.tmp`, reran clean. Not a source defect — just stale generated artifacts; no
repo change required.

## 2. todo-fe convention audit

### Route tree (`src/app/`) — PASS

- All 10 `page.tsx` are thin shells exporting fixed `const Page = () => <XxxPage />`.
- `[lang]/layout.tsx` is the legitimate root locale wiring: `generateMetadata` via
  `getTranslations`, `hasLocale` guard, `getMessages`, `html lang` +
  `suppressHydrationWarning`, `AppProviders`, `dynamic = "force-dynamic"`. Fixed name
  `Layout`. This is the academy pattern, not a violation.
- `sign-in/turtle-master.png/route.ts` is a framework route-handler slot — allowed.
- Minor (not fixed): non-slot files in the route tree — `src/app/providers.tsx`,
  `src/app/globals.css`, `src/app/[lang]/recur/recur.css`. Common Next.js practice and
  canon lint accepts them; noted only.

### Surface tier (`src/components/pages/*`) — PASS

All 10 surfaces (`LocaleRootPage`, `NotifyPreferencesPage`, `NotifyUnsubscribePage`,
`PlanRootPage`, `PlanUsagePage`, `PrivacyPage`, `RecurPage`, `SignInPage`,
`TaskSharePage`, `TasksPage`) have the two-half split:

- `index.tsx` connected half: `export type XxxPageProps = Record<never, never>` +
  `void props`, reads via hooks (`useParams`, `useSearchParams`), renders the twin.
- `component.tsx` pure twin `XxxPageBase` with `{state, props, on}` where `state` is a
  per-screen union. Single-member unions (`"ready"`, `"redirecting"`) are honest
  one-situation vocabularies, consistent with the convention's intent.

Feature screens under `components/{audit,login,notify,plan,recur}/` follow the same
index/component + state-union shape (e.g. `ScheduleScreenView` states
`no-rule|refused|active|ended`).

### Lower tiers — deviation noted, deliberately not rewritten

- `components/blocks/{task-list,sign-in-form,share-invite}/component.tsx` carry
  multi-member `state` unions (`TaskListState = "empty" | "one-task" | "many-tasks" |
  "refused"`, etc.) rather than `isLoading?: boolean`. The convention's binary-state
  rule targets loading-or-not leaves; these blocks own documented `ui.*` situation
  vocabularies (refused, empty variants) that `isLoading` cannot express. Canon lint
  passes. Collapsing them to `isLoading` would delete real, spec-covered behavior —
  recorded here as a known deviation rather than "fixed" by destruction.
- Blocks sit at `blocks/<Name>/` without the `<category>/` level the convention's
  `blocks/<category>/<Name>/` sketch shows. Cosmetic; noted.
- `components/leaves/{Heading,Link}` are thin, state-free — conform.

### i18n — PASS with one observation

- Vietnamese exists only in `src/messages/vi.json` — verified by full-tree diacritics
  scan; zero hits outside messages.
- `en.json`/`vi.json` key parity: 185/185, symmetric diff empty both directions.
- `vi.json` is real Vietnamese (not English placeholders).
- Observation (not fixed): only the shell consumes next-intl — `theme/toggle`,
  `locale/switcher`, and `[lang]/layout.tsx` metadata call `useTranslations`/
  `getTranslations`. Feature screens (`TasksPage`, `TaskListView`, sign-in, share,
  notify, plan, recur, privacy) hardcode English copy, so most of the 185 translated
  keys are currently unconsumed. Wiring every screen to the dictionary is a
  feature-scale change, not a drift fix; flagged for the owning lane.

### Specs — PASS

All 16 spec files are English; no non-English source outside `src/messages/`.

**Drift fixed in todo-fe: none required.** Every must-fix audit criterion (thin fixed-
name slots, index/component + state union on surfaces, Vietnamese confinement, English
specs) already holds; the only gate failure was the stale coverage shard, resolved by
deleting generated artifacts.

## 3. ec-fe convention audit (READ-ONLY — findings for the owning lane)

Layout at read time: monorepo `apps/{landing,shop}`, shared code still under `types/`
(`types/i18n`, `types/messages`, `types/theme`, imported via `@shared/*` alias) — the
`packages/shared` migration by the parallel lane has not landed yet.

### Violations / drift

1. **`apps/shop/src/app/[lang]/page.tsx` — logic inside the slot.** The shop index
   slot awaits `params` and calls `redirect()` itself instead of mounting a thin
   `const Page = () => <ShopRootPage />`. The sibling todo-fe puts the identical
   redirect inside `LocaleRootPage`'s connected half. Fix: extract a
   `components/pages/ShopRootPage/` (index + component pair, `state: "redirecting"`)
   and restore the slot to the fixed thin-shell shape.

2. **Components outside the tier tree.** Files directly under `components/`:
   - landing: `DuckMascot.tsx`, `ProductCard.tsx`, `classNames.ts`
   - shop: `DuckMascot.tsx`, `ProductTile.tsx`, `StateBlock.tsx`, `classNames.ts`
   Convention organizes all components under
   `components/{leaves,branches,composites,blocks}/<Name>/`. Fix: move each into a
   tier folder (e.g. `leaves/DuckMascot/`, `composites/ProductTile/`,
   `leaves/StateBlock/`) with the folder's `index.tsx` surface.

3. **Raw internal `<a>` in `apps/landing/src/components/layouts/SiteLayout/component.tsx`.**
   The wordmark uses `<a href={props.props.homeHref}>` for an in-app destination; the
   convention routes internal anchors through the `Link` leaf / `TextAction`
   (`starci-fe/no-internal-starci-href`). Fix: render the wordmark via the link leaf.

4. **Style inconsistency (semicolons + 2-space type-literal indent).** Convention:
   no semicolons, indent 4. Offenders include `apps/shop/src/app/[lang]/layout.tsx`,
   `apps/shop/src/app/[lang]/page.tsx`, `apps/shop/src/components/StateBlock.tsx`,
   `apps/shop/src/components/ProductTile.tsx`, `apps/shop/src/modules/api/*.ts`,
   `apps/landing/src/components/{DuckMascot,ProductCard}.tsx`, and several `types/*`
   files. Mixed across the repo — needs a normalization pass by the owning lane.

5. **Non-slot files in route trees.** `apps/{landing,shop}/src/app/providers.tsx`
   and `globals.css` sit inside `app/`. Same minor pattern as todo-fe; noted for
   completeness, canon lint accepts it.

6. **Canon rules disabled.** `eslint.config.mjs` turns off
   `starci-fe/no-second-language-in-source` and `starci-fe/no-emoji-in-source`.
   Pre-existing, untouched per read-only scope — surfaced for the maintainer since
   this lane's charter is to keep `starci-fe/*` enabled.

### Conforms

- Every `page.tsx` except the shop index is the fixed `const Page = () => <XxxPage />`
  shell (`account`, `browse`, `cart`, `checkout` `force-dynamic` route config is a
  legit slot directive). Both `[lang]/layout.tsx` files are the legitimate root locale
  wiring (`Layout`, `hasLocale` guard, `getMessages`, `suppressHydrationWarning`).
- All surfaces have index/component split with state unions on the pure twin:
  `SiteLayout`/`ShopLayout` (`{content}` prop spelled correctly, `body` component
  pattern), `LandingPage` (`ready`), `BrowsePage` (`failed|empty|ready` +
  `browsePageStateOf`), `AccountPage` (`failed|empty|ready` + `accountPageStateOf`),
  `CartPage`/`CheckoutPage` (`ready`). Pure twins resolve zero strings/hooks
  themselves — all copy arrives via props. This is the convention done better than
  todo-fe on i18n.
- i18n: `LOCALES = ["en","vi"]` in `types/i18n/config.ts`; `en.json`/`vi.json` parity
  71/71 both directions; `vi.json` is real Vietnamese; zero Vietnamese outside
  `types/messages/`. Screens consume `useTranslations`/`getTranslations` throughout.
- No spec files exist in ec-fe (tests-English criterion vacuously holds).

## 4. Bottom line

- todo-fe: all four gates green; convention already satisfied; nothing needed editing.
- ec-fe: 4 real findings (shop index slot logic, untiered components, raw internal
  `<a>`, style normalization) + 2 notes (providers in route tree, disabled canon
  rules) handed to the owning lane.
