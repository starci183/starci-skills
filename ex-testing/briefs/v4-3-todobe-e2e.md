# Lane v4-3 — todo-be E2E verification + residual fixes

SCOPE (exclusive): `examples/todo-app-backend/**` source + its `src/tests/**`. Do not touch other apps.

## Context

`todo-app-backend` is a NestJS GraphQL backend. Recent work: ESLint canon cleanup (0 errors now), module-boundary refactor (Keycloak/Sepay/NotifySmtp/NotifyQueue/PostgresqlPrimary are `isGlobal` in `src/app.module.ts`, cross-capability module imports removed), barrel `index.ts` files deleted → deep imports, and `PostgresPrimaryClient.ping()` now has a 5s deadline + `connectionTimeoutMillis` (fixes health-check hang when postgres is killed).

Last E2E run (before fixes) had these failures — your job is to verify they're fixed and fix whatever remains:
1. Six specs asserting `errors[0].extensions.code` == full codes like `TASK_FORBIDDEN_EXCEPTION` — `formatError` in `src/features/todo/graphql/graphql.module.ts` now passes `original.code` through unsuffixed. Expected: these pass now.
2. `src/tests/e2e/resilience/infra-recovery.e2e-spec.ts` — timed out waiting `/health` → 503 after postgres kill; the ping deadline should fix it. Expected: passes now.

## Tasks

1. `npx eslint src` → must stay 0 errors. `npx tsc --noEmit` → clean. `npx jest` → all green (baseline before E2E).
2. Run the E2E suite: `npx jest --config src/tests/e2e/jest.config.ts`. It boots real docker stacks per spec (compose project per spec, dynamic ports; docker daemon must be up — `starci-keycloak` etc. already run on this machine). Keycloak cold-start can be slow — readiness waits exist; retry once on transient readiness timeout before investigating.
3. For every failure: diagnose to root cause and fix in the OWNING source (per repo policy: fix defects directly, no debt files). Do not weaken assertions, do not mark tests skip, do not add timeouts to hide real hangs — the resilience spec legitimately waits on state.
4. Watch for regressions from the module-graph refactor: any Nest DI error naming KeycloakClient/SepayClient/Notify*Port/EntityManager means a provider isn't resolving ambiently — fix registration, not the consumer.
5. Report to `D:/Repositories/starci-academy-backend/.claude/ex-testing/lint/v4-3-REPORT.md`: spec results, root causes found, fixes applied, final counts.

## Rules

- English only in code/comments/tests.
- Canon style: deep imports, no barrels, exceptions carry object args.
- If a spec fails for a genuinely environmental reason (docker absent, port exhaustion), report it explicitly with evidence — do not fake green.
