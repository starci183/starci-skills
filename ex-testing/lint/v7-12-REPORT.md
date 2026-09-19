# Lane v7-12 — ec UAT runs: REPORT

Date: 2026-09-19. Scope: `examples/ecommerce-app-be/.starciwork/features/**/uat/**`.
Baseline read: `_common.md`, v7-11's brief (procedure source), v6-3 + v6-4 audit reports.

## Headline finding

**Ecommerce has no UAT spec suite and had no uat records at all.** `ecommerce-app-fe/uat/`
does not exist — no `playwright.config.ts`, no `uat/lib/run-writer.ts`, no `flows/*.spec.ts`
(verified: `find` for `uat`/`playwright.config.*` under `ecommerce-app-fe`, excluding
node_modules, returns nothing; `grep -rl uat` over the whole ec `.starciwork` tree returned
nothing before this lane). Unlike the todo tree — which had 7 designed `uat.*` records this
phase could settle — the ec tree had zero. There was nothing to settle and nothing executable.

## Boot topology (brief step 2), verified though nothing could run

- ec-be merged `src/` app confirmed: `apps/identity/src/main.ts` and `apps/order/src/main.ts`
  are thin Nest boots importing `src/modules/...` via `@modules/*` aliases; ports come from
  `metadata.json`'s projection — identityApi 5070, orderApi 6070, postgres 5501, redis 6448,
  landing 3069, shop 4069.
- Dev infra: `.starcistacks/dev/infra/compose/compose.yaml` (project `ecommerce-app-be-dev`)
  brings up postgres (trust auth, db `ecommerce`) + redis; the identity/order compose services
  are placeholder images behind `profiles: [app]` — canonical run is host-side
  `npm run start:identity` / `npm run start:order` after `npm run build`.
- ec-fe: two Next apps — `landing` (public) and `shop` (authenticated: browse, cart, checkout,
  account), consuming identity/order via `NEXT_PUBLIC_*_API_URL` resolved from the be metadata.

## What I changed — records authored (all `state: todo`, nothing fabricated)

The tree's own convention for a designed-but-unproven walk is `todo` + `blockedBy` rooted in a
`gap.*.live-proof` record (todo tree: `uat.task.create` → `gap.task.live-proof`). The ec tree
lacked even that — a silent absence, the same class of defect v6-3 flagged for missing FRs.
So I authored the coverage as named absences:

- `features/identity/uat/sign-in/index.yaml` — `uat.identity.sign-in`, todo. Steps mirror
  `fr.identity.sign-in`'s real flows (register pair → wrong-pair uniform refusal →
  missing-half pre-check refusal → taken-email conflict → second sign-in issues a new
  session). `proves: [fr.identity.sign-in, br.identity.sign-in]` (both done). No
  `environment`/`fixtures` fields: ec has no `_resources/` records to reference and inventing
  refs would refuse. `accounts.yaml` uses the schema's `{role, username, password}` shape
  (todo's `identity:` refs were unusable — no `work/resource` kind identity exists in ec).
  `entry: /account` — the route `ui.identity.sign-in` claims on the shop app.
- `features/checkout/uat/place-order/index.yaml` — `uat.checkout.place-order`, todo. Steps
  mirror `fr.checkout.place-order`/`br.checkout.place-order`: browse → add line → confirm →
  replay returns the first confirmation → empty-cart refusal → beyond-stock refusal naming
  product/qty/stock → order visible on the account page (the `order-for-identity`
  postcondition). `proves: [fr.checkout.place-order, br.checkout.place-order]`.
  `entry: /browse` — the one already-connected shop route.
- `features/identity/gap/live-proof/index.yaml` — `gap.identity.live-proof`, todo,
  `closedBy: uat.identity.sign-in`. Statement names BOTH absences: no uat harness, AND the
  sign-in surface is unbuilt — `AccountPage` is read-only (`fetchCurrentUser` reads `/me` with
  ambient credentials), no register/sign-in form exists in either fe app, and the
  landing→shop session handoff is an explicitly unsettled contract
  (`apps/shop/src/modules/api/identity.ts` comment).
- `features/checkout/gap/live-proof/index.yaml` — `gap.checkout.live-proof`, todo,
  `closedBy: uat.checkout.place-order`. Second absence named truthfully: the shop's `cart`
  route ships an honest empty state (cart persistence deferred) and `checkout` renders the
  blocked state (session handoff + non-empty cart preconditions unsettled) — per the routes'
  own contract comments.

## Could NOT prove — and why

- **Both uat records are unprovable for lack of specs** (brief's predicted case, one level
  deeper: the records themselves didn't exist). Per brief, writing the Playwright suite is app
  work and out of lane.
- **Deeper than missing specs**: even with a suite, `uat.identity.sign-in` cannot walk a
  form that doesn't exist, and `uat.checkout.place-order` steps 2–6 cannot exercise scaffold
  routes. Both gap statements record this so a future lane doesn't write specs against dead
  screens and call the resulting failures a surprise.
- **Cleanup is honest "none"**: ec has no account deletion and orders are final — the walks
  leave disposable rows in the demo store, stated on the records rather than promising a
  delete the product doesn't have.

## Gate result

`node scripts/check-example-work.mjs` after authoring:
`304 record(s), 2548 ref(s), 114 evidence file(s): 134 refused, 4 warned` — identical refusal
and warning counts to the pre-lane baseline; all 134 REFUSED and all 4 WARN lines are in the
**todo-app-backend** tree (other lanes' in-flight scope). Zero refusals/warnings touch the ec
tree or my new records; blockedBy chains root in `work/gap` (no BLOCKER_UNROOTED), all refs
resolve, `closedBy` targets exist.

Baseline verbatim tail (unchanged by this lane):
```
WARN examples/todo-app-backend/.starciwork/features/share/contract/completion-guard-for-task/index.yaml: blockedBy chain reaches br.task.single-owner, which is neither a work/gap nor an open work/policy-decision - the chain's real root is unnamed [BLOCKER_UNROOTED]
WARN examples/todo-app-backend/.starciwork/features/task/fr/complete/index.yaml: blockedBy chain reaches br.task.single-owner, which is neither a work/gap nor an open work/policy-decision - the chain's real root is unnamed [BLOCKER_UNROOTED]
295 record(s), 2518 ref(s), 114 evidence file(s): 134 refused, 4 warned
```

## Boundary notes / unresolved

- **Family crossing, declared**: `gap/**` is v7-4's family, but a `todo` uat record whose
  blocker doesn't resolve would refuse (`blockedBy target does not exist`) or warn
  (BLOCKER_UNROOTED). The finding is this lane's; the gaps were authored here rather than left
  dangling. v7-4 should treat both as settled roots, not new work.
- **`proves` may want extending later**: if v7-2 lands `fr.checkout.cart-*` records,
  `uat.checkout.place-order`'s walk covers cart ops too — its `proves` list names only the two
  records that exist today. Left for v7-13 to extend if those records land.
- **`_derived/`** will lag further until v7-8 rebuilds (expected mid-flight; not re-run here).
- **accounts.yaml shape diverges from todo's** (username/password per schema vs todo's
  `identity:` refs) — deliberate: schema-conformant and the only honest option with no
  `_resources` identity records. Flagging in case v7-14/v7-15 compares shapes across trees.
- **record↔code contradiction**: none found in my scope. The page-contract comments in the fe
  and the gap statements agree — the product itself declares the surfaces unbuilt.
