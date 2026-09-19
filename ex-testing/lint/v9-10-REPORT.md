# Lane v9-10 — REPORT: settle `uat.checkout.place-order` on a real passing run

Date: 2026-09-19. Scope: `examples/ecommerce-app-fe/uat/flows/uat.checkout.place-order.spec.ts`
(v9-7's spec, audited and amended) + the owning records under
`examples/ecommerce-app-be/.starciwork/features/checkout/` (`uat/place-order/`, `gap/live-proof/`).
Read first: `v9/_common.md`, the v9-10 brief, v9-6/v9-7/v9-8/v9-9 reports and markers,
`uat.checkout.place-order/index.yaml`, `fr/br.checkout.place-order`,
`contract.checkout.order-for-identity`, `fr.identity.account`, and the order-history e2e.

## Verdict: PASS — record settled `done`, gap closed, gate clean

`runs/20260919T155312Z-5c10a673/` (under `features/checkout/uat/place-order/`) walked all seven
authored steps against the live stack — a fresh production build of the shop on the projected
:4069 (`node scripts/serve.mjs shop start`), identity :5070 and order :6070 already healthy —
with `result.md` `Outcome: pass`, all 11 assertions observed at their expected value, eight
screenshots, a real video (`videos/place-order.webm`), `walk.json`, `readback.json` (notRun
empty), `cleanup.json`, `run-ledger.json`, `manifest.yaml`. `evidence.yaml` names the run with
`recordDigest` bound to the record's final bytes and the video's sha256. `uat.checkout.place-order`
is `state: done`, `blockedBy` removed; `gap.checkout.live-proof` is `done`
(`closedBy` + `verificationSource: authored-claim` + `because`, the v9-9 shape). Gate:
`node scripts/check-example-work.mjs` → **311 records / 0 refused**.

## Wait gate — executed

Polled `ex-testing/lint/done/` until `v9-6.done`, `v9-7.done` and `v9-8.done` all existed. v9-8
landed the ported harness and proved it with a smoke run; v9-6 settled the session seam and the
account surface; v9-7 wired cart/checkout to the real GraphQL doors and — critically — had already
implemented this lane's spec and run it for real.

## The central finding: the blocker was a spec over-claim, not a missing capability

v9-7's run `20260919T152927Z-5c10a673` passed steps 1–6 and step 7's order-known check, settling
`Outcome: fail` on one check: step 7's wording expected "the confirmed order is **listed** for this
person", and the backend serves no order-list door. This lane's audit asked whether that absence is
a product gap or a record over-claim:

- `fr.checkout.place-order`'s own postcondition: "a confirmed person has orders — visible through
  `contract.checkout.order-for-identity`".
- `contract.checkout.order-for-identity` (done): `GET /internal/buyers/:personId` →
  `{personId, hasOrders}`. No list field.
- `fr.identity.account` (done): the account answer is `personId + email + hasOrders`.
- `src/tests/e2e/order-lifecycle/order-history.e2e-spec.ts` states outright that no order-list door
  exists and asserts history out-of-band on Postgres for exactly that reason.
- v7-12's own authoring note for this record described step 7 as "the order-for-identity
  postcondition".

Every settled authority agrees: the product promises `hasOrders`, not a list. "Listed"
over-specified the claim. Per the correction policy (repair the owning spec rather than fake a
capability or hold a record hostage to a claim nobody made), the record was repaired at rev 5:
step 7's expected wording now names the buyer confirmation the product serves, and the statement of
the gap retains the true fact that no per-order list door exists — it just has no claim left to
measure.

## `proves` narrowed to done targets

The record's `proves` carried `fr.checkout.cart.add`, `fr.checkout.cart.list` and `br.checkout.cart`,
all still `state: todo` — a `done` uat-flow would hit `PROVES_TARGET_NOT_DONE` (the v7-11 class of
refusal). `proves` is now `[fr.checkout.place-order, br.checkout.place-order]` (both done), with a
comment on the record preserving that the walk does exercise cart add/list in steps 2, 3, 5 and 6 —
the narrowing is a gate-mechanics correction, not a retreat from what the run observed. If the cart
records settle, `proves` can be extended back over them.

## Spec amendments (kept append-only conventions, no claim weakened)

- `credentials()` now namespaces the disposable person per run
  (`uat-buyer-<runId>@ecommerce.dev`, the v9-9 convention): a fresh person makes step 7's
  `hasOrders` answer causally bound to *this* run's order, and removes EMAIL_TAKEN / shared-cart
  coupling across reruns.
- `signInThroughUi` keeps the sign-in leg (the record's wording) with a register-mode fallback
  through a press-lock-safe `switchToRegister` helper (TextAction's 300 ms debounce can swallow a
  loopback-fast toggle click — the fix v9-9 documented).
- Step 7 now asserts the claim the repaired record carries: the account page renders the run's
  signed-in person plus the buyer confirmation, *and* the provider's own machine door
  (`GET /internal/buyers/<personId>` from the `northwind-person` cookie) reads back
  `hasOrders: true` — ground truth beside the DOM, not instead of it.
- Cleanup tail: the session is revoked through the product's own sign-out
  (`DELETE /api/session` → `internal/sessions/revoke`) and verified absent at the verify door
  (`SESSION_INVALID`). Person + order rows remain per the record's declared cleanup (no delete
  door exists for either — nothing faked).
- v9-7's decisions preserved: per-render `randomUUID()` idempotency key, Confirm stays mounted for
  same-render replay, and no fabricated order rows on the account page.

## Stack handling

A stale wedged `next start-server.js` (PID 105676, from an earlier lane) held :4069 in LISTENING
without answering; it was terminated and replaced with a fresh `next build` + `next start` on the
projected port — the port's canonical owner, not a scratch port (v9-7 needed 4469 only because
4069 was occupied). Identity/order were already running and healthy; Postgres :5501 and Redis :6448
up per `/health`. The shop server is left running on :4069.

## Run `20260919T155312Z-5c10a673` — what it proved

| Step | Record claim | Observed |
|---|---|---|
| 1 | sign in, catalogue lists products+prices | sign-in through `/api/session`; catalogue renders |
| 2 | cart shows the line | "In your cart: 1"; `/en/cart` lists Enamel mug |
| 3 | confirmation shows, cart empty | order `3eeedc00-…` card; cart reads empty |
| 4 | same confirmation replays, no second order, no error | same orderId, "already sent", no refusal |
| 5 | empty-cart refusal | "your cart is empty. Nothing was placed and nothing changed." |
| 6 | refusal names product/qty/stock; cart keeps lines | insufficient-stock named thermos, asked 3, stock 2; lines kept |
| 7 | account confirms this person has orders | buyer confirmation rendered; `/internal/buyers` read-back `hasOrders=true` |

Earlier runs (`20260919T142835Z` through `20260919T152927Z`) kept untouched as append-only history;
the last remains the honest record of the pre-repair absence.

## Residuals (honest, none blocking)

- `fr.checkout.cart.add`, `fr.checkout.cart.list`, `br.checkout.cart` remain `todo` — owned by the
  cart lanes, not this one; the record's comment preserves the coverage the walk gave them.
- The product still serves no per-order list door. No accepted record asks for one; if a future
  record does, that is new scope with its own proof.
