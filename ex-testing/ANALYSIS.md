# Testing Fleet — Critical Analysis & Lane Plan

Date: 2026-09-18
Scope: `.claude/examples/todo-app-backend` + `.claude/examples/ecommerce-app-be` (the two product apps).
Main backend (`src/`, `apps/` at repo root) already carries 875 unit specs + ~86 e2e/int specs — **not** in scope for this fleet.

Owner requirement (from chat):
- E2E = **full TypeScript NestJS `TestingModule`** — `Test.createTestingModule`, infra behind injectable providers/module hooks, one test = one complete A→Z business journey, real infra (testcontainers or compose), explicit setup → run flows → destroy + verify cleanup. No `.mjs`/`.js` bespoke runner as the execution model. Even the stack orchestration is TypeScript.
- Unit = full TypeScript, `Test.createTestingModule` style (nivo/starci-academy convention), both apps.
- 20 agents max: 10 unit lanes + 10 e2e lanes, disjoint scopes, existing-checkout mode (`orca terminal create --worktree path:<repo>`), no `git worktree add`, agents must not touch files outside their scope.
- Sonar + Codecov already configured → must be used.

---

## 1. Current state — todo-app-backend

- 362 source files, 61 spec files.
- **Only 2/61 specs use `Test.createTestingModule`; ~54 instantiate classes directly** (`new XService(deps)`). Convention violation to fix, not just gap-fill.
- Spec concentration (bussiness modules — good): audit 11, notify 10, plan 9, recur 11, share 6, task 8, session 3, sepay 1, platform events 1, app.boot 1.
- **Zero-coverage areas:**
  - `src/features/todo/graphql/**` — every mutation + query resolver (~30 leaves × 3 files: resolver/dto/graphql-types). Entire transport surface untested.
  - `src/modules/platform/**` — 1 spec total (events); databases, caches, config, keycloak/http-client untested.
  - `src/modules/integrations/**` — 1 spec (sepay); other clients untested.
  - `src/modules/shared/**` — 36 files, 0 specs.
- E2E: `test/e2e/` = JS harness (`run.js`, `lib/stack.js`, `scenarios/**/*.e2e-spec.js`, compose stack, journal/registry). Functionally complete for 14 flows but **wrong technology per owner direction** — must be superseded by TS `TestingModule` specs run by jest directly. Keep compose assets; port `stack.js` logic into `E2EStackService`.

## 2. Current state — ecommerce-app-be

- 70 source files, 6 spec files — near-zero coverage.
- 0/6 specs use `TestingModule` (all direct instantiation).
- Monorepo: `apps/identity` (account, session) + `apps/order` (cart, catalog, order, payment), each with platform (postgres/redis/config) + integrations client to the other app.
- **Zero coverage:** identity session (4 files), order cart/catalog/payment (3 each), all platform config/db/redis, features/checkout transport, app.module wiring.
- **No e2e at all** — no test/e2e dir, no compose stack (identity+order+postgres+redis needed).

## 3. Quality gates

- `codecov.yml` (repo root): project ≥ 80%, patch ≥ 90%, blocking.
- `sonar-project.properties` (repo root): `sonar.sources=src,apps` — **does not cover `.claude/examples/`**. Decision: each example app gets its own `sonar-project.properties` (own projectKey, `sonar.sources=src,apps`, lcov at `coverage/lcov.info`). Requires projects on `sonar.starci.org`; if unprovisioned, codecov still receives per-app lcov via flags (`todo-be`, `ecommerce-be`).
- Jest: each app produces `coverage/lcov.info` (`jest --coverage`); codecov upload per flag.

## 4. Execution model

- Agents run via `orca terminal create --worktree path:D:\Repositories\starci-academy-backend --command "devin ..."` — same checkout, **no git worktrees**.
- Agents do NOT run `git add/commit/checkout` — trò reviews + commits. Avoids index races across 20 lanes in one tree.
- Disjoint scopes = disjoint directories. `package.json`, `tsconfig*`, `jest.config*` are single-owner files — only designated infra lanes may touch them; flow lanes pass `--config` on the jest CLI and must not edit manifests.
- Agents write spec files only within their lane scope. Shared helpers for unit tests: each lane keeps helpers inside its own scope dir (no shared test-utils file → no cross-lane file contention).
- Unit spec convention: `Test.createTestingModule({ providers: [X, {provide: Dep, useValue: mock}] })`, `module.get(X)`, mock at provider boundary (repos, clients, event emitters, config), assert behavior + failure paths + authorization/persistence boundaries. Follow existing spec style in-app.

## 5. E2E architecture (contract all lanes code against)

```
test/e2e/
  infra/testing-infra.module.ts   @Module({}) TestingInfraModule.register({context})
  infra/e2e-stack.service.ts      onModuleInit → compose up --wait, alloc ports, spawn api
                                  onApplicationShutdown → down -v, verify volumes/containers gone
  infra/e2e-http.service.ts       axios client per-user (baseURL from stack)
  infra/e2e-auth.service.ts       create/delete test accounts (keycloak admin or api)
  infra/e2e-db.service.ts         DataSource for out-of-band seed/verify
  infra/compose/*.yaml            run-scoped project name + ports
  jest.config.ts                  ts-jest, testMatch **/*.e2e-spec.ts, timeout 120s
  <area>/<flow>.e2e-spec.ts       describe(feature) → it(one A→Z journey) → afterAll close
```

- Spec boots its own module: `imports:[TestingInfraModule.register({context:TestContext.E2E})]`; `afterAll(() => moduleRef.close())` triggers teardown + cleanup verification.
- One `it` = one journey. DB used for out-of-band seed/verify only, never to shortcut the flow under test.
- Run: `npx jest --config test/e2e/jest.config.ts test/e2e/<area>/<flow>.e2e-spec.ts`.
- Sequential lanes share nothing: per-spec compose project name (hash of spec path) avoids collisions when specs run in parallel later.

## 6. Lane map (10 unit + 10 e2e)

### Unit lanes (todo-app-backend: UT-1..6, ecommerce: UT-7..10)

| Lane | Scope (exclusive) | Work |
|---|---|---|
| UT-1 | `todo/src/features/todo/graphql/mutations/{session,task,share}/**` | Resolver specs: sign-in/out, task CRUD lifecycle, invite/accept/revoke — mocked use-case deps via TestingModule |
| UT-2 | `todo/src/features/todo/graphql/mutations/{plan,recur,notify,audit}/**` | Resolver specs: upgrade/downgrade/reconcile, make/edit/end recurrence, unsubscribe/update-prefs, request/complete erasure |
| UT-3 | `todo/src/features/todo/graphql/queries/**` | All query resolvers |
| UT-4 | `todo/src/modules/platform/**` | databases, caches, config, keycloak, events gap-fill |
| UT-5 | `todo/src/modules/{integrations,shared}/**` | integration clients + shared utils (36 files) |
| UT-6 | `todo/src/modules/bussiness/**` + existing specs | Convert direct-instantiation specs → TestingModule where valuable; fill bussiness edge cases (policy failures, event emission, tx boundaries) |
| UT-7 | `ec/apps/identity/**` except platform | session, account, features transport, order client |
| UT-8 | `ec/apps/order/**` except platform | cart, catalog, order, payment, features transport, identity client |
| UT-9 | `ec/apps/*/src/modules/platform/**` | both apps' config/db/redis providers |
| UT-10 | `ec` cross-cutting + app.module wiring smoke | module compile tests, guard/interceptor wiring |

### E2E lanes

| Lane | Scope | Work |
|---|---|---|
| E2E-0 | `todo/test/e2e/infra/**`, `test/e2e/jest.config.ts`, `test/e2e/stack/**`, `package.json` (scripts only) | TestingInfraModule + E2EStackService + helpers + compose TS port + ONE exemplar spec `auth/sign-in.e2e-spec.ts` proving contract |
| E2E-1 | `todo/test/e2e/session/**` | sign-out flow, session-expiry flow |
| E2E-2 | `todo/test/e2e/task/**` | create→complete→reopen journey; list/counts journey |
| E2E-3 | `todo/test/e2e/recur/**` | make-recurring→occurrences→edit→end journey |
| E2E-4 | `todo/test/e2e/audit/**` | erasure request→complete→export→log-append/read journey |
| E2E-5 | `todo/test/e2e/{plan,notify,share}/**` | upgrade→quota→downgrade; notify prefs→unsubscribe; invite→accept→collaborate→revoke |
| E2E-6 | `ec/test/e2e/infra/**`, `ec/test/e2e/jest.config.ts`, compose, `package.json` scripts | Same infra contract for ec (identity+order+postgres+redis) + exemplar `identity/sign-up-sign-in.e2e-spec.ts` |
| E2E-7 | `ec/test/e2e/checkout/**` | register→browse catalog→cart→checkout→payment→order-confirm journey |
| E2E-8 | `ec/test/e2e/order-lifecycle/**` | order history, cancel/retry-payment journey, cross-service identity↔order |
| E2E-9 | `ec/test/e2e/resilience/**` + both apps' teardown-verification specs | infra-down recovery, cleanup-assertion spec pattern |

## 7. Risks

- **Single-checkout concurrency**: 20 agents in one tree → strict dir scoping; no shared file edits; no git ops by agents.
- **Contract drift**: e2e flow lanes depend on E2E-0/E2E-6 APIs — contract frozen in briefs; flow lanes may create a local `.d.ts` stub if infra not landed yet, but must not implement infra themselves.
- **JS→TS harness conversion**: old `run.js` stays until TS suite green; record in notes, delete in examples mission afterward.
- **Sonar projects may not exist** on sonar.starci.org → per-app properties written anyway; report honestly if scan fails auth/provisioning.
- **Boot cost**: per-spec stack = slow but correct; shared-stack optimization deferred.
- **.claude runtime files**: agents must not touch `.claude/` kernel/hosts — scope is `examples/` only.

## 8. Done criteria

- `jest --coverage` per app: line coverage ≥ 80% on new code; no direct-instantiation anti-pattern in new specs.
- All e2e specs green via jest direct run; teardown spec proves containers/volumes removed.
- `sonar-scanner` per app (or documented block) + codecov lcov artifacts present.
- No file outside lane scope modified (verified by `git status` diff vs scope map).
