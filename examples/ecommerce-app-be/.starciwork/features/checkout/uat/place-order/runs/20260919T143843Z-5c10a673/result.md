# Browse, confirm an order, replay it, and hit both refusals

Flow: `uat.checkout.place-order`  Run: `20260919T143843Z-5c10a673`  Outcome: fail

## Steps walked
- `browse-route-resolves` (2026-09-19T14:38:45.188Z -> 2026-09-19T14:38:45.208Z)
- `catalogue-surface` (2026-09-19T14:38:45.241Z -> 2026-09-19T14:38:45.247Z)

## Assertions
- `smoke.browse.route-resolves`: expected yes, observed no - GET /browse settled at http://localhost:4069/en/browse with HTTP 500; no "Browse" heading was in the rendered page - the route never reached its own surface.
- `smoke.browse.catalog-renders`: expected yes, observed no - Neither the product grid nor a state block was in the rendered page; the route settled on an unrecognized surface.
- `fr.checkout.place-order`: expected yes, observed not-run - This smoke spec proves the harness loop only; the real place-order walk (sign-in, add to cart, confirm, replay, refusals, account read-back) belongs to the flow's own spec.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.