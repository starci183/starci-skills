# Lane v4-1 — ec-fe monorepo shared-package refactor

Scope: `examples/ecommerce-app-fe/**` only.

## What moved

### `types/` → `packages/shared/src/`

The whole shared tree moved intact; subdirs kept:

- `types/i18n/{config,navigation,request,routing}.ts` → `packages/shared/src/i18n/`
- `types/messages/{en,vi}.json` → `packages/shared/src/messages/` (Vietnamese stays in `vi.json`)
- `types/theme/{DisplayControls.tsx,theme-context.tsx,tokens.css}` → `packages/shared/src/theme/`
- `types/global.d.ts` → `packages/shared/src/global.d.ts`
- `types/` directory removed. `packages/shared` is not an npm workspace package; the `@shared/*`
  path alias resolves it.

Reference updates:

- root `tsconfig.json`: `paths["@shared/*"]` → `./packages/shared/src/*`, `include` → `packages/shared/src/**`
- `apps/{landing,shop}/tsconfig.json`: `paths["@shared/*"]` → `../../packages/shared/src/*`, `include` updated
- `apps/{landing,shop}/next.config.mjs`: `createNextIntlPlugin('../../packages/shared/src/i18n/request.ts')` + comment
- `eslint.config.mjs`: `APP_GLOBS` and the js/recommended `files` entry now glob `packages/**` instead of `types/**`
- `apps/{landing,shop}/src/app/globals.css`: `@import` + `@source` repointed to `packages/shared/src`, comment updated
- `sonar-project.properties`: `sonar.sources=apps,packages`
- `packages/shared/src/i18n/request.ts`: doc comment now names `packages/shared/src/messages/*.json`

### New shared leaves under `packages/shared/src/leaves/`

- `leaves/DuckMascot/index.tsx` — the one authored mark (was duplicated byte-for-byte in both apps'
  `components/`). The two comment variants merged into one honest comment: single shared mark,
  `mayAppearIn`/`neverIn` semantics kept. No classes → no `classNames.ts`.
- `leaves/CatalogueTile/{index.tsx,classNames.ts}` — replaces `ProductCard` (landing) and
  `ProductTile` (shop). Flat presentational props `{ name, price, blurb?, imageUrl? }` — no
  `Product` type; feature knowledge stays in each app. `imageUrl` → `MediaFrame` + `img`;
  absent → the tinted `aspect-[4/3]` initial-letter fallback (shop's classNames set as the single
  neutral treatment).
- `leaves/StateBlock/{index.tsx,classNames.ts}` — shop's `StateBlock` moved as-is (composes
  grammar `EmptyNotice` + optional mascot); `DuckMascot` import repointed to the sibling leaf.
- All three import from `@starci/grammar/common`.

### Deleted

- `apps/landing/src/components/{DuckMascot,ProductCard}.tsx`
- `apps/shop/src/components/{DuckMascot,ProductTile,StateBlock}.tsx`
- `apps/{landing,shop}/src/components/classNames.ts` — both emptied by the move, so deleted.
  `apps/*/src/components/` now holds only `layouts/` and `pages/`.

### Call sites

- `LandingPage/component.tsx`: `ProductCard` → `CatalogueTile` mapping `Product` to
  `{ name, price: formatPrice(...), blurb }`; `DuckMascot` → `@shared/leaves/DuckMascot`.
- `BrowsePage/component.tsx`: `ProductTile` → `CatalogueTile` (incl. `imageUrl`), `StateBlock` →
  `@shared/leaves/StateBlock`; `formatPrice` imported from `modules/money`.
- `AccountPage`, `CartPage`, `CheckoutPage`: `StateBlock` → `@shared/leaves/StateBlock`.

No `isLoading`/`state` union changes — leaf semantics unchanged.

## Verification

- `npx eslint .` — clean, exit 0 (covers `apps/**` + `packages/**`)
- `npx tsc --noEmit` — clean, exit 0 (root tsconfig covers `packages/shared/src/**` + `apps/*/src/**`)
- `npm run build` — BOTH apps succeed: landing compiled in 24.4s, shop in 12.4s; all routes
  generated, lint+type validity checks pass inside each Next build. Only pre-existing warnings
  (multi-lockfile workspace-root inference, next-intl webpack cache parse note) — no code errors.
