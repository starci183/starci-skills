# Lane v4-1 — ec-fe monorepo shared-package refactor

SCOPE (exclusive): `examples/ecommerce-app-fe/**` only. No other lane touches it.

## Context

`ecommerce-app-fe` is an npm-workspace monorepo (`apps/landing`, `apps/shop`) whose shared code lives in a `types/` dir aliased as `@shared/*` (tsconfig paths). StarCi canon (`@starci/eslint-canon-fe`, resolved locally via `file:../../packages/fe`) defines the correct monorepo layout: the shared package lives at `packages/<name>/src/` and holds ONLY the feature-free tiers `leaves/`, `composites/`, `branches/` — `blocks/overlays/layouts/pages` belong to the app (rule `starci-fe/monorepo-tier-belongs-to-its-side`).

Problems to fix:
- `DuckMascot.tsx` is duplicated byte-for-byte (comment wording differs) at `apps/landing/src/components/` and `apps/shop/src/components/` — loose file, no tier.
- `ProductCard.tsx` (landing) and `ProductTile.tsx` (shop) are the same catalogue-tile role with slightly different props (shop's has optional `imageUrl` + `blurb`).
- `StateBlock.tsx` (shop) is a generic empty-state (`EmptyNotice` + optional mascot) — feature-free.
- Loose `.tsx` at `components/` root is not a canon tier location anywhere.
- `types/` is not the canon package shape (`packages/<name>/src/`).

## Tasks

1. Move `types/` → `packages/shared/src/` (i18n, messages, theme, global.d.ts all keep their subdirs). Update every reference:
   - root `tsconfig.json`: `paths["@shared/*"]` + `include`
   - `apps/*/tsconfig.json`: `paths["@shared/*"]: ["../../packages/shared/src/*"]` + include entries
   - `apps/*/next.config.mjs`: `createNextIntlPlugin('../../packages/shared/src/i18n/request.ts')`
   - `eslint.config.mjs`: `types/**` globs → `packages/**`
   - Any other file referencing `types/` (grep for `types/` and `@shared/` across the repo, excluding node_modules). Keep the `@shared/*` alias name — it still reads correctly.
   - `packages/shared` does NOT need to become an npm workspace package; path alias resolution is enough.
2. Create shared leaves under `packages/shared/src/leaves/` following the academy leaf shape (`<Name>/index.tsx` + `classNames.ts` when the component has classes; `index.spec.tsx` optional):
   - `leaves/DuckMascot/index.tsx` — the one authored mark; merge the two comment variants into one honest comment (brand mascot, may-appear-in semantics).
   - `leaves/CatalogueTile/{index.tsx,classNames.ts}` — ONE component replacing both ProductCard and ProductTile. Props: `{ name: string; price: string; blurb?: string; imageUrl?: string }` — presentational fields only, NO `Product` type (feature knowledge stays in each app). `imageUrl` present → `MediaFrame`+img; absent → tinted initial-letter fallback (use the shop's classNames set; landing's `aspect-[4/3]` glyph is the same role — pick one consistent treatment, prefer shop's `aspect-[4/3]`-style fallback as the single neutral answer).
   - `leaves/StateBlock/{index.tsx,classNames.ts}` — move shop's StateBlock as-is (it already composes grammar `EmptyNotice` + optional mascot).
   - All three import from `@starci/grammar/common` (a real dep, resolvable from node_modules).
3. Delete `apps/landing/src/components/{DuckMascot,ProductCard}.tsx` and `apps/shop/src/components/{DuckMascot,ProductTile,StateBlock}.tsx`. Move their classNames entries out of `apps/*/src/components/classNames.ts` into the leaf folders; if an app's `classNames.ts` becomes empty, delete the file.
4. Update call sites:
   - `apps/landing/src/components/pages/LandingPage/component.tsx` — replace ProductCard usage: map its `Product` (from `../data/catalog`) to `{name, price: formatPrice(...), blurb}` and render `CatalogueTile`; same for `DuckMascot` import → `@shared/leaves/DuckMascot`.
   - `apps/shop/src/components/pages/{AccountPage,BrowsePage,CartPage,CheckoutPage}/component.tsx` — same treatment for `ProductTile`/`StateBlock`/`DuckMascot` → `@shared/leaves/...`. Shop keeps its own `formatPrice`/`Product` imports for the mapping.
5. Lower-tier components keep `isLoading?: boolean` semantics; do not introduce `state` unions here (those are for pages/layouts/overlays only).
6. Verify: `npx eslint .` clean (all globs incl. `packages/**`), `npx tsc --noEmit` clean, `npm run build` succeeds for BOTH apps if it completes in reasonable time (Next build may be heavy — if it fails only on environment/network, note it; code errors must be fixed).

## Rules

- Follow `.claude/packages/fe` canon rules — do NOT disable any `starci-fe/*` rule to get green.
- English everywhere in code/comments; Vietnamese lives only in `packages/shared/src/messages/vi.json`.
- No `any`, no inline object types where canon forbids, `Array<T>` generic form, double quotes, no semicolons, indent 4 — match existing style.
- Write a short report to `examples/../ex-testing/lint/v4-1-REPORT.md` (i.e. `D:/Repositories/starci-academy-backend/.claude/ex-testing/lint/v4-1-REPORT.md`): what moved, final eslint/tsc/build status.
