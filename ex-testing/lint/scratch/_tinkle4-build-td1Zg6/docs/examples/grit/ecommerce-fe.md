# Ecommerce-app FE grit

Findings from cooking `examples/ecommerce-app-fe` for real (branch `starci183/ex-ec-fe`, 2026-09-18):
the scaffold (`apps/landing`, `apps/shop`) became a real pair of Next.js apps on `@starci/grammar`
0.4.13 + HeroUI + Tailwind v4, with every port read from the product projection and the brand
record's tokens/mascot rules made concrete. Verified live on this machine: `npm install`,
`npm run typecheck`, `npm run build`, `npm run start` — both apps served and were captured by
`examples/ecommerce-app-fe/captures/capture.mjs` (10 PNGs + markup, desktop + mobile).

## What the projection rule actually cost

- **The BE's walk-up doesn't reach the FE.** `AppConfigService.findMetadataFile` walks ancestors of
  cwd looking for `metadata.json` — but the projection lives in the *sibling* repo
  (`examples/ecommerce-app-be/metadata.json`), and no ancestor of `examples/ecommerce-app-fe` is
  named `metadata.json`. The FE's readers (`scripts/projection.mjs`, each app's
  `src/modules/config/projection.ts`) therefore walk ancestors looking for
  `ecommerce-app-be/metadata.json` — the sibling form of the same bargain. `ECOMMERCE_APP_BE_METADATA`
  still overrides outright. Worth knowing if a third consumer lane ever lands: the sibling-repo walk
  is now written down twice more, and a shared-runtime helper would remove the triplication.
- **Port literals were hiding in five places, not one**: `package.json` `dev`/`start -p` flags,
  each app's config fallback URLs, `architecture.json`'s `devPort` + `consumes[].localhostFallback`,
  the README table, and a prose comment in `modules/api/identity.ts`. The check "does the app
  restate a port" has to grep comments and docs too, not just code paths.
- **`architecture.json` had no schema to lean on.** Nothing in `scripts/checks/` reads `devPort` or
  `localhostFallback`, so the de-literalized shape (`{"projectionKey": "ports.shop"}` under a
  top-level `portProjection` pointer) is a convention, not a validated one. If the architecture
  check ever validates app entries, it now has a projection-keyed shape to prefer over a number.

## Brand findings

- **White on the primary fails the record's own rule.** `#0D9488` measures L≈0.230 (WCAG sRGB);
  white text on it is **3.74:1**, under the record's 4.5:1 floor. The on-primary ink is `#051817`
  (4.88:1), recorded in `brand/tokens.css` with the math. HeroUI's token ladder
  (`--accent-hover`/`--accent-soft`/`--accent-soft-foreground`) derives from `--accent` +
  `--accent-foreground`, so two tokens re-skin the whole vendor ladder with no invented hues — and
  `never restyle the primary` is satisfied by deriving, not recoloring.
- **"Empty" vs "unreachable" is a mascot split the scaffold didn't have.** The brand's `neverIn`
  covers refusal/error surfaces; its `mayAppearIn` covers empty states. `StateBlock` now takes an
  explicit `mascot` opt-in: `/cart`, `/checkout`, "catalogue empty", "no orders yet" carry the duck;
  every service-down surface does not. Any future "delete/refused" surface must not pass it.
- **The mascot is app-owned artwork, not a generated image.** `DuckMascot.tsx` is a hand-authored
  inline SVG (one authored mark, per-app ports like the projection readers); `brand/duck.prompt.txt`
  records the direction a generated successor is drawn from, in the prompt-shape-b2 form
  (frame / subject / fixed anatomy spelled literally / brand+tokens / bounded license / text rule).

## Grammar findings

- **Grammar is a client-only family** (`dist/core/index.js` is `"use client"`; components render
  through `@heroui/react` primitives + React Aria), so every grammar surface sits inside a
  `'use client'` view wrapped in `GrammarRoot` — the same boundary shape todo-app-frontend's feature
  entries use. Server pages keep the data reads and hand plain `Result` props across.
- **Read props from `dist/**/*.d.ts`, never the export list**: `Text` takes no `className`
  (wrap it), `SectionHeader`'s `id` lands on the `h{level}` (so `aria-labelledby` works),
  `EmptyNotice.description` is a plain string (rich copy goes in `children` below it),
  `SurfaceCard`'s `fact` is the label-row slot a price fits, and app-owned rows in a
  `SurfaceListCard` opt into separators via `starci-core-static-row` (edge-to-edge, per the
  `list-separator-bleed` observation).
- **Two pack-level facts worth knowing:** `@starci/grammar` peer-requires `@heroui/react`, and its
  renderers emit Tailwind utilities that only exist if the app's build scans the package
  (`@source '<repo>/node_modules/@starci/grammar/dist'` — the workspace-hoisted path here, four
  levels up from `src/app`, not todo-app-frontend's two).
- **fontsource via CSS `@import` rebases `url()`s to a path that 404s** under Next's CSS pipeline;
  the working import is the JS side-effect (`import '@fontsource-variable/inter'` in each app's
  root layout), which lets webpack emit the woff2 assets.

## Honest state (what did NOT happen)

- **The BE was never booted.** Docker Desktop is not running on this machine, so the dev
  Postgres/Redis the services need cannot start, and the BE repo is verify-only from this lane
  anyway. Every backend-dependent surface therefore renders its designed unreachable branch —
  the captures show refusal text naming the projected origin and reason, not placeholder data.
- **No auth was built.** The landing → shop session handoff is still the backend lane's unsettled
  contract (`// contract:` markers kept in `identity.ts`, `orders.ts`, `cart`, `checkout`); no fake
  signed-in identity, no invented cart storage, no "order placed" success. The brand's auth
  split-screen rule (illustration left, form right) is recorded as not-yet-applicable — there is no
  auth surface to place it on.
- **`next dev` was exercised through `start`'s sibling path** — `scripts/serve.mjs` spawns
  `next dev -p`/`next start -p` identically; the captures were taken against `next start`
  production builds.
