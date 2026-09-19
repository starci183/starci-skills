# Browse, confirm an order, replay it, and hit both refusals

Flow: `uat.checkout.place-order`  Run: `20260919T152330Z-5c10a673`  Outcome: fail

## Steps walked
- `step1-sign-in-and-catalogue` (2026-09-19T15:23:31.398Z -> 2026-09-19T15:23:38.816Z)
- `step2-add-one-product` (2026-09-19T15:23:38.857Z -> 2026-09-19T15:23:41.664Z)
- `step3-confirm-order` (2026-09-19T15:23:41.704Z -> 2026-09-19T15:23:45.729Z)
- `step4-replay-confirmation` (2026-09-19T15:23:45.760Z -> 2026-09-19T15:23:45.902Z)
- `step5-confirm-empty-cart` (2026-09-19T15:23:45.936Z -> 2026-09-19T15:23:47.178Z)
- `step6-beyond-stock-refusal` (2026-09-19T15:23:47.222Z -> 2026-09-19T15:23:51.493Z)
- `step7-account-page` (2026-09-19T15:23:51.524Z -> 2026-09-19T15:23:52.832Z)

## Assertions
- `step1.loading`: expected yes, observed yes - The sign-in submit shows its own pending label ("Signing in…") while /api/session answers; the catalogue read is a server render, so the grid is the settled answer.
- `step1.completion`: expected yes, observed yes - After signing in through /api/session, /en/browse listed the catalogue with prices (the order service's session-guarded cart query's catalog snapshot).
- `step2.completion`: expected yes, observed no - Running count visible: false; cart line rendered: true.
- `step3.loading`: expected yes, observed yes - The confirm button renders its pending label ("Confirming…") while placeOrder answers.
- `step3.completion`: expected yes, observed yes - The confirmation card answered order 91e9557a-f79b-4910-a407-47d9d99150f3 with status, total and payment id; the cart then read as the empty state ("Your cart is empty": true).
- `step4.completion`: expected yes, observed yes - Re-pressing the same rendered confirmation re-sent the same idempotency key; the service returned the first order (same orderId shown) marked "already sent" - no second order was written.
- `step4.errorFeedback`: expected no, observed no - A replayed confirmation must not surface a refusal line.
- `step5.errorFeedback`: expected yes, observed no - Confirm was offered on the empty cart but the cart-empty refusal line did not render.
- `step6.errorFeedback`: expected yes, observed yes - The insufficient-stock refusal named the product, the stock that exists and the asked quantity (catalogue stock is 2, the cart asked for 3); the cart kept its lines (Steel thermos still listed: true).
- `step7.order-known`: expected yes, observed yes - The account surface names the signed-in person and the order service's joined answer that this account HAS placed orders (hasOrders).
- `step7.completion`: expected yes, observed no - BE_CAPABILITY_MISSING: the confirmed order 91e9557a-f79b-4910-a407-47d9d99150f3 is NOT listed - the backend serves no order-list door (identity's account query answers hasOrders only, and order serves no orders read), so the surface honestly states that orders exist without fabricating rows.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.