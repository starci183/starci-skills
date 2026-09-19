# v7-2 lane report — ecommerce-app-be record truth

Scope: `examples/ecommerce-app-be/.starciwork`, all record families except `ui/**`, `uat/**`,
`assets/**`, `evidence.yaml`, `_derived/`, `_resources/`, root `index.yaml`. No product source
(`src/**`, `apps/**`) was touched.

## What changed

### 1. Contract wire paths (`contract.checkout.order-for-identity`)

- `surface.shape`: `GET /buyers/:personId` → `GET /internal/buyers/:personId` — the provider is
  `@Controller("internal/buyers")` in `src/features/checkout/transport/http/buyer.controller.ts`,
  and the consumer `src/modules/integrations/order/order.client.ts` calls
  `/internal/buyers/${personId}`.
- `transport`: the consumer door is the `account(personId)` GraphQL query on the identity
  service (`src/features/identity/graphql/queries/account/`), not the retired REST
  `GET /accounts/:personId`.
- `guarantee` / `consumerObligations`: now state the refusal taxonomy the consumer actually
  implements — a 404 (which this provider never sends) reads as `hasOrders: false` under the
  asked id; any other non-200 or an unreachable/timed-out provider becomes the typed 503
  `ORDER_SERVICE_UNAVAILABLE`; a 200 that does not echo the asked `personId` with a boolean
  `hasOrders` is refused `ORDER_CONTRACT_MISMATCH`. The draft's absolute "a failed call is
  always a typed 503" contradicted the code's deliberate 404 branch.
- `refs` extended with `br.identity.account` and `fr.identity.account` (the records that now
  own the consumer side — see item 3).
- `change` bumped to rev 2, `clarifying` — the product never changed; the record was wrong
  about its own wire.

Sweep result across every other surface declaration in scope (sds sequence, integration
endpoints, br/fr prose): see items under "sds corrections" and the `gap` fix below.
`integration.checkout.postgres` (`:5501`) and `integration.checkout.redis` (`:6448`) match
`metadata.json` and `.starcistacks/dev/infra/compose/*` — already truthful, untouched.

### 2. Missing cart FRs (`fr/cart/*` + rule + criteria)

The three cart doors shipped in code with no records. Created, all `state: todo`:

- `br.checkout.cart` (`features/checkout/br/cart/`) — the rule the doors compose: lines keyed
  by (person, product) accumulate; add demands only a present product id and a positive
  integer quantity (catalog membership is *not* checked at add — confirmation refuses
  `unknown-product`); clear empties the person's cart only; the read answers the person's
  lines in product order plus the catalog snapshot.
  - `ac.checkout.cart.accumulates-on-held-product`
  - `ac.checkout.cart.lines-are-person-scoped`
  - `ac.checkout.cart.clear-empties-every-line`
- `fr.checkout.cart.add` (`features/checkout/fr/cart/add/`) — `addCartItem` mutation:
  SessionGuard first; `REQUEST_INVALID` for missing productId / non-positive-integer
  quantity; upsert-accumulate; `unknown-product` is *not* refused here.
- `fr.checkout.cart.clear` (`features/checkout/fr/cart/clear/`) — `clearCart` mutation:
  SessionGuard first; removes every line the person holds.
- `fr.checkout.cart.list` (`features/checkout/fr/cart/list/`) — `cart` query: SessionGuard
  first; person-scoped lines in product order joined with the catalog snapshot.

`requiresProof` uses the real spec paths only (`checkout/checkout-journey`,
`checkout/payment-failure`, `identity/sign-up-sign-in` under
`src/tests/e2e/jest.config.js`, plus `unit.forEach: composes`). No proof is claimed; all
three FRs and the rule stay `todo` until the evidence lane runs them.

### 3. Plan-cap-style precondition contradiction — resolved by editing the records

The ecommerce analogue is not a plan cap; it is the pair of enforcements the contract +
code carry that no FR stated:

- `fr.checkout.place-order` omitted two door-enforced preconditions: the SessionGuard
  refuses an unverifiable token before any cart/order work (`SESSION_INVALID`), and the
  CheckoutPolicy refuses a cart line whose product the catalog does not know
  (`unknown-product`, a named `CHECKOUT_REFUSAL.reason`). Both are now in `exceptionFlows`;
  the idempotency key wording now reads as the mutation input it is, not a REST header.
  rev 2 `clarifying`.
- `fr.identity.sign-in` omitted the register precondition the mutation enforces —
  a plausible email and a password of ≥ 8 characters, refused `REQUEST_INVALID` before
  `AccountService` runs — and composed the rule only through the session module while the
  credential check lives in `src/modules/bussiness/account`. Both fixed; rev 2 `clarifying`.
- The contract's `consumerObligations` bound a flow no record owned: the account read.
  Created `br.identity.account` + `fr.identity.account` (+ 3 ACs), all `todo`, stating
  what `account.resolver.ts` + `order.client.ts` enforce: unknown person → `PERSON_UNKNOWN`
  before the order call; one live read per ask, never cached; a failed call propagates a
  typed refusal and never renders a fabricated `hasOrders: false`.

### 4. `provenBy` cleanup

Zero hand-authored `provenBy` blocks exist anywhere in the ecommerce tree (in scope or
excluded) — verified by grep over the whole `.starciwork`. Nothing to remove; nothing was
added.

### 5. Remaining `apps/order|identity` owner/module paths

Zero remain in scope. The only `apps/…` mentions left are factual prose in `gap` records:
`apps/identity` and `apps/order` are the real deployable workspace shells (still in the
repo, `npm workspaces`), and `apps/shop` paths in `gap.checkout.live-proof` /
`gap.identity.live-proof` refer to the FE repository's real app. No `owner:` or `module:`
field references them.

### Extra truthful-record fixes found during the sweep

- `sds.checkout.order-flow` sequence named retired REST doors (`POST /cart/items`,
  `POST /sessions/verify`, `POST /orders`); corrected to the real doors — `addCartItem` and
  `placeOrder` mutations on `/graphql`, `POST /internal/sessions/verify`. `t-add`'s guard
  claimed catalog membership is checked at add time — code does not check it there;
  `t-stock`'s guard now names the `unknown-product` refusal the policy produces.
  rev 2 `clarifying`.
- `br.checkout.place-order`: `Idempotency-Key` (header styling) → `idempotency key`
  (the key arrives in the mutation input).
- `gap.checkout.live-proof`: its stated reason — "cart persistence is deferred to the
  order-service session/cart workstream" — is no longer true; the backend doors now ship.
  Reworded to name the actual remaining blocker (FE surfaces still stubs, no UAT harness).

## What could not be proven, and why

- All 12 new records are `state: todo` — the lane may not run or record evidence; no UAT
  exists for this tree at all (`gap.checkout.live-proof`), and no unit/e2e run was executed
  or claimed.
- `br.identity.account`'s `live-answer-not-a-copy` criterion and the typed-refusal criteria
  have spec coverage in `account.resolver.spec.ts` but no e2e that kills the order service
  mid-run; they remain provable-but-unproven until the evidence lane runs.

## Remaining gate refusals observed (verbatim, ecommerce tree only)

Command: `node scripts/check-example-work.mjs` →
`311 record(s), 2504 ref(s), 115 evidence file(s): 154 refused, 3 warned`.
Tree total 10; all other refusals are in `todo-app-backend` (other lanes' scope).

Expected — caused by this lane's record edits, awaiting the evidence lane (v7-7) to
re-prove; `stale: true` was NOT set anywhere:

    REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/br/place-order/evidence.yaml: recordDigest 079672eda2b3aa0b3ae34b6575f5095c2e34a085d7dcb03cecf09d3365ced52f no longer matches br.checkout.place-order's current digest 88476273ac70ac482e7d66c3f9ff74be39118388da647144d4e91f93b4794839; refused unless it carries stale: true
    REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/contract/order-for-identity/evidence.yaml: recordDigest 7fc74198773d3729a9ea1f15f617d712174f0f59e59c84b2a5ac1f527c3a0853 no longer matches contract.checkout.order-for-identity's current digest aff856b8335f392308fe7f28bae74cb8beaccf402aa1f59a4edb1682fb1c49c6; refused unless it carries stale: true
    REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/fr/place-order/evidence.yaml: recordDigest 39f173bcc7dce1ac27465cad4ceac68a701003c9267812a2863387c7b372d2e1 no longer matches fr.checkout.place-order's current digest 0e43c3b75e56f5a951d678df6dd512f6a72e3fa47ce3ecd20a0dec58b8eb8df5; refused unless it carries stale: true
    REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/sds/order-flow/evidence.yaml: recordDigest 7eff66ea99da9a8136b3f714caad5b496abec3f2ab713407011f7641cd4ec11f no longer matches sds.checkout.order-flow's current digest 762388603ac2c492ce6dfa3443e614ab549d21a8fede592a4ba5b985b46abd9a; refused unless it carries stale: true
    REFUSED examples/ecommerce-app-be/.starciwork/features/identity/fr/sign-in/evidence.yaml: recordDigest 386f244787bc7237ac991b8ff040672117947a751e5981ce3f54d9a92f5a2bda no longer matches fr.identity.sign-in's current digest cc71b69107d1060e4ce8170c0f72292ce99dd35d248c1bc4d889e2638c0c2f2f; refused unless it carries stale: true

Pre-existing, outside this lane's scope (`ui/**` + `assets/**` are excluded; they appeared
after this lane's baseline — likely a concurrent assets lane):

    REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/cart/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.cart.assets
    REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/landing-home/assets/direction-check.yaml: id is undefined, but its place says ui.checkout.landing-home.assets
    REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/landing-home/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.landing-home.assets
    REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/shop-browse/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.shop-browse.assets
    REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/stock-refused/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.stock-refused.assets
    REFUSED examples/ecommerce-app-be/.starciwork/features/identity/ui/sign-in/assets/generation-receipts.yaml: id is undefined, but its place says ui.identity.sign-in.assets

No `ID_MISMATCH`, `REF_UNKNOWN`, `OWNER_PATH_MISSING`, or AC-shape refusals on any record
this lane touched or created.

## Unresolved record/code contradictions

- `checkout-journey.e2e-spec.ts` is named by `requiresProof.e2e.command` on
  `fr.checkout.place-order` and the new cart FRs; v6-1 reported it does not compile
  (TS2459/TS7006 at that time). The `@e2e-kit` compat re-exports now exist, so it may
  compile today — unverified here; the evidence lane will settle it when it runs the
  command.
- `checkout.policy.spec.ts` names its suite `sds.checkout.order-flow t-refuse`, but no
  `t-refuse` transition exists in the sds (refusals ride `t-stock`/`t-pay` guards).
  Code comment only — a source-file nit, out of this lane's edit scope.
- `fr.identity.sign-in` does not cover sign-out; the only revoke door is the internal
  `POST /internal/sessions/revoke`, which has no user-facing flow to record. Left as-is.
