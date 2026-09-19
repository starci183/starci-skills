# Lane v9-7 — REPORT: ec-fe cart persistence + checkout completion (real feature work)

Date: 2026-09-19. Scope: `examples/ecommerce-app-fe/apps/shop` (cart/checkout/browse/account wired
to the real backend) + `uat/flows/uat.checkout.place-order.spec.ts` + the owning records under
`examples/ecommerce-app-be/.starciwork/features/checkout/`. Read first: `v9/_common.md`, the v9-7
brief, `v7-11-REPORT.md`, `v7-12-REPORT.md`, v9-6's session-seam contract, and the
`uat.checkout.place-order` record itself.

## Verdict: feature landed and walked end-to-end; uat record settles `inprogress` on one honest BE absence

`runs/20260919T152927Z-5c10a673/` executed the full seven-step record against a frozen production
build of the shop (`next build` + `next start -p 4469`) with live identity (:5070) and order (:6070)
services. Steps 1–6 pass outright — sign-in through `/api/session`, real catalogue with prices,
add-to-cart with the service's running quantity, confirm → confirmation card (order
`d4558e99-…`, status/total/paymentId) + emptied cart, idempotent replay of the same rendered
confirmation marked "already sent", the empty-cart refusal, and the beyond-stock refusal naming the
product, the asked quantity (3) and the stock that exists (2). Step 7 splits honestly:
`order-known` passes (`account.hasOrders: true`), `completion` fails — **BE_CAPABILITY_MISSING**:
no order-list door exists, so "the confirmed order is listed" cannot be observed. The account
surface states that orders exist without fabricating rows. Per `_common.md`'s external-leg
precedent, the record sits at `inprogress` with `gap.checkout.live-proof` narrowed to exactly this
missing door.

## What was built (all against real doors — the scaffold REST modules are gone)

- `modules/api/graphql.ts` — typed `postGraphql` transport: Bearer from the session cookie,
  `cache: no-store`, timeout, GraphQL `extensions` preserved, transport failures returned as typed
  results (never thrown outward).
- `modules/api/cart.ts` — `cart` query (items + catalog snapshot), `addCartItem` (fixed to the real
  `{ item { productId quantity } }` envelope), `clearCart`.
- `modules/api/orders.ts` — `placeOrder` with `PlaceOrderOutcome` = confirmed | refused | failed;
  refusal carries `reason`/`productId`/`requested`/`available` verbatim from `extensions`.
- `modules/api/catalog.ts`, `modules/api/identity.ts` (`account` → `hasOrders`), `modules/money.ts`,
  `modules/checkout/index.ts` (attempt-key nonce), `modules/routes.ts`.
- Surfaces: `BrowsePage` (real catalog + per-tile add with running count), `CartPage` (lines,
  totals, `clearCart` — the only removal door the backend serves), `CheckoutPage` (summary +
  confirm + all refusal states), `AccountPage` (signedOut/unreachable/empty/buyer on v9-6's seam).
- Controls moved to blocks to satisfy the surface-folder canon: `blocks/AddToCart`,
  `blocks/ClearCart`, `blocks/ConfirmOrder`.
- en/vi catalogues: all new strings; template strings resolved via `t.raw()` so ICU placeholders
  interpolate client-side.

## A real bug the walk caught

The first idempotency design keyed `attemptKey` to a **digest of cart contents**. Repeat UAT runs
(and real re-purchases of identical carts) replayed the *previous* order — `replayed: true`, cart
never cleared, stale confirmation rendered. The run-2 manifest exposed it (same orderId, cart still
populated). Fixed to a per-render nonce (`checkout-${randomUUID()}`): same render re-presses replay
correctly; a fresh render is a genuinely new attempt. Verified by the final run.

## Concurrency notes (v9-6 shared this tree)

- Session seam converged to v9-6's: `northwind-session`/`northwind-person` httpOnly cookies written
  by `/api/session`; server code reads via `readSessionToken`/`readSessionPerson`. No FE token seam
  of my own remains.
- `next.config.mjs`: `resolve.modules` pins (theirs) + `outputFileTracingRoot` at the FE repo root
  (mine) — the latter fixes `/_document` module-not-found caused by the host's `pnpm-lock.yaml`
  mis-inferring the workspace root.
- Dev-mode evidence was impossible: the other lane's edits kept triggering Fast Refresh full-reloads
  mid-walk. All UAT evidence is against the production build — which is the stronger evidence anyway.

## Verification performed

- `tsc --noEmit`: clean. Vitest: 15 files / 76 tests green (specs rewritten to the settled APIs;
  `server-only` action modules mocked per convention).
- `next build`: clean, all routes + `/api/session` dynamic, middleware compiled.
- curl contract walk on the live services: register → signIn → sessions/verify → cart →
  empty-cart refusal (`cart-empty`) → add → beyond-stock refusal (`insufficient-stock` with
  productId/requested/available) → clear → place → replay same key (`replayed: true`, same orderId)
  → `account.hasOrders: true`. All verified before UI work finished.
- Playwright: `uat.checkout.place-order` spec in `uat/lib` conventions; final run
  `20260919T152927Z-5c10a673` — 10/11 assertions `yes`, the one `no` is the named BE absence.

## Records touched

- `uat.checkout.place-order` → `inprogress`; `blockedBy` kept on the narrowed gap; `evidence.yaml`
  written naming the run (`outcome: fail`, `recordDigest` bound); earlier failed run folders kept
  append-only, settling nothing.
- `gap.checkout.live-proof` → narrowed: rig/SSR/scaffold absences all closed; residual = missing
  order-list door. `closedBy` unchanged.
- `ui.checkout.shop-browse` / `ui.checkout.cart` / `ui.checkout.stock-refused` →
  `uninvestigate → todo`; controls marked from run evidence — wired controls named with the run id;
  per-line `Quantity`/`Remove` marked **BE_CAPABILITY_MISSING** (only `clearCart` exists);
  stock-refused recovery controls land as header-nav links, not dedicated buttons. Evidence files
  regenerated via `scripts/example-evidence.mjs` (custody pass; captures/render fail — same
  checker/record-shape gap v9-6 reported, not a product defect).
- `ui.checkout.landing-home` untouched — the landing app is not this lane's surface.

## Gate

`node scripts/check-example-work.mjs`: **311 records, 0 refused** — every ref resolves, all
new-concept rules satisfied.

## Residuals / honest absences

1. **BE_CAPABILITY_MISSING — order-list door**: identity serves `hasOrders` only; order service
   exposes no orders read. Step 7's "the confirmed order is listed" stays unprovable until it lands.
   Named in `gap.checkout.live-proof` and the run manifest.
2. **BE_CAPABILITY_MISSING — per-line cart mutation doors**: no quantity-update or per-line remove
   endpoint; shipped surface offers clear-cart only.
3. Catalogue is sourced from the session-guarded `cart` query — signed-out visitors see the
   signed-out state on /browse, not a public catalog (no such door exists).
4. Shop on :4069 belongs to another lane's dev server; my verification ran on :4469. Disposable
   person rows and the confirmed order remain in the demo store per the record's cleanup note.
