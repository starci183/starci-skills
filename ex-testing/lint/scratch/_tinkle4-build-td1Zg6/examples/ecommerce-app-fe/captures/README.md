# Running-page captures

Real screenshots + served markup of the production builds, taken by `capture.mjs` (Playwright,
`@playwright/test` at this repo's root) while both apps served their `next start` builds on their
projected ports — resolved live by `scripts/serve.mjs` from `../ecommerce-app-be/metadata.json`,
not restated here.

## What they honestly show (2026-09-18)

- **`landing-*.png`** — the full landing renders: hero with the duck mascot on its welcome surface,
  teal primary CTAs carrying dark on-primary ink (the brand's 4.5:1 rule — white on #0D9488 measures
  3.74:1), the teaser grid of `SurfaceCard` tiles, and the pillar cards.
- **`browse-*.png` / `account-*.png`** — the designed *unreachable* states: the backend lane's
  services were NOT running in this environment (no Docker daemon for the dev Postgres/Redis; the
  BE repo is verify-only from this lane), so each page names the service origin it resolved from
  the projection and the refusal reason (`fetch failed`). No mascot — refusal surfaces are the
  brand record's `neverIn`.
- **`cart-*.png` / `checkout-*.png`** — the genuine *empty* states, mascot present (the brand's
  `mayAppearIn`), plus the `// contract:` note naming the unsettled backend contract.

Nothing here claims green it did not see: the catalogue/order/identity data renders are the
service-down branches by design, and that is what the captures record.

## Replay

```sh
npm install && npm run build
npm run start          # both apps on their projected ports
node captures/capture.mjs
```
