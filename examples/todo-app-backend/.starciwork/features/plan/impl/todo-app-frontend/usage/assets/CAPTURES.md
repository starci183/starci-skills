# Runtime captures: impl.plan.todo-app-frontend.usage

Rendered proof for ui.plan.usage, captured 2026-09-18 by interface.implement.

## Served build

- Frontend: this worktree's `examples/todo-app-frontend`, `next build` + `next start -p 3002`
  (production build, not dev mode). Port 3002 because the shared dev stack's stray
  `ex-work-settle` `next start` already held :3000.
- Backend: the running dev-stack Nest API on `http://localhost:3001/graphql` (shared Postgres
  `todo` db + Keycloak realm `todo` on :8089). The API's CORS only allows origin :3000, so the
  Playwright driver proxied `localhost:3001/**` through `route.fetch` (the real request issued
  from Node, real responses fulfilled into the page, `access-control-allow-origin` rewritten to
  `*` so the browser accepts them). Every byte the page rendered came from the real backend.
- Session: real `signIn` mutation through the rendered `/sign-in` form as `demo@todo.dev`
  (realm-seeded demo person, `personId fc7b535d-3be7-4680-a5ec-24da1b52d560`), navigating to
  `/plan/usage` with the issued session token in `localStorage` exactly as the app stores it.

## Data states

`planUsage` reads live data; the states were reached by seeding the shared Postgres `todo`
database because the real create path refuses beyond the cap (PLAN_CAP_EXCEEDED) and SePay is
unreachable from dev (demo-only placeholder key), so an over-cap/downgraded lifecycle cannot be
produced through the API here:

- over-cap-frozen: 40 `complete=false` task rows inserted for the person (read back as
  `{plan: free, cap: 20, activeCount: 40}` via the real query).
- at-cap: 20 of the 40 marked complete -> `activeCount 20`.
- under-cap: 32 marked complete -> `activeCount 8`.
- paid-unlimited: the person's existing subscription row set to `plan=paid, status=active`
  (upsert `ON CONFLICT (person_id)`); restored to `free/free` after the capture.
- refused: fresh browser context with no session token.
- loading: the GraphQL request delayed 4s by the driver so the skeleton state was observable.

All seeded task rows (`fe-plan-seed-*`) were deleted and the subscription row restored to
`free/free` after the run.

## Captures

| File | State | Viewport | Notes |
|---|---|---|---|
| running-page-desktop.png/.html | over-cap-frozen | 1440x900 | representative direction state |
| running-page-mobile.png/.html | over-cap-frozen | 390x844 | compact header + bottom tab nav, no horizontal overflow |
| running-page-at-cap.png/.html | at-cap | 1440x900 | "100% of cap", non-danger warning + secondary Upgrade plan |
| running-page-under-cap.png/.html | under-cap | 1440x900 | "40% of cap", count + bar only |
| running-page-paid-unlimited.png/.html | paid-unlimited | 1440x900 | Paid plan, no cap/bar/upgrade |
| running-page-refused.png/.html | refused | 1440x900 | assertive read refusal, no session |
| running-page-loading.png/.html | loading | 1440x900 | skeleton placeholders |

Observed: `data-state` reflects each state; `200% of cap` renders beside a visually full
progress bar (value clamped to 100); "Upgrade plan" primary label computes `rgb(0,0,0)` on
`rgb(47,107,255)`; no console errors; no horizontal overflow at either viewport.

## Known deviations vs direction

- Card measure is narrower than the generated direction: the app's `main { max-width: 32rem }`
  rule in `globals.css` (outside this lane's write ceiling) bounds the workspace column for
  every screen; the direction's wider card is approximated, not matched.
- The stray backend process crashed once during the run (unhandled PLAN_CAP_EXCEEDED inside the
  `*/5` recur tick reading the seeded over-cap person); captures continued after a restart with
  `RECUR_TICK_CRON` scheduled out. A backend-side finding, not a frontend defect.

## Not run

- Upgrade checkout is not exercised to a payment: `upgradePlan` requires SePay, unreachable
  with the demo-only key (gap.plan.sepay-not-reachable); the button invokes the real mutation
  and surfaces its refusal honestly rather than a fake success.
- Sonar/quality-gate: no Sonar runner exists in this repository — not-run, not claimed.
