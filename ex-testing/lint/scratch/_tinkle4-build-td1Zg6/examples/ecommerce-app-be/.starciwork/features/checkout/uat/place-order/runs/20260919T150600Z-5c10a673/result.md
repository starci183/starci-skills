# Browse, confirm an order, replay it, and hit both refusals

Flow: `uat.checkout.place-order`  Run: `20260919T150600Z-5c10a673`  Outcome: fail

## Steps walked
- `step1-sign-in-and-catalogue` (2026-09-19T15:06:01.387Z -> 2026-09-19T15:06:05.931Z)
- `step2-add-one-product` (2026-09-19T15:06:06.413Z -> 2026-09-19T15:06:08.302Z)

## Assertions
- `step1.loading`: expected yes, observed yes - The sign-in submit shows its own pending label ("Signing in…") while /api/session answers; the catalogue read is a server render, so the grid is the settled answer.
- `step1.completion`: expected yes, observed yes - After signing in through /api/session, /en/browse listed the catalogue with prices (the order service's session-guarded cart query's catalog snapshot).
- `step2.completion`: expected yes, observed no - Running count visible: false; cart line rendered: true.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.