# v9 — UAT completion fleet

Read first: `.claude/SKILL.md`, `ex-testing/lint/v7-11-REPORT.md` (documents exact stack boot + run env + run-writer contract), `ex-testing/lint/v7-12-REPORT.md` (ec absences), `uat/lib/*.ts` harness in the fe app.

## Stack already running — do NOT re-boot
- todo BE on :3001 (GraphQL), todo FE on :3000, keycloak :8089 realm `todo`, postgres :5432, redis :6379, minio :9000
- Demo accounts: `demo@todo.dev`/`todo-demo-pass`, `demo2@todo.dev`/`todo-demo-pass-2` (DEMO-ONLY committed)
- Run env: `UAT_LIVE_LOGIN_AUTHORIZED=true UAT_DEMO_PASSWORD=todo-demo-pass UAT_PASSWORD_STRANGER=todo-demo-pass-2 UAT_BASE_URL=http://localhost:3000 UAT_API_BASE_URL=http://localhost:3001`
- If the stack is down, boot it the way v7-11 did (compose.e2e.yaml project + npm build + next start)

## Hard rules
- A uat record only goes `done` when `runs/<id>/` has screens + real video + `result.md` `Outcome: pass` + cleanup verified. Never fabricate.
- `test.skip` stubs must become real walks using `uat/lib/steps.ts` + `run-writer.ts` conventions — read the two implemented specs (`uat.task.create.spec.ts`, `uat.login.sign-in.spec.ts`) first and match their style.
- If the walk needs app behavior that doesn't exist (endpoint missing, UI missing), STOP: do not fake it — write/named the absence in the owning gap record and report `APP_CAPABILITY_MISSING`.
- Multiple lanes run Playwright concurrently — namespace test data with your run id (the harness already does this via `uat-<ts>-<rand>-<slug>` titles).
- Marker: `ex-testing/lint/done/<lane>.done`; report `ex-testing/lint/<lane>-REPORT.md`.

## Amendment — state vocabulary + sepay policy (owner directive)

Authored `state` vocabulary is now FOUR values: `todo`, `inprogress`, `done`, `uninvestigate`.
- `todo` = designed, work not started / not proven
- `inprogress` = work in flight or partially provable (e.g. blocked on an external provider leg)
- `done` = proven by settled evidence only
- `uninvestigate` = authored admission that the claim is not yet investigated (also the derived
  verdict when a completion digest no longer binds — both readings are valid)

SEPAY / payment-gateway flows: DO NOT drive the gateway leg by simulating the signed webhook
callback. Treat `integration.plan.sepay` as `inprogress` — the UAT walk covers only what the
app itself serves (cap refusal, upgrade-path surface); the gateway leg stays unproven and the
uat record settles at `inprogress` (never `done`) with the gap naming the pending gateway leg.
The same rule applies to any external-provider leg (oauth, payment, email delivery): no fake
callbacks, mark the record `inprogress` and let the gap name what is pending.
