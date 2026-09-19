# Browse, confirm an order, replay it, and hit both refusals

Flow: `uat.checkout.place-order`  Run: `20260919T152439Z-5c10a673`  Outcome: fail

## Steps walked
- `step1-sign-in-and-catalogue` (2026-09-19T15:24:40.762Z -> 2026-09-19T15:24:46.961Z)
- `step2-add-one-product` (2026-09-19T15:24:46.994Z -> 2026-09-19T15:24:48.402Z)
- `step3-confirm-order` (2026-09-19T15:24:48.432Z -> 2026-09-19T15:24:51.313Z)
- `step4-replay-confirmation` (2026-09-19T15:24:51.353Z -> 2026-09-19T15:24:51.427Z)
- `step5-confirm-empty-cart` (2026-09-19T15:24:51.469Z -> 2026-09-19T15:25:07.811Z)
- `step6-beyond-stock-refusal` (2026-09-19T15:25:07.847Z -> 2026-09-19T15:25:12.498Z)
- `step7-account-page` (2026-09-19T15:25:12.556Z -> 2026-09-19T15:25:14.086Z)

## Assertions
- `step1.loading`: expected yes, observed yes - The sign-in submit shows its own pending label ("Signing in…") while /api/session answers; the catalogue read is a server render, so the grid is the settled answer.
- `step1.completion`: expected yes, observed yes - After signing in through /api/session, /en/browse listed the catalogue with prices (the order service's session-guarded cart query's catalog snapshot).
- `step2.completion`: expected yes, observed yes - The tile's add control answered "In your cart: 1" (the addCartItem mutation's line quantity) and /en/cart renders the Enamel mug line.
- `step3.loading`: expected yes, observed yes - The confirm button renders its pending label ("Confirming…") while placeOrder answers.
- `step3.completion`: expected yes, observed no - The confirmation card answered order 91e9557a-f79b-4910-a407-47d9d99150f3 with status, total and payment id; the cart then read as the empty state ("Your cart is empty": false).
- `step4.completion`: expected yes, observed yes - Re-pressing the same rendered confirmation re-sent the same idempotency key; the service returned the first order (same orderId shown) marked "already sent" - no second order was written.
- `step4.errorFeedback`: expected no, observed no - A replayed confirmation must not surface a refusal line.
- `step5.errorFeedback`: expected yes, observed no - Confirm was offered on the empty cart but the cart-empty refusal line did not render.
- `step6.errorFeedback`: expected yes, observed yes - The insufficient-stock refusal named the product, the stock that exists and the asked quantity (catalogue stock is 2, the cart asked for 3); the cart kept its lines (Steel thermos still listed: true).
- `step7.order-known`: expected yes, observed yes - The account surface names the signed-in person and the order service's joined answer that this account HAS placed orders (hasOrders).
- `step7.completion`: expected yes, observed no - BE_CAPABILITY_MISSING: the confirmed order 91e9557a-f79b-4910-a407-47d9d99150f3 is NOT listed - the backend serves no order-list door (identity's account query answers hasOrders only, and order serves no orders read), so the surface honestly states that orders exist without fabricating rows.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.