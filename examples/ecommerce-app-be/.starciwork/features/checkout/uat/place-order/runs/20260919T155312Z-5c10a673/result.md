# Browse, confirm an order, replay it, and hit both refusals

Flow: `uat.checkout.place-order`  Run: `20260919T155312Z-5c10a673`  Outcome: pass

## Steps walked
- `step1-sign-in-and-catalogue` (2026-09-19T15:53:13.766Z -> 2026-09-19T15:53:15.709Z)
- `step2-add-one-product` (2026-09-19T15:53:15.755Z -> 2026-09-19T15:53:16.404Z)
- `step3-confirm-order` (2026-09-19T15:53:16.437Z -> 2026-09-19T15:53:17.824Z)
- `step4-replay-confirmation` (2026-09-19T15:53:17.867Z -> 2026-09-19T15:53:17.955Z)
- `step5-confirm-empty-cart` (2026-09-19T15:53:17.991Z -> 2026-09-19T15:53:18.664Z)
- `step6-beyond-stock-refusal` (2026-09-19T15:53:18.699Z -> 2026-09-19T15:53:20.718Z)
- `step7-account-page` (2026-09-19T15:53:20.746Z -> 2026-09-19T15:53:21.320Z)

## Assertions
- `step1.loading`: expected yes, observed yes - The sign-in submit shows its own pending label ("Signing in…") while /api/session answers; the catalogue read is a server render, so the grid is the settled answer.
- `step1.completion`: expected yes, observed yes - After signing in through /api/session, /en/browse listed the catalogue with prices (the order service's session-guarded cart query's catalog snapshot).
- `step2.completion`: expected yes, observed yes - The tile's add control answered "In your cart: 1" (the addCartItem mutation's line quantity) and /en/cart renders the Enamel mug line.
- `step3.loading`: expected yes, observed yes - The confirm button renders its pending label ("Confirming…") while placeOrder answers.
- `step3.completion`: expected yes, observed yes - The confirmation card answered order 3eeedc00-a96b-4bb4-8337-e27bfae42981 with status, total and payment id; the cart then read as the empty state ("Your cart is empty": true).
- `step4.completion`: expected yes, observed yes - Re-pressing the same rendered confirmation re-sent the same idempotency key; the service returned the first order (same orderId shown) marked "already sent" - no second order was written.
- `step4.errorFeedback`: expected no, observed no - A replayed confirmation must not surface a refusal line.
- `step5.errorFeedback`: expected yes, observed yes - The empty-cart refusal rendered: "The order service refused: your cart is empty. Nothing was placed and nothing changed."
- `step6.errorFeedback`: expected yes, observed yes - The insufficient-stock refusal named the product, the stock that exists and the asked quantity (catalogue stock is 2, the cart asked for 3); the cart kept its lines (Steel thermos still listed: true).
- `step7.order-known`: expected yes, observed yes - The provider's own machine door (GET /internal/buyers/d301ed91-8683-48cf-acab-40e8ff6a35fa) answered hasOrders=true - for a person this run registered, that flag can only be the order confirmed at step 3 (3eeedc00-a96b-4bb4-8337-e27bfae42981).
- `step7.completion`: expected yes, observed yes - The account page names this run's signed-in person and renders the buyer confirmation - "The order service confirms this account has placed orders" - the order-for-identity postcondition the product serves (no per-order list door exists; none is claimed). The person was registered by this run, so that answer is this run's confirmed order and no one else's.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.