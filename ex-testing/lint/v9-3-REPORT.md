# Lane v9-3 — REPORT: uat.plan.upgrade-after-cap

Date: 2026-09-19. Scope: `examples/todo-app-frontend/uat/flows/uat.plan.upgrade-after-cap.spec.ts`
(the `test.skip` stub this lane was told to implement) + the plan feature's owning records under
`examples/todo-app-backend/.starciwork/features/plan/`. Read first: `v9/_common.md`, v9-5-REPORT.md
(the sibling inprogress/partial-settlement convention), the two implemented specs and `uat/lib/*.ts`.

## Verdict: partial live proof — run settles `fail`, honestly

The brief's verify-first questions answered against the running product:

- **20-task cap enforced?** Yes — `PlanCapGuardPolicy` sits in the real `createTask` path; at 20
  active tasks the API refuses with `PLAN_CAP_EXCEEDED`: "The free plan holds at most 20 active
  tasks. Upgrade at /plan/usage to create more." Verified over the wire before writing the spec.
- **Seed 20 tasks or create through the API?** Create through the API — the fixture only seeds the
  prerequisite account/task, not the outcome under test. The spec seeds 20 run-namespaced active
  tasks (`uat-<runId>-cap-01..20`) via correctly-headed GraphQL (`Authorization: Bearer <token>`,
  the same contract the browser uses).
- **Paid-plan checkout UI + sandbox gateway?** UI yes — `/plan/usage` renders the at-cap state with
  an "Upgrade plan" action that calls the real `upgradePlan` mutation. Sandbox gateway **no** — the
  SePay leg (`https://my.sepay.vn`, `/userapi/transactions/qr`) answers HTTP 404 with the
  placeholder credential in this environment. `UpgradePlanHandler` calls SePay *before* writing, so
  the failure leaves zero `payment_intents`/`subscriptions` residue (verified by psql read-back).
- **SePay module loaded?** Yes — the real client makes the outbound call; the app's own checkout
  door was exercised once through the UI and produced the honest refusal "Checkout could not be
  started." No signed webhook was simulated, per `_common.md`'s hard rule.
- **Do `features/plan/` records describe a sandbox path?** `integration.plan.sepay` describes the
  real gateway leg; it is `inprogress`, not `done` — the provider leg has never completed.

One product defect found and recorded, not faked around: the `/tasks` screen **never renders the
create refusal** — `TaskListBlock.onCreate` calls the mutation but `createTask.error` is not bound
to any element. The API refuses correctly; the UI drops it. `ux.plan.create-refusal-feedback` is
recorded `observed: no`, which (with the gateway legs `not-run`) is why the run's `result.md`
settles `Outcome: fail` rather than `partial-pass`.

## Stack — shared, not rebooted

FE :3000 (200), BE :3001 `/health` ok, Keycloak :8089 realm `todo` (200), postgres
`compose-postgres-1` :5432 db `todo`, redis :6379, minio :9000 — used as-is per `_common.md`.

Run env: `_common.md`'s (`UAT_LIVE_LOGIN_AUTHORIZED=true`, demo passwords, `UAT_BASE_URL=:3000`,
`UAT_API_BASE_URL=:3001`) plus `UAT_PG_CONTAINER=compose-postgres-1`, `UAT_PG_DATABASE=todo` for the
nothing-written read-back and cleanup verification.

## Spec implemented — `uat.plan.upgrade-after-cap.spec.ts`

Six walked steps, each a `walkStep` checkpoint with screenshot: owner sign-in → seed to cap (20
API creates, run-namespaced titles) → `/plan/usage` shows at-cap + upgrade action → 21st create
through the UI is refused at the API (`PLAN_CAP_EXCEEDED`, cap + `/plan/usage` named in the error)
→ upgrade action through the UI reaches the real SePay leg and the app renders its refusal → all
20 seeded tasks deleted through the API and verified absent in Postgres.

Assertions: cap enforcement, usage at-cap surface, refusal naming the fix — `yes`;
`ux.plan.create-refusal-feedback` — `no` (the defect above); gateway-dependent legs
(`fr.plan.upgrade` settle, paid/unlimited usage, 21st task created after upgrade) — `not-run`,
each naming the pending provider leg. Outcome: **fail** — the full business flow is not provable,
and `done` is reserved for `Outcome: pass`.

Known harness-adjacent note: `uat` tsconfig lacks the DOM lib, so `page.evaluate` bodies typecheck
`window` as an error — identical pre-existing issue in the v9-5 spec; runtime-safe, Playwright run
clean (1 passed, 4.4s).

## Run produced (append-only)

`20260919T143402Z-5c10a673` — run folder under
`features/plan/uat/upgrade-after-cap/runs/`:

- `walk.json`, `manifest.yaml`, `result.md` (`Outcome: fail`), `cleanup.json`, `readback.json`,
  `flows.json`, `run-ledger.json`, `ux-checks.json`
- Screenshots: `owner-signed-in`, `owner-seeded-to-cap`, `usage-shows-at-cap`,
  `twenty-first-create-refused`, `upgrade-action-refused-at-gateway`,
  `run-tasks-deleted-and-verified-absent`, `screenshot.png`
- Real video: `videos/upgrade-after-cap.webm` — 161,964 B, WebM/VP8 800x450 25fps
- Cleanup triplet: created 20 / deleted 20 / verified-absent 20; read-back after cleanup:
  zero `uat-%` task rows, `payment_intents` = 0, subscription `free`

## Records changed

- `plan/uat/upgrade-after-cap/index.yaml` — `state: inprogress` (cap half proven live; `done`
  impossible while the gateway leg is unwalkable). `blockedBy` names `fr.plan.upgrade`'s pending
  gateway steps + `gap.plan.live-proof`; `change` rev 4.
- `plan/uat/upgrade-after-cap/evidence.yaml` — carries the run with `outcome: fail` and the
  no-webhook-simulation note; it does not settle the record.
- `plan/gap/live-proof/index.yaml` — stays `todo`; title + folded `statement` name both absences
  precisely: (a) SePay gateway leg pending (HTTP 404, placeholder credential, signed webhook not
  walkable, simulation forbidden), (b) `/tasks` renders no create-refusal feedback. `change` rev 3.
- `plan/integration/sepay/index.yaml` — `state: inprogress`; the app's real checkout door was
  exercised once and the provider failed (404/no credential) — `change` rev 4. Its
  `evidence.yaml` `recordDigest` was recomputed for the new rev
  (`64479e8d…5889`).
- `plan/fr/usage/view`, `plan/fr/upgrade`, `plan/journey/hits-the-cap` — `blockedBy` `because`
  texts corrected: they claimed "uat has not run"; it now has (cap half proves, run settles fail).
  Edges kept; `change` revs bumped (4, 4, 3).

## Gate

`node scripts/check-example-work.mjs`: **330 records, 7 refused** — all in other lanes' families
(six ec `ui/*/assets` id-less files; one concurrent `notify` run manifest assertion id). Zero
refusals touch `plan/**`, the new run folder, or any record this lane edited. The earlier
`recordDigest` staleness refusal on `integration.plan.sepay/evidence.yaml` was fixed by rebinding
the digest.

## What remains for a future lane

1. A SePay credential/sandbox that completes `POST /userapi/transactions/qr`, so the checkout leg
   can be walked for real — then the signed webhook leg, still never simulated.
2. A product fix binding the `createTask` mutation error to the `/tasks` surface so the refusal is
   visible where it happens (currently only the API + `/plan/usage` carry it).
3. Only then can `uat.plan.upgrade-after-cap` re-run to `Outcome: pass` and flip `done`, closing
   `gap.plan.live-proof` and unblocking `fr.plan.upgrade` / `fr.plan.usage.view` /
   `journey.plan.hits-the-cap`.
