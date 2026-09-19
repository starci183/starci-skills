# Coverage wiring + numbers — Lane Q8

Date: 2026-09-19
Scope: `examples/*/jest.config.js` (coverage keys only), `examples/*/package.json` (scripts only), this report.

## Wiring

Both apps now emit `coverage/lcov.info` at the app root on `npx jest --coverage` / `npm run test:coverage`.

- `todo-app-backend/jest.config.js`: added `coverageDirectory: '<rootDir>/../coverage'` (rootDir is `src`, so the default would have written to `src/coverage`), `coverageReporters: ['text', 'lcov', 'json-summary']`, and extended `collectCoverageFrom` to exclude `*.e2e-spec.ts`, `tests/**` (e2e specs + test infra), `node_modules`, `dist` in addition to the existing `*.spec.ts` / `main.ts` exclusions.
- `ecommerce-app-be/jest.config.js`: added `coverageDirectory: 'coverage'`, same reporters, and extended `collectCoverageFrom` with `!**/*.e2e-spec.ts`, `!**/main.ts` (was `!apps/**/main.ts` only), `!**/node_modules/**`, `!**/dist/**`. Existing `!src/tests/**` kept.
- Both `package.json`: added `"test:coverage": "jest --coverage"`. No other manifest keys touched.

## Results — todo-app-backend

`npx jest --coverage`: **108/108 suites, 547/547 tests passed** (80s). Artifacts: `coverage/lcov.info`, `coverage/coverage-summary.json`.

| Metric | Covered / Total | Pct |
|---|---|---|
| Lines | 5997 / 6467 | **92.7** |
| Statements | 6765 / 7949 | **85.1** |
| Functions | 1259 / 1445 | **87.1** |
| Branches | 3356 / 6127 | **54.8** |

Per-domain (L/B/F/S %, aggregated from `coverage-summary.json`):

| Domain | Lines | Branches | Functions | Stmts |
|---|---|---|---|---|
| features/todo/graphql (incl. mutations/, queries/) | ~95 | ~55 | 100 | ~86 |
| features/todo/http (health, webhooks/sepay) | **0.0** | 0.0 | **0.0** | **0.0** |
| app.module.ts | **0.0** | 0.0 | **0.0** | **0.0** |
| modules/bussiness/audit | 96.7 | 58.4 | 80.4 | 88.0 |
| modules/bussiness/notify | 94.1 | 56.4 | 92.5 | 88.3 |
| modules/bussiness/plan | 95.9 | 56.4 | **73.1** | 86.8 |
| modules/bussiness/recur | 95.1 | 58.6 | 80.3 | 87.7 |
| modules/bussiness/session | 95.7 | 49.6 | 91.7 | 89.4 |
| modules/bussiness/share | 92.5 | 53.9 | **72.8** | 83.8 |
| modules/bussiness/task | 96.0 | 47.3 | 94.3 | 89.0 |
| modules/integrations/keycloak | 97.0 | 51.6 | 84.6 | 88.0 |
| modules/integrations/notify-queue | 93.2 | 60.7 | 82.1 | 89.0 |
| modules/integrations/notify-smtp | 92.7 | 53.1 | **75.0** | 86.5 |
| modules/integrations/sepay | 94.0 | 62.7 | **75.0** | 85.7 |
| modules/platform/config | 97.3 | 62.3 | 100 | 90.9 |
| modules/platform/databases | 82.1 | 59.3 | **76.5** | **77.7** |
| modules/platform/events | 97.6 | 38.3 | 95.2 | 91.2 |
| modules/shared/exceptions | 100 | 50.0 | 100 | 100 |

**Below-80 flags (todo):**
- `features/todo/http/**` and `app.module.ts`: 0% on every metric — no spec imports them (transport + root wiring untested).
- `modules/platform/databases`: functions 76.5, statements 77.7.
- Functions < 80: bussiness/plan 73.1, bussiness/share 72.8, integrations/notify-smtp 75.0, integrations/sepay 75.0.
- Branch coverage is < 80 in **every** domain (best: sepay 62.7, config 62.3; worst: platform/events 38.3, bussiness/task 47.3). Total 54.8 — this is the main gate risk vs codecov's 80% project target.

## Results — ecommerce-app-be

`npx jest --coverage`: **4/35 suites passed, 31 failed to compile; 18/18 tests in passing suites green** (37s). Artifacts still emitted (`coverage/lcov.info`, `coverage-summary.json`), but totals reflect only what the 4 green suites exercised — a floor, not real coverage.

| Metric | Covered / Total | Pct |
|---|---|---|
| Lines | 265 / 1268 | **20.9** |
| Statements | 313 / 1598 | **19.6** |
| Functions | 38 / 247 | **15.4** |
| Branches | 196 / 1486 | **13.2** |

Passing suites: `platform/databases/postgresql/{identity,order}` entity + `primary.module` specs. Everything else — `modules/bussiness/{account,cart,catalog,order,payment,session}`, `modules/integrations/**`, `modules/platform/{caches,config*}`, `features/{identity,checkout}/**`, `apps/*/src` — sits at 0% in the report solely because its suites never ran. `platform/config` reached L 54.0 / B 29.1 / F 28.6 and `platform/databases` L 75.8 / B 53.9 / F 56.6 from the passing suites alone.

**Below-80 flags (ec):** every domain on every metric — but treat as *unmeasured*, not *uncovered*.

### Blocker (out of Q8 scope — dependency lane)

31 suites fail with two symptoms, one root cause:

- TS: `Property 'get'/'close' does not exist on type 'TestingModule'`
- Runtime: `Cannot find module '@nestjs/core/metadata-scanner'`

`@nestjs/testing` is **not in ec's package.json** and not under `examples/ecommerce-app-be/node_modules`, so resolution walks up to the parent repo's copy: `@nestjs/testing@11.1.19` against ec's own `@nestjs/common|core@10.4.22`. The v11 testing package type-mismatches v10 specs and requires a core subpath v10 doesn't ship. Fix = add `@nestjs/testing@^10` to ec's devDeps (deps section is another lane's scope; Q8 may not touch it). Re-run `test:coverage` after that lands for real numbers.

## Commands

```
cd examples/todo-app-backend   && npx jest --coverage   # green, coverage/lcov.info
cd examples/ecommerce-app-be  && npx jest --coverage   # 31 suites fail to compile (dep mismatch), partial lcov
```

No specs were edited, skipped, or weakened for these numbers.
