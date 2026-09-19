# v7-10 report — ecommerce-app-fe render proofs

Lane: `ex-testing/briefs/v7/v7-10.md`, procedures from `ex-testing/briefs/v7/_common.md`.
Target tree: `examples/ecommerce-app-be/.starciwork`. Host: `D:\Repositories\starci-academy-backend\.claude`.
Run date: 2026-09-19.

## Headline

**Zero declared ui states could be captured, and the reason is not a missing pipeline — the pipeline
exists and is correct.** All five ecommerce ui-screen records stay `state: uninvestigate`, which is the
honest state. Three independent blockers were found and each one is measured below with a raw exit code
or a wire response:

1. **Neither ecommerce app serves a page.** Every route on both `landing` (3069) and `shop` (4069) answers
   HTTP 500 with a Next error document, in `next start` *and* in `next dev`. Cause: two live `next-intl`
   module instances (the app's own 4.14.4 and a second 4.14.5 reached through `@fe-kit/*`), so
   `NextIntlClientProvider` registers a React context that the kit's `usePathname`/`useTranslations`
   never see.
2. **The render proof cannot bind to this Work tree's brand record.** `examples/ecommerce-app-be/.starciwork/
   brand/index.yaml` has no `brand:` block at all, so `scripts/example-render-proof.mjs`'s
   `readExampleBrand()` refuses with `[RENDER_BRAND_MISSING]` before a single check runs, and
   `checkPalette`/`checkEntityListInCard` degrade to three core-check `skip`s — which the gate counts as
   refusals, not passes.
3. **The frontend's three backend reads point at doors the merged backend no longer serves.** With both
   services up and healthy, `GET :6070/products`, `GET :5070/me` and `GET :6070/orders` each answer
   HTTP 404. The backend moved to GraphQL; the frontend still speaks REST.

The lane's durable output is therefore a **replayable proof that currently fails**: one verifier with three
modes, plus one `evidence.yaml` per ui record carrying a passing `direction-asset-custody` assertion and two
failing ones (`declared-state-captures` exit 1, `render-proof` exit 1) with their raw exits preserved. When
blockers 1 and 2 are cleared, the same two commands flip to pass without any record being edited by hand.

## 1. What booted, with what, and how it was bound

### Infra — booted

```
docker compose -f .starcistacks/dev/infra/compose/compose.yaml up -d postgres redis
  exit 0   ecommerce-app-be-dev-postgres-1  Up  0.0.0.0:5501->5432/tcp
           ecommerce-app-be-dev-redis-1     Up  0.0.0.0:6448->6448 published as 6448
```

Ports are not free-standing numbers: `examples/ecommerce-app-be/metadata.json` is the one runtime
projection (`postgres: 5501 = 5432 + offset 69`, `redis: 6448 = 6379 + 69`, `identityApi: 5070`,
`orderApi: 6070`, `landing: 3069`, `shopFront: 4069`), and `.starcistacks/dev/README.md` is its runbook.
Left running at the end of the lane (see §6 for teardown).

### Backend — `npm run start:identity` / `start:order` fail as documented (exit 1)

```
> ecommerce-app-be@1.0.0 start:identity
> node -r tsconfig-paths/register dist/apps/identity/src/main.js
Error: Cannot find module '@modules/platform/config/identity/config.module'
Require stack:
- ...\examples\ecommerce-app-be\dist\apps\identity\src\app.module.js
- ...\examples\ecommerce-app-be\dist\apps\identity\src\main.js
  code: 'MODULE_NOT_FOUND'      node v25.2.1, exit 1
```

`start:order` fails identically on `@modules/platform/config/order/config.module`. Mechanism: `tsconfig.json`
sets `baseUrl: "./"` with `"@modules/*": ["./src/modules/*"]`, and `tsconfig-paths/register` resolves bare
imports against *that* map at runtime — i.e. it asks for TypeScript source — while `npm run build`
(`tsconfig.build.json`, `rootDir: "."`) emits to `dist/src/modules/*`. So the emitted graph's own aliases
point one directory level away from the build output. `npm run build` itself exits 0.

Bound **without touching product source** by `ex-testing/lint/scratch/v7-10-be-launch.cjs`, which re-registers
the same path map against `dist` and requires `dist/apps/<app>/src/main.js`. Both services then boot:

```
BE identity  GET /health   HTTP 200 {"status":"ok","service":"identity","checks":{"postgres":"ok","redis":"ok"}}
BE order     GET /health   HTTP 200 {"status":"ok","service":"order","checks":{"postgres":"ok","identity":"ok"}}
```

`order`'s health check resolving `identity: ok` is a real cross-service HTTP call, so the merged topology is
confirmed live: **`identity` and `order` are still two listeners on two allocated ports (5070 / 6070), and
they are two thin `apps/*/src/main.ts` bootstraps over one shared root `src/`** — the merge moved the modules
(`src/features/*`, `src/modules/*`) out of `apps/*`, it did not merge the processes. The frontend reads the
same projection: `apps/shop/src/modules/config/index.ts` resolves `NEXT_PUBLIC_{ORDER,IDENTITY}_API_URL ??
http://localhost:${readProjectedPorts().{orderApi,identityApi}}`, and `scripts/projection.mjs` resolves
`metadata.json` by walking up from the repository — so no literal port exists in the FE to drift. That part
of the seam is sound; the *paths* are not (§2).

### Frontend — builds clean, serves 500 on every route

```
npm run build     exit 0   (landing: /[lang] ƒ, 3 pages;  shop: /[lang]/{account,browse,cart,checkout} ƒ)
npm run start:*  / npm run dev:*   → every page HTTP 500 [NEXT ERROR PAGE]
```

Measured against `next start` (production, the mode `captures/README.md` documents) and again against
`next dev` to get the real message. Production build, `Invoke-WebRequest http://127.0.0.1:3069/en`:
`(500) Internal Server Error`. Dev, shop:

```
Error: No intl context found. Have you configured the provider?
    at ShopLayout (src\components\layouts\ShopLayout\index.tsx:31:33)
> 31 |     const pathname = usePathname()
  digest: '2807882949'        GET /en/browse 500
```

Dev, landing: `Error: Failed to call \`useTranslations\` because the context from
\`NextIntlClientProvider\` was not found.` — six consecutive `GET /en` all HTTP 500 (the first
post-compile pass logged `GET /en 200`, and its body is still the error document; rendering is not stable
enough to capture from either way).

Route inventory is also now locale-prefixed, which the records do not say: `/browse` → `307 → /en/browse`
(`apps/shop/src/middleware.ts`, next-intl matcher), and the pages live at `apps/shop/src/app/[lang]/*/page.tsx`.
`routing.defaultLocale` is `en` (`packages/shared/src/i18n/config.ts`).

Root cause, proven rather than inferred — there are two installed copies of the i18n runtime and the app
mounts the provider from one while `@fe-kit/*` imports the other:

| importer | resolves `next-intl` to |
| --- | --- |
| `examples/ecommerce-app-fe` (the app, mounts `NextIntlClientProvider` in `apps/*/src/app/providers.tsx`) | `examples/ecommerce-app-fe/node_modules/next-intl` = **4.14.4** |
| `@fe-kit/*` → `.claude/packages/fe-kit/src` (re-exports `createRouting`/`createNavigation` used by `packages/shared/src/i18n/{routing,navigation}.ts`) | `.claude/packages/fe-kit/node_modules/next-intl` → **junction** → `examples/todo-app-frontend/node_modules/next-intl` = **4.14.5** |

`Get-ChildItem packages\fe-kit\node_modules` reports `LinkType=Junction` with targets inside
`examples/todo-app-frontend/node_modules` for `next`, `next-intl`, `react`, `react-dom` (react 19.3.0, next
15.5.25). `packages/fe-kit/scripts/link-peers.mjs` creates exactly these and takes one consumer argument
(default `todo-app-frontend`), skipping any name already linked — so the kit can be peer-linked into **one**
example app at a time, and `ecommerce-app-fe` is not the one linked. Its own header states the premise: "In a
consumer build the bundler's own `resolve.alias` additionally pins these names to that consumer's copies."
No consumer does that: `apps/shop/next.config.mjs` and `apps/landing/next.config.mjs` contain only
`createNextIntlPlugin(...)` + `reactStrictMode` (and todo's `next.config.mjs` likewise has no alias). Two
module instances therefore reach one React tree, and a `next-intl` context written by one is read by the
other. todo-app-frontend survives this only because the junctions happen to point at its own `node_modules`.

## 2. The FE↔BE seam, measured live (brief item 2)

With both services up, every REST door the frontend reads is gone. The merged backend serves GraphQL
(`src/features/*/graphql/{queries,mutations}/*` — `cart` query, `addCartItem`/`clearCart`/`placeOrder`
mutations, identity `register`/`signIn`/`account`) plus exactly two REST controllers
(`features/*/transport/http/health.controller.ts`, `features/checkout/transport/http/buyer.controller.ts`
at `internal/buyers/:personId`).

```
BE order     GET /products   HTTP 404 {"message":"Cannot GET /products","error":"Not Found","statusCode":404}
             ^ apps/shop/src/modules/api/catalog.ts: getJson(`${ORDER_API_URL}/products`)
BE identity  GET /me         HTTP 404 {"message":"Cannot GET /me","error":"Not Found","statusCode":404}
             ^ apps/shop/src/modules/api/identity.ts: getJson(`${IDENTITY_API_URL}/me`)
BE order     GET /orders     HTTP 404 {"message":"Cannot GET /orders","error":"Not Found","statusCode":404}
             ^ apps/shop/src/modules/api/orders.ts
BE identity  GET /graphql?query={__typename}   HTTP 400 (CSRF guard: needs a content-type) — the GraphQL door is live
```

`getJson` turns each 404 into `{ok:false, reason:"the service responded 404"}`, and the page containers map
`!ok → state:"failed"`. So even with blocker 1 cleared, `/browse` and `/account` would render their
**unreachable** surfaces naming a 404, never their declared `six-products` / `filled-welcome` states.

Related, and worth the next BE lane's attention: `examples/ecommerce-app-be/scripts/live-proof.mjs` is still
written against the retired REST shape — it drives `POST /auth/register`, `POST /auth/sign-in`,
`GET /accounts/:personId`, `POST /cart/items`, `DELETE /cart`, `POST /orders` — none of which exist any
more, so that script cannot pass against the tree it lives in. (I did not run it: running it would have
written demo orders into the dev database; the static read above is sufficient to show it cannot bind.)

## 3. The `common` DNA question (brief item 4) — answered, with a caveat

`knowledge/grammars/common/DNA.yaml` exists and **does** load. Measured by calling the same function
`checks/render.mjs` uses:

```
grammarRoot resolves to: D:\...\..claude\.dist\knowledge\grammars
cardClassesOf({family: "common"}): source=.dist/knowledge/grammars/common/DNA.json
    classes=["starci-core-form-surface","starci-core-frameless-surface","starci-core-surface","starci-core-surface-card"]
    error=null
```

Two things a reader needs with that fact. First, the check reads the **compiled** `.dist` JSON, not the
`knowledge/**.yaml` source — so v6-2's YAML only reaches the runtime after the skill's compile step; a fresh
checkout that has not built would answer `error=...` instead. Second, the card-surface list agrees with the
snapshot's own `card-surface-canon` observation, which is the cross-check that the right family file was read.

The caveat is the whole problem: this path is only reachable **when the brand record names the family**, and
the ecommerce brand record does not.

```
brand/index.yaml top-level keys: schema, id, state, rev, colour, typography, mascot, imagery, donts, review
brand:  block present?      NO
identity.family present?    NO
color.tokens present?       NO — the record authors `colour:` = {"primary":"#0D9488","surface":"#FFFFFF"}
```

Run against the captures that do exist on disk, every core check skips, which is a refusal:

```
=== examples/ecommerce-app-fe/captures/landing-desktop.png (decoded 1280x1375 channels=3) ===
  palette-off-brand: skip   <- skip on a core check = RENDER_PROOF_INCOMPLETE
  primary-absent:      skip <- skip on a core check = RENDER_PROOF_INCOMPLETE
  entity-list-in-card: skip <- skip on a core check = RENDER_PROOF_INCOMPLETE
      "No card class is known for this render (the drawing names no usable grammar family)…"
=== features/checkout/ui/landing-home/assets/landing-home.png (decoded 1536x1024) ===   same three skips
```

For contrast, the same code against the todo tree's brand (`todo-app-backend/.starciwork/brand/index.yaml`,
whose top-level keys include a real `brand:` block with `identity.family: "common"` and 11 `color.tokens`)
produces actual palette **fails** with token names, not skips. todo's rev 3 is in the shape the tool parses;
ecommerce's rev 1 is not. v6-3's "100 render-check refusals" is this same class, and its cause is the brand
record's shape, not a missing DNA file.

## 4. Per-screen result

Nothing was captured, so no state is *proven*. `unprovable-here` means I read the source that would have to
render it and/or measured the door it reads, and named why it cannot.

| ui record | declared state @ viewport | proven (capture files) | result |
| --- | --- | --- | --- |
| `ui.checkout.landing-home` | `welcome` @ `desktop-1536x1024` | — | **not captured** — only the intl-context 500 stands between this state and a real capture. It is the one declared state that the current source can render (static copy from `apps/landing/src/data/catalog.ts`). |
| `ui.checkout.shop-browse` | `six-products` @ `desktop-1536x1024` | — | **unprovable-here** — `BrowsePage` renders tiles only when `GET :6070/products` answers; measured HTTP 404 (§2), so the reachable states are `failed`/`empty`. Separately, the seeded catalogue is 3 SKUs (`sku-mug`, `sku-thermos`, `sku-notebook`, per `src/modules/platform/databases/postgresql/order/migrations/1789800001000-create-order-tables.ts`), while the declared state and the record's own gap say six editorial landing products — the number was never going to come from the service. |
| `ui.checkout.cart` | `three-lines` @ `desktop-1536x1024` | — | **unprovable-here** — `CartPage` settles exactly one state, `state:"ready"`, whose whole render is a mascot empty block plus a "contract pending" note; there is no line row, quantity control or remove action in the component's prop set at all. The record's own `gaps:` already says "Populated state, quantity mutations and Remove controls are proposals" — that is still true, and no capture can promote it. |
| `ui.checkout.stock-refused` | `stock-refused` @ `desktop-1536x1024` | — | **unprovable-here** — `CheckoutPage` likewise settles one blocked state; no refusal surface, no retained-cart list, no named-product message exists in the component. Placing an order (the only way to trigger a real stock refusal) is a GraphQL mutation the frontend never calls. No file named `stock-refused-*.png` has ever existed under `captures/`. |
| `ui.identity.sign-in` | `filled-welcome` @ `desktop-1536x1024` | — | **unprovable-here** — the declared surface is `http://localhost:4069/account`, and `/en/account` mounts `AccountPage` (order history: `failed`/`empty`/`ready`). There is no email field, no password field and no sign-in control anywhere in `apps/shop/src`. The identity service does have `register`/`signIn` GraphQL mutations, but the FE's session seam is an explicit unfilled `contract:` ("Do not invent a fake signed-in identity here"). The record's `gaps:` saying "no sign-in form… session handoff deferred" is accurate and current. Note also that `captures/` holds no `sign-in` capture at all — only `account-{desktop,mobile}` — so this screen's history was never captured under its declared name either. |

Capture-naming mismatch, independent of everything above: the records' coverage maps name
`<screen>-<viewport>` = `landing-home-desktop-1536x1024`, `shop-browse-…`, `sign-in-…`, while
`captures/capture.mjs` writes `landing-desktop`, `browse-desktop`, `account-desktop` at **1280x800** desktop
and **390x844** mobile. Neither the screen names nor the declared `desktop-1536x1024` viewport have ever
lined up, which is why "captures exist in the folder" and "the declared states are captured" are two
different claims — the old captures proved the second one never.

## 5. Gate refusals observed on `examples/ecommerce-app-be/.starciwork` (verbatim)

Before this lane wrote anything:

```
295 record(s), 2518 ref(s), 114 evidence file(s): 134 refused, 4 warned
```
with **zero** lines naming `examples/ecommerce-app-be` — the tree was already clean, because the gate's
render proof is defined only for `work/implementation` records and this product has no frontend
implementation node: both `impl/*` records are `repository: ecommerce-app-be` (workspace role `be`) and
neither names a ui-screen in `proves` (`impl.checkout.ecommerce-app-be.order-checkout` proves
`br/fr/sds/contract` only). So `renderProofProblems()` returns no problems for every ecommerce record, and
"no refusals" here has never meant "the screens are proven".

After:

```
311 record(s), 2505 ref(s), 120 evidence file(s): 154 refused, 4 warned
```

Every ecommerce line, verbatim, and **none of the five files this lane wrote is among them**:

```
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/cart/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.cart.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/landing-home/assets/direction-check.yaml: id is undefined, but its place says ui.checkout.landing-home.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/landing-home/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.landing-home.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/shop-browse/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.shop-browse.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/stock-refused/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.stock-refused.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/identity/ui/sign-in/assets/generation-receipts.yaml: id is undefined, but its place says ui.identity.sign-in.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/br/place-order/evidence.yaml: recordDigest 079672ed… no longer matches br.checkout.place-order's current digest 88476273…; refused unless it carries stale: true
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/contract/order-for-identity/evidence.yaml: recordDigest 7fc74198… no longer matches contract.checkout.order-for-identity's current digest aff856b8…
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/fr/place-order/evidence.yaml: recordDigest 39f173bc… no longer matches fr.checkout.place-order's current digest 0e43c3b7…
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/sds/order-flow/evidence.yaml: recordDigest 7eff66ea… no longer matches sds.checkout.order-flow's current digest 76238860…
REFUSED examples/ecommerce-app-be/.starciwork/features/identity/fr/sign-in/evidence.yaml: recordDigest 386f2447… no longer matches fr.identity.sign-in's current digest cc71b691…
```
(full untruncated lines in `ex-testing/lint/scratch/v7-10-gate-after.txt`; the baseline is
`v7-10-gate-baseline.txt`. Digest prefixes elided here for width only.)

The last five belong to the `br`/`fr`/`sds`/`contract` nodes — other lanes were editing those `index.yaml`
files while this lane ran, which is also why the record count moved 295 → 311 and the total refusal count
134 → 154. Not mine to settle, and I did not touch them.

The first six **are** in my scope's directories, and I deliberately left them failing. Their history is
v6-3 finding 14: `assets/generation-receipts.yaml` and `assets/direction-check.yaml` had been given record
ids to silence this exact check, and the honest reading is that a payload under `assets/` is not a Work node.
`schemas/work-layout.yaml` agrees, in terms — `assets:` is "`<node>/assets/**/<file-in-original-format>` —
payload organization beside a record's own index.yaml, **never a Work node in its own right** and never given
an index.yaml" — and `todo-app-backend` has zero `.yaml` files under any `features/**/assets/`, so only this
tree exercises the contradiction. Someone has since removed the fake ids, which is the right call and turns
the finding into these six refusals. Clearing them needs one of two decisions above this lane: add
`starci/generation-receipts@1` and `starci/direction-check@1` to `EXEMPT` in
`scripts/check-example-work.mjs` (the checker stops walking payload files, matching the layout prose), or
re-home the payloads out of `assets/`. I made neither change: the first edits the shared gate that every
other lane measures with, and re-homing layout is not a ui-lane call. Restoring fake ids was not an option.

## 6. What this lane wrote

Product source was not edited. Files created or changed:

- `examples/ecommerce-app-fe/captures/verify-render.mjs` (new) — the ecommerce analogue of
  `todo-app-frontend/verify-captures.mjs`, three modes: `custody` (asset digests + one selected direction +
  coverage cites it), `captures` (every `coverage.map` entry has a `<screen>-<viewport>.png` + `.html` pair),
  `render` (the canon checks composed the way `example-render-proof.mjs` composes them, refusing a `skip` on
  a core check). It calls `checks/render.mjs` directly because the gate's own proof path does not reach a
  `work/ui-screen` record — the reason is documented in §5 and in the file's header.
- `examples/ecommerce-app-be/.starciwork/features/checkout/ui/{landing-home,shop-browse,cart,stock-refused}/evidence.yaml`
  and `features/identity/ui/sign-in/evidence.yaml` (new, 5 files) — each written by
  `scripts/example-evidence.mjs` by actually running the three commands against `--cwd .` (host root), with
  `outcome: fail` and the raw exits preserved:

  | record | `direction-asset-custody` | `declared-state-captures` | `render-proof` |
  | --- | --- | --- | --- |
  | `ui.checkout.landing-home` | exit 0 pass | exit 1 fail | exit 1 fail |
  | `ui.checkout.shop-browse` | exit 0 pass | exit 1 fail | exit 1 fail |
  | `ui.checkout.cart` | exit 0 pass | exit 1 fail | exit 1 fail |
  | `ui.checkout.stock-refused` | exit 0 pass | exit 1 fail | exit 1 fail |
  | `ui.identity.sign-in` | exit 0 pass | exit 1 fail | exit 1 fail |

  No ui record's `state`, `ui.*` block or `coverage.map` was edited: with no passing render proof there is
  nothing to update *to*, and promoting a state on the strength of an error page would be the fabrication the
  brief forbids. `direction-asset-custody` passing is itself a result worth having: all **118** digest and
  file-path claims in the five records' `ui.assets[]` (PNGs, exact prompts, `generation.promptPath`,
  `inputRefs`, the one `role: direction` selection, and every coverage entry citing it) verify against the
  bytes on disk.

  Each file was then replayed by the gate's own verifier and all three assertions reproduced their recorded
  outcome — so the evidence is machine-checkable by a later lane, not a prose claim:

  ```
  node scripts/example-verify.mjs --work examples/ecommerce-app-be/.starciwork --record <id> --cwd .
    MATCH direction-asset-custody: still pass
    MATCH declared-state-captures: still fail
    MATCH render-proof: still fail
    <id>: verified - every assertion replayed with a matching outcome      (exit 0, all five records)
  ```

  A final `node scripts/check-example-work.mjs` after every write still reports
  `311 record(s), 2505 ref(s), 120 evidence file(s): 154 refused, 4 warned`, with **zero** lines naming a
  `features/**/ui/**/evidence.yaml` in either tree: this lane's writes added no refusal.
- Scratch, not evidence: `ex-testing/lint/scratch/v7-10-{gate-baseline,gate-after,digest-audit,run-all}.txt`,
  `v7-10-{render-measure,digest-audit,run-all,probe,module-probe,seam-probe}.mjs`,
  `v7-10-be-launch.cjs` (the dist-alias boot harness), `v7-10-be-build.log`.

Teardown left as follows, so a follow-up does not re-derive the topology: `ecommerce-app-be-dev` Postgres +
Redis containers **still running** (`docker compose -f .starcistacks/dev/infra/compose/compose.yaml down`
drops them; add `-v` only if you mean to re-seed the demo catalogue); the two harness-launched Nest services
and the two `next dev` servers were stopped.

## 7. Contradictions left unresolved

1. **`brand/index.yaml` ↔ the render-check tooling.** The record is `state: done`, `rev: 1`, owner-settled,
   and authored as human prose (`colour.primary`, `mascot.duck`, `donts`); the checkers parse
   `brand.color.tokens`/`color.scales` and `brand.identity.family`. Its own closing comment anticipates the
   machine half ("when its css exists this record gains the file paths that check against them"), and
   `examples/ecommerce-app-fe/brand/tokens.css` **does** now exist and states
   `--brand-primary: #0d9488` → `--starci-core-accent: var(--brand-primary)`, with the contrast arithmetic
   (`#FFFFFF on #0D9488 = 3.74:1` under the 4.5:1 floor, `#051817` as the on-primary ink) matching the
   record's accessibility note. Binding those into a `brand:` block is a brand-lane edit under its own
   authority, so I reported the exact refusal instead of making it. Until it happens, no ecommerce capture
   can pass a palette check, in this tree or any future one.
2. **`ui.surfaces[].route` ↔ the served addresses.** All five records declare unprefixed routes
   (`http://localhost:4069/cart`) and their `controls[].status` fields assert "Route exists in frontend
   source". True via the middleware's `307 → /en/cart`, but the addressable page is now locale-prefixed and
   the records never say so. I left the text as authored rather than laundering a redirect into a claim.
3. **`ui.checkout.shop-browse` `six-products` ↔ the seeded data.** The number six comes from the landing's
   editorial catalogue; the `order` service seeds three SKUs, and the FE reads the service. Even a working
   seam yields three.
4. **Provenance drift inside the five ui records.** Audited every `provenance.*` path/digest
   (`v7-10-digest-audit.txt`): **16 `frontendContext` paths no longer exist** —
   `apps/shop/src/app/{cart,checkout,browse,account,page}.tsx`, `apps/shop/src/app/layout.tsx`,
   `apps/shop/src/components/{AppNav,ProductTile}.tsx`, `apps/landing/src/app/page.tsx`,
   `apps/landing/src/components/SiteHeader.tsx` — they were re-homed under `[lang]/` or replaced by the
   `components/pages/*` + `layouts/*` structure; and **14 recorded digests no longer match** their inputs
   (`knowledge/ui/proof/anatomy-source.yaml` in all five records, `fr.checkout.place-order/index.yaml` in
   four, `fr.identity.sign-in/index.yaml`, `apps/landing/src/data/catalog.ts`,
   `apps/landing/src/modules/config/index.ts`, `apps/shop/src/modules/api/identity.ts`). These are frozen
   statements about bytes read at draw time under `provenance.sourceCommit: e901ebac…`, so a mismatch does
   not falsify what the artist saw — but it does mean the records' input bindings can no longer be replayed,
   and it is the same drift signal v6-3 recorded as "8 ecom evidence files stale". I did not re-derive the
   digests: re-pointing them at current bytes would silently re-date a historical claim.
5. **The gate has no proof path for a ui screen.** `example-render-proof.mjs` early-returns unless
   `rec.schema === 'work/implementation'`, and this product authors no frontend impl node. The ecommerce
   screens are therefore invisible to the gate's own render proof even after every blocker above clears —
   either a `impl/ecommerce-app-fe/*` node gets authored that `proves` them (which the gate then holds
   behind `IMPL_BEFORE_DIRECTION`, i.e. behind these very ui records reaching `done`), or the proof stays a
   lane-side script like the one this report ships. That is a layout decision, named not guessed.

## 8. Ordered path to actually closing this lane

1. Peer-link the kit **per consumer** (or add the `resolve.alias` pin `link-peers.mjs` assumes): the
   smallest version is pinning `next-intl`/`react` to the app's own copies in
   `apps/{shop,landing}/next.config.mjs`. Owner of: the i18n/fe-kit lane. This alone makes `welcome`
   capturable and the other four states' failures *real* rather than masked.
2. Re-point the FE's three reads at the GraphQL doors (or restore the REST ones) —
   `apps/shop/src/modules/api/{catalog,identity,orders}.ts`. Owner of: the be lane, with the FE.
3. Give `brand/index.yaml` the machine-readable half (§7.1) so `readExampleBrand()` and `checkPalette`
   bind. Owner of: the brand lane.
4. Re-run `node examples/ecommerce-app-fe/captures/capture.mjs` extended to the declared
   `desktop-1536x1024` viewport and to the records' screen names, then
   `node examples/ecommerce-app-fe/captures/verify-render.mjs --record <id> captures` and `… render`, and
   re-issue the same three `example-evidence.mjs --assert` lines per record.
5. `--expect-down`-style honest negative: `node examples/ecommerce-app-be/scripts/live-proof.mjs` needs its
   REST paths updated to GraphQL before it can serve as the backend's live proof at all (§2).
