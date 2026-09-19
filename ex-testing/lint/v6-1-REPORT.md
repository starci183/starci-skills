# Lane v6-1 — repair ecommerce-app-be .starciwork records (gate: 19 refused)

Date: 2026-09-19. Scope honored: wrote only inside
`examples/ecommerce-app-be/.starciwork/**` plus this report. No app source,
other examples, or `packages/` touched. todo-app-backend refusals remain owned
by other lanes.

## Result

`node .claude/scripts/check-example-work.mjs` (from `.claude/`):

- Before: 200 refused tree-wide, **19 under `examples/ecommerce-app-be`**.
- After: 181 refused, **0 under ecommerce-app-be** — every refusal left is
  `todo-app-backend` (render-proof / blocker warnings owned by other lanes).
- `check-example-derived.mjs`: ecommerce-app-be `_derived/` regenerated and
  fresh; the only stale `_derived` left is todo-app-backend's (not this lane).

## 1. OWNER_PATH_MISSING ×5 — `apps/<app>/src/...` → merged `src/` layout

Verified on disk: modules merged to `src/modules/bussiness/{account,cart,
catalog,order,payment,session}`, `src/modules/integrations/{identity,order}`,
`src/features/{checkout,identity}`; `apps/{identity,order}` now holds only the
deployable shells (package.json, main.ts, app.module.ts, boot spec). Rewrites:

- `features/checkout/br/place-order/index.yaml` — `module:` →
  `src/modules/bussiness/order`, `src/modules/integrations/identity`,
  `src/modules/integrations/order`.
- `features/checkout/impl/ecommerce-app-be/order-checkout/index.yaml` — six
  `owners[].path` → `src/modules/bussiness/{order,cart,catalog,payment}`,
  `src/modules/integrations/identity`, `src/features/checkout`; title
  "of apps/order" → "of the order service".
- `features/checkout/sds/order-flow/index.yaml` — four owners →
  `src/modules/bussiness/{order,cart,payment,catalog}`.
- `features/identity/br/sign-in/index.yaml` — `module:` →
  `src/modules/bussiness/{account,session}`.
- `features/identity/impl/ecommerce-app-be/identity-account/index.yaml` — four
  owners → `src/modules/bussiness/{account,session}`,
  `src/modules/integrations/order`, `src/features/identity`; title updated
  likewise.

Also-fixed stale paths the gate does not check (same merge fallout):

- `features/checkout/fr/place-order/index.yaml` and
  `features/identity/fr/sign-in/index.yaml` — `composes[].module` repointed;
  `requiresProof.e2e.command: node scripts/live-proof.mjs` replaced with the
  e2e commands that actually prove the flow today (see §3).

## 2. `id is undefined` ×6 — asset payloads now typed payloads

The gate walks every `.yaml` under `features/`; a file escapes the
id-matches-place rule only by being named `evidence.yaml`, carrying an EXEMPT
schema (`work/catalog`, `work/workspace`, `work/brand`, `work/feature`,
`work/disposable-accounts`, `starci/application-stacks`), or parsing to a
non-object. The sanctioned pattern already in the tree is the UAT run
manifest: a `starci/*@1` schema marker plus the `id` the file's place dictates
(`scripts/check-example-work.mjs` `expectedId`). Applied:

- 5 × `assets/generation-receipts.yaml` → `schema: starci/generation-receipts@1`
  + `id: ui.<feature>.<screen>.assets` (cart, landing-home, shop-browse,
  stock-refused, identity/sign-in).
- `checkout/ui/landing-home/assets/direction-check.yaml` →
  `schema: starci/direction-check@1` + `id: ui.checkout.landing-home.assets`
  (its own `kind: direction-artifact-verification` kept).

Files were not deleted; content unchanged except the added header pair. They
now enter the records map exactly like run manifests do — derived index
regenerated accordingly (§4).

## 3. CODE_DIGEST_STALE ×8 — evidence regenerated against real code

All 8 evidence.yaml files were regenerated via
`node scripts/example-evidence.mjs --work examples/ecommerce-app-be/.starciwork
--record <id> --cwd examples/ecommerce-app-be`. Fresh `recordDigest` +
`codeDigest` over the new `src/` owners; every recorded assertion exits 0.

Two recorded commands could not survive the merge and were replaced with their
current equivalents, per the brief's rule:

- `node scripts/live-proof.mjs` — **genuinely dead**: the merged services no
  longer mount the REST doors it drives (`/auth/*`, `/cart`, `/orders`,
  `/accounts/:id` 404; the current surface is `/graphql` +
  `/internal/{sessions,buyers}` + `/health`, confirmed live). Equivalent live
  proof is the e2e suite, which boots its own compose stack and drives the
  real GraphQL doors:
  - `order-lifecycle/order-history` — register→placeOrder→confirmed/paid,
    `hasOrders` false→true through order's `/internal/buyers` and identity's
    `account` query, idempotent replay never appends (becomes-a-buyer,
    contract wire, fr/sds live claims).
  - `order-lifecycle/cross-service-identity` — session verify over live HTTP,
    revoked/expired refused at the order boundary.
  - `checkout/payment-failure` — refused confirmation rollback + cart-empty.
  - `identity/sign-up-sign-in` — register/signIn/verify/revoke + account read.
- `npx jest apps/order` / `npx jest apps/identity` — path patterns targeting
  the old layout; retargeted to each impl record's actual owner dirs
  (`npx jest src/modules/bussiness/order src/modules/bussiness/cart
  src/modules/bussiness/catalog src/modules/bussiness/payment
  src/modules/integrations/identity src/features/checkout --runInBand` →
  14 suites / 78 tests; the identity set → 11 suites / 59 tests).
- `npx jest -t <name>` assertions all still match test names in the merged
  specs and pass; `--runInBand` is part of every recorded unit command because
  jest workers cannot spawn on this host (`spawn UNKNOWN` under the default
  pool) — it is the command as actually run.

Evidence outcome summary (all `outcome: pass`):

| record | assertions (all exit 0) |
|---|---|
| br.checkout.place-order | e2e `order-lifecycle`; `-t` empty-cart-is-refused; `-t` stock-is-checked-at-confirmation |
| contract.checkout.order-for-identity | `buyer.controller.spec`; `order.client.spec`; e2e `order-lifecycle` |
| fr.checkout.place-order | `-t fr.checkout.place-order`; e2e `order-lifecycle checkout/payment-failure` |
| impl.checkout.ecommerce-app-be.order-checkout | unit over its 6 owner dirs; e2e `order-lifecycle checkout/payment-failure` |
| sds.checkout.order-flow | `-t sds.checkout.order-flow`; `-t t-refuse`; e2e `order-lifecycle` |
| br.identity.sign-in | `-t` both acceptance criteria |
| fr.identity.sign-in | `-t fr.identity.sign-in`; e2e `identity/sign-up-sign-in` |
| impl.identity.ecommerce-app-be.identity-account | unit over its 4 owner dirs; e2e `identity/sign-up-sign-in order-lifecycle/cross-service-identity` |

## 4. Derived artifacts regenerated

`example-derive.mjs --write` + `example-critique.mjs --write` on this tree:
11 lifecycle records (8 done / 3 todo / 0 stale / 0 blocked), 1 gap, 3 in the
frontier; critique clean. The six new payload records appear in
`_derived/index.yaml` as stateless nodes, same as UAT run manifests.

## 5. Environment notes / findings reported, not fixed (out of scope)

- `src/tests/e2e/checkout/checkout-journey.e2e-spec.ts` does not compile
  (TS2459 non-exported `E2EHttpClient`/`E2EGraphqlClient`, TS7006 implicit
  any) — it was *not* usable as evidence; app source is outside this lane.
- `npm run start:*` as authored cannot resolve `@modules/*` from `dist/` —
  the working launch needs `TS_NODE_BASEURL=<repo>/dist` (the e2e harness does
  exactly this, `src/tests/infra/platform/stack/e2e-stack.service.ts`).
- jest worker spawn fails on this Windows host; `--runInBand` is required and
  is what the evidence records.
- To probe live behavior this lane temporarily started the dev stack
  (`docker compose up -d postgres redis`, both APIs via `TS_NODE_BASEURL`);
  `live-proof.mjs` then demonstrably failed 12/14 with 404s, which is how the
  REST-surface removal was verified. Stack and processes were torn down after
  (`compose down`, volume preserved).

## Remaining refusals in scope

None. `check-example-work.mjs` reports 0 refused and 0 warnings for
`examples/ecommerce-app-be`.
