# ecommerce-app-fe

Two Next.js ecommerce applications share one npm workspace and UI package.

## Overview

The frontend half of the ecommerce example, shaped like `nivo-fe`: one repo, npm workspaces, one deployable
Next.js app per `apps/*` site. Two apps:

| app | package | what it is |
| --- | --- | --- |
| `apps/landing` | `@ecommerce/landing` | Public marketing site + catalogue teaser |
| `apps/shop` | `@ecommerce/shop` | Authenticated shop: browse, cart, checkout, account |

The apps are real, runnable Next.js builds on `@starci/grammar` primitives (the same Common family
todo-app-frontend consumes): grammar's `GrammarRoot` boundary wraps each app's client shell, and every
surface maps to a real grammar component (`SurfaceCard`, `SurfaceListCard`, `EmptyNotice`, `Button`,
`TextAction`, `SectionHeader`, `MediaFrame`, `Badge`) or is honestly an app-owned layout. Brand tokens come
from `packages/shared/src/modules/theme/brand-tokens.css` (teal `#0D9488`, Inter via `@fontsource-variable/inter`,
the on-primary ink chosen because white on teal measures 3.74:1 — under the brand record's 4.5:1 floor).
The friendly-duck mascot (its direction is a brand record asset at
`../ecommerce-app-be/.starciwork/brand/assets/duck.prompt.txt`) appears on welcome and genuine empty
surfaces only — never on refusal or error surfaces, per the brand record's `neverIn`.

It owns no `.starciwork` (the backend repo owns the Work tree, same rule as `todo-app-frontend`) and no
auth: the landing → shop session handoff is a contract the backend lane and a later workstream settle,
marked in-source with `// contract:` pointers.

## Stack

Next.js, React, TypeScript, npm workspaces, `@starci/grammar`, Vitest and Playwright.

## Repository layout

- `apps/landing/src`: public marketing app; `apps/shop/src`: authenticated shop app.
- `packages/shared`: shared UI and runtime configuration package.
- `scripts/`: repository tooling; `e2e/`: Playwright `*.e2e-spec.ts` flows, run by `npm run test:e2e` through the root `playwright.config.ts`. E2E runs manually only (owner ruling 2026-09-29): no hook, default typecheck/lint, coverage or automatic CI job runs it; `npm run typecheck:e2e` is its manual type check.
- The paired backend owns `.starciwork` and `.starcistacks` for this product.

## Development

From this directory run `npm install`, then `npm run typecheck`, `npm run lint:check`,
`npm run build` and `npm run test:unit`. The commands below start the apps using the
paired backend's port projection.

## Ports: there is one projection and it is read, never restated

The product's resolved runtime projection is **`../ecommerce-app-be/.starcistacks/dev/infra/metadata.json`** (`ports.landing`,
`ports.shop`, `ports.identityApi`, `ports.orderApi`) — the BE repo owns it because it owns the Work tree,
and its own README states the FE lane's ports are "declared here, consumed there". No port literal exists
in this repository:

- `scripts/serve.mjs` resolves the listener port and spawns `next dev`/`next start -p` per app.
- `packages/shared/src/modules/config/projection.ts` resolves the file for both apps' service base URLs;
  each app's `src/modules/config` module applies its own environment overrides.
- Resolution order (same shape as the BE's `findMetadataFile`): `ECOMMERCE_APP_BE_METADATA` names the
  file outright, else the walk searches each ancestor for `ecommerce-app-be/.starcistacks/dev/infra/metadata.json`.
- Env overrides keep the BE's precedence — `NEXT_PUBLIC_ORDER_API_URL`, `NEXT_PUBLIC_IDENTITY_API_URL`,
  `NEXT_PUBLIC_SHOP_URL` win outright; the projection is the fallback.

Each env is read once in the app's `src/modules/config` module (nivo-fe's convention); pages and components
import the resolved constant, not `process.env`.

## Run it

```sh
cd examples/ecommerce-app-fe
npm install

# both apps, concurrently (ports resolved from the projection):
npm run dev

# or one at a time:
npm run dev:landing
npm run dev:shop

# build + serve the production build:
npm run build
npm run start        # or start:landing / start:shop

# typecheck the whole workspace from the root:
npm run typecheck
```

With no backend running, `/browse` and `/account` in the shop render their unreachable states and name the
service and reason rather than showing placeholder data; `/cart` and `/checkout` render their genuine empty
states. That is the intended honest behavior — `node scripts/capture.mjs` while both apps serve writes
the running-page record (PNG + markup per route and viewport) under `captures/`, gitignored agent
output; `node scripts/verify-render.mjs --record <ui-screen-id> <custody|captures|render>` checks the
pairs against the Work tree's ui records.
