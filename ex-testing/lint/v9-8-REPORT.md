# Lane v9-8 — REPORT: port the uat/ rig into ecommerce-app-fe

Date: 2026-09-19. Scope: `examples/ecommerce-app-fe/uat/` (new rig, ported — not copied — from
`examples/todo-app-frontend/uat/`) + the owning records under
`examples/ecommerce-app-be/.starciwork/features/{checkout,identity}/`. Read first:
`v9/_common.md`, v9-8 brief, every todo `uat/lib/*.ts` + `uat/playwright.config.ts` +
`uat/global-setup.ts` + the two implemented todo specs, `v7-11-REPORT.md`, `v7-12-REPORT.md`.

## Verdict: rig proven end-to-end on a live stack; product outcome APP_CAPABILITY_MISSING

The harness runs a real Playwright/browser pass against the live shop and writes the full
canonical artifact set (screens + real .webm + manifest.yaml + walk.json + result.md +
cleanup.json + ledgers) into the backend-owned Work tree. What it measured is an honest
**fail**: the product currently cannot render `/browse` at all (shop-wide SSR 500).

Per the brief, the two real flow specs (`uat.identity.sign-in`, `uat.checkout.place-order`)
were NOT implemented — v9-9/v9-10 own them after v9-6/v9-7 land the features. Only the
single smoke spec `uat.smoke.browse` was authored.

## Port, not paste — adaptations vs the todo rig

| todo rig | ec port |
|---|---|
| `examples/todo-app-frontend` root | `examples/ecommerce-app-fe` |
| Work root `examples/todo-app-backend/.starciwork` | `examples/ecommerce-app-be/.starciwork` (backend-owned) |
| baseURL `http://localhost:3000` | `http://localhost:4069` — shop port, projected by `ecommerce-app-be/metadata.json` (`apps.shop.port`), resolved at runtime by `scripts/projection.mjs`/`serve.mjs`; overridable via `UAT_BASE_URL` |
| accounts resolved via Keycloak identity refs | `accounts.yaml` shape `{role, username, password}` read directly from the flow node — no identity lookup |
| run registry keyed on spec `describe` paths | same `flows/<feature>.<flow>.spec.ts` convention → `features/<feature>/uat/<flow>/runs/<runId>/` |

Files created (all under `examples/ecommerce-app-fe/uat/`): `lib/paths.ts`,
`lib/run-context.ts`, `lib/run-writer.ts`, `lib/steps.ts`, `lib/flow-records.ts`,
`global-setup.ts`, `playwright.config.ts` (screenshots + real video + one worker + the
custom reporter; raw Playwright output under OS temp, copied into canonical Work folders),
`tsconfig.json`, `flows/uat.smoke.spec.ts`.

package.json delta: `uat` (`playwright test -c uat/playwright.config.ts`) and
`uat:typecheck` (`tsc --noEmit -p uat/tsconfig.json`) scripts + `yaml@^2.9.1` devDependency
(lockfile updated). `npm run uat:typecheck` passes clean.

Harness fix during the port (documented per convention): the todo reporter resolved the run
id in `onBegin`, which crashes read-only invocations (`--list`) that never run
global-setup. The ec copy resolves it lazily in `onTestEnd` — by then global-setup is
guaranteed, and the hard `UAT_RUN_ID is not set` guard still fires if a real test ran
without it. Verified: `npm run uat -- --list` now exits 0 and lists the smoke test.

## Smoke spec — `uat.smoke.browse` (`flows/uat.smoke.spec.ts`)

Observation-driven, never throws on product defects: `goto('/browse')` → records final URL
(locale redirect `/en/browse`), HTTP status, whether the level-1 `Browse` heading rendered,
whether catalog tiles (level-3 product headings) or an `EmptyNotice` state block rendered.
Route counts resolved only on 200 + heading; catalog counts rendered only on ≥1 product
tile. `fr.checkout.place-order` is asserted `not-run` — the real flow is not implemented.
All outcomes land in walk.json/result.md; failures are never upgraded.

## Stack

Pre-running infra used as-is: postgres `:5501` (seeded: `sku-thermos` 2499×2,
`sku-mug` 1299×20, `sku-notebook` 899×15), redis `:6448`.

Booted: identity `:5070` and order `:6070` from `ecommerce-app-be/dist` —
**`npm run start:identity`/`start:order` are broken on Node 25** (emitted JS keeps
`@modules/*` aliases; `tsconfig-paths` needs `TS_NODE_BASEURL=<repo>/dist` plus
`ECOMMERCE_APP_BE_METADATA=<repo>/metadata.json`, as `scripts/e2e-stack.mjs` `spawnApi`
does). Flagged for the owning BE lane; not patched here (out of scope).

Shop `:4069` runs `next dev` (a prior `next start` instance was killed — port collision;
it returned the identical 500, so the defect is in source, not the mode). Shop dev server,
identity and order were left running for the in-flight FE lanes.

## Runs produced (append-only, both kept untouched)

`features/checkout/uat/place-order/runs/` — `/browse` is the place-order node's entry
surface, so the smoke lands there:

1. `20260919T142835Z-5c10a673` — `Outcome: inconclusive`, zero walked steps (first spec
   version aborted before step recording). Superseded, kept per never-edit-a-run.
2. `20260919T143843Z-5c10a673` — `Outcome: fail`. Two walked steps; artifacts verified:
   `screens/{browse-route-resolves,catalogue-surface,screenshot}.png`,
   `videos/place-order.webm` (real EBML WebM, ~2.8 KB), `manifest.yaml`, `walk.json`,
   `result.md`, `cleanup.json`, `run-ledger.json`, `ux-checks.json`, `readback.json`,
   `flows.json`. Recorded: `GET /browse → /en/browse` = **HTTP 500**; no Browse heading;
   no product grid; no state block; `fr.checkout.place-order` not-run.

## Product blockers named in owning gap records (not faked)

1. **Shop-wide SSR 500** — every route (`/en/browse`, `/en`, `/vi/browse`) crashes with
   `Error: No intl context found` at `ShopLayout`'s `usePathname()`. Systemic, observed
   while a concurrent lane was mid-edit on BrowsePage (new `control.tsx`/`actions.ts` and
   missing messages `shop.browse.stockLabel|addToCart|addingToCart|inCartLabel|addRefused|
   signedOut.*` also reported). Root cause belongs to v9-6/v9-7's in-flight work — not
   repaired here.
2. **No catalog door** — FE `fetchProducts()` calls `GET :6070/products`; order service
   exposes GraphQL only (`/graphql` live, `/products` 404). Named in
   `gap.checkout.live-proof`.
3. Cart + checkout routes are scaffolds; identity register/sign-in UI absent; the FE
   expects REST `/me`/auth doors the identity service does not expose
   (`/health` ok, `/graphql` live, no `/me`); landing→shop session handoff unsettled.
   Named in `gap.identity.live-proof` / `gap.checkout.live-proof`.

`uat.checkout.place-order/index.yaml` `blockedBy` now says explicitly: the existing run is
a smoke-harness proof only, not a passing implementation of the flow. Neither uat record
moved to `done`; both gaps stay `todo`.

## Gate

`node scripts/check-example-work.mjs`: **330 records, 7 refused** — none touch anything
this lane wrote (ec `ui/*/assets` id-less payloads and a todo-tree notify run manifest are
other lanes' in-flight items; a transient malformed-yaml crash observed mid-lane resolved
as that lane's edit settled). My three edited records and both run manifests parse and
bind clean.

## What remains

v9-6/v9-7 land the FE features + fix the SSR/intl crash; v9-9/v9-10 implement the two real
flow specs against this rig; the BE lane owns the `start:*` script fix and the
`/products`-vs-GraphQL catalog door decision.
