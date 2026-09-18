# ecommerce-app-fe — Next.js monorepo example

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
from `brand/tokens.css` (teal `#0D9488`, Inter via `@fontsource-variable/inter`, the on-primary ink chosen
because white on teal measures 3.74:1 — under the brand record's 4.5:1 floor). The friendly-duck mascot
(`brand/duck.prompt.txt` is its direction) appears on welcome and genuine empty surfaces only — never on
refusal or error surfaces, per the brand record's `neverIn`.

It owns no `.starciwork` (the backend repo owns the Work tree, same rule as `todo-app-frontend`) and no
auth: the landing → shop session handoff is a contract the backend lane and a later workstream settle,
marked in-source with `// contract:` pointers.

## Ports: there is one projection and it is read, never restated

The product's resolved runtime projection is **`../ecommerce-app-be/metadata.json`** (`ports.landing`,
`ports.shop`, `ports.identityApi`, `ports.orderApi`) — the BE repo owns it because it owns the Work tree,
and its own README states the FE lane's ports are "declared here, consumed there". No port literal exists
in this repository:

- `scripts/serve.mjs` resolves the listener port and spawns `next dev`/`next start -p` per app.
- Each app's `src/modules/config/projection.ts` resolves the same file for the service base URLs — the
  per-app reader copies mirror the BE's own per-service `AppConfigService` convention.
- Resolution order (same shape as the BE's `findMetadataFile`): `ECOMMERCE_APP_BE_METADATA` names the
  file outright, else the walk searches each ancestor for `ecommerce-app-be/metadata.json`.
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
states. That is the intended honest behavior — see `captures/` for the running-page record (script +
PNG + markup per route and viewport; replay with `node captures/capture.mjs` while both apps serve).
