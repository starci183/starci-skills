# Lane v9-6 — ec shop identity surface: REPORT

Date: 2026-09-19. Scope: `examples/ecommerce-app-fe` (product code), records in
`examples/ecommerce-app-be/.starciwork`.

## What was built (product code, all in `apps/shop`)

The lane landed against a tree mid-refactor (parallel lanes had already reshaped the shop to
`[lang]` routes, `graphql.ts` transport, `cart.ts`/`catalog.ts`, and an account dictionary keyed
on `hasOrders` — the backend serves no per-order list). The sign-in work was reconciled to that
tree, not to the summary-era shape.

- `src/modules/session/` — the settled session carrier. `shared.ts` names the pair
  (`northwind-session` bearer + `northwind-person` id); `index.ts` (server-only) reads them and
  owns `SESSION_COOKIE_OPTIONS` (httpOnly, SameSite=lax, host-scoped, 1h TTL mirror).
  **Merge note:** a `modules/session.ts` I had created shadowed the parallel lane's
  `session/index.ts`; folded mine into the directory and removed their
  `document.cookie` writers from `shared.ts` — dead under the httpOnly design and contradicting
  it.
- `src/app/api/session/route.ts` — the browser-facing door. `POST` runs `register` then `signIn`
  (registration issues no session of its own) or `signIn` directly against the identity GraphQL,
  and sets both cookies httpOnly on success; `DELETE` revokes at `internal/sessions/revoke`
  (best-effort) then clears both cookies. Refusals forward `code` verbatim (400/401/409/502).
- `src/modules/api/identity.ts` — `signInWithPassword`, `registerAccount`, `verifySession`,
  `fetchAccount`, `revokeSession`, `fetchCurrentUser` (cookie → `internal/sessions/verify` →
  `account(personId)`). Rewritten onto the parallel lane's `postGraphql` transport; `CurrentUser`
  carries `hasOrders`.
- `src/modules/api/session.ts` — the client-side door module (`openSession`/`closeSession`) the
  forms call; the browser never crosses origins (identity serves no CORS).
- `src/components/blocks/SessionForm` + `blocks/SignOutAction` — pure twins + connected halves,
  per the component-split rules. Sign-in/register mode toggle, disabled-until-filled submit,
  pending state, refusal mapped by business code to dictionary copy (`refusal`, `taken`,
  `invalid`, `unavailable`) — the `INVALID_CREDENTIALS` copy names neither half, per
  `br.identity.sign-in`.
- `src/components/pages/AccountPage` — reshaped to the real contract: `signedOut` renders the
  `ui.identity.sign-in` auth split (duck left, form right) + `ordersSignedOut` block;
  `unreachable` reports the identity refusal; `empty`/`buyer` split on `hasOrders`.
- `apps/shop/next.config.mjs` + `apps/landing/next.config.mjs` — **the SSR-500 fix.** The
  `@fe-kit`/`@shared` source aliases resolved `next-intl`, `react`, `react-dom`,
  `@starci/grammar` from `fe-kit/node_modules` — link-peers junctions pointed at
  *todo-app-frontend*'s tree. A second `use-intl` context made every created-navigation
  `usePathname` throw "No intl context found" (the `gap.checkout.live-proof` hard-500). Both
  configs now prepend their own `node_modules` to `webpack resolve.modules` — the dedupe
  `link-peers.mjs` documents as the consumer's half of the contract.

`NEXT_PUBLIC_*_API_URL` wiring already existed (`modules/config` falls back to
`ecommerce-app-be/metadata.json` ports); verified, unchanged.

## Session contract, settled concretely

Browser → shop `/api/session` (same origin) → identity GraphQL `register`/`signIn` → opaque
bearer stored in httpOnly `northwind-session` cookie (host-scoped — cookies don't bind ports, so
the same cookie rides landing `:3069` ↔ shop `:4069` on localhost; that IS the handoff). Server
renders verify via `internal/sessions/verify` and read the person via `account(personId)`. No
token in any URL, no new auth scheme, no invented `/me`.

## Verification

- `tsc --noEmit` (shop): clean.
- `vitest run`: **76/76 pass** — including new SessionForm (7) and SignOutAction (2) specs and the
  rewritten AccountPage spec.
- `eslint` on all touched files: clean. Repo-wide lint still has 6 errors, all in the parallel
  lane's `pages/{Browse,Cart,Checkout}Page/{actions,control}.tsx`
  (`starci-fe/surface-folder-two-files-only`) — not this lane's files; `next build` compiles but
  the lint gate fails there. Reported, not worked around.
- Live run (identity+order+postgres+redis already up; shop dev on :4069):
  - `POST /api/session` register `v96-…@northwind.test` → 200, both httpOnly cookies set.
  - `GET /en/account` with cookie → "Signed in as v96-…@northwind.test", Sign-out, "No orders yet".
  - Wrong password → 401 `INVALID_CREDENTIALS` (uniform reason, names neither half).
  - Missing password → 400 `REQUEST_INVALID`.
  - Duplicate register → 409 `EMAIL_TAKEN`.
  - Second sign-in → 200, fresh session.
  - `DELETE` → cookie cleared; the revoked token then renders the anonymous surface.
  - `/vi/account` renders the localized form + anonymous surface.
  - `ui.identity.sign-in` capture: real Playwright screenshot + markup of the anonymous surface
    at `desktop-1536x1024` → `captures/sign-in-desktop-1536x1024.{png,html}`.

## Records changed

- `ui.identity.sign-in`: `uninvestigate → todo`. Controls marked wired; stale "no form/handoff
  deferred" gap replaced by the true residuals: render-proof can't bind (brand record's `colour:`
  map isn't the `color.tokens` shape `checks/render.mjs` parses — `RENDER_PROOF_INCOMPLETE`, a
  checker/record-shape gap, not a product defect), no UAT run, owner acceptance unclaimed.
  `evidence.yaml` regenerated via `scripts/example-evidence.mjs`: custody PASS, captures PASS
  (new), render FAIL → `outcome: fail`; `todo` is the honest state — `done` requires bound proof.
- `gap.identity.live-proof`: statement narrowed to the one remaining absence — no
  `uat/sign-in/runs/<runId>` with screens+video+`Outcome: pass`. Everything else it named
  (surface, handoff, SSR crash, harness) is now resolved. Stays `todo`; `closedBy:
  uat.identity.sign-in` unchanged.
- `uat.identity.sign-in`: untouched — still `todo`; no run exists and none is claimed.

## Not done / residual

- No identity UAT spec exists in `ecommerce-app-fe/uat/flows/` (only `uat.smoke.spec.ts`), so the
  flow was not UAT-executed; `gap.identity.live-proof` + `uat.identity.sign-in` stay `todo`.
- `next build` is red repo-wide on the parallel lane's page-folder lint violations (listed above).
- The render-proof brand-shape gap affects every ui-screen record in this tree, not just this one.
