# Coverage summary — lane v3-6

Date: 2026-09-19
Prior art: `ex-testing/COVERAGE-REPORT.md` (q8 wired both BE jest configs; this lane verified them,
wired the FE suite that exists, and re-ran everything after the ec-be `@nestjs/testing` dep landed).

## Totals

| App | Runner | Suites | Tests | Lines | Functions | Branches | Statements | lcov |
|---|---|---|---|---|---|---|---|---|
| todo-app-backend | jest | 117/117 | 696/696 | 94.00 | 89.27 | 54.85 | 86.21 | `examples/todo-app-backend/coverage/lcov.info` |
| ecommerce-app-be | jest | 36/36 | 216/216 | 96.14 | 98.38 | 56.12 | 87.76 | `examples/ecommerce-app-be/coverage/lcov.info` |
| todo-app-frontend | vitest (v8) | 16/16 | 101/101 | 62.95 | 57.01 | 79.33 | 62.95 | `examples/todo-app-frontend/coverage/lcov.info` |
| ecommerce-app-fe | — | — | — | — | — | — | — | no unit suite |

Numbers are pct of covered/total; raw counts live in `coverage-<app>.json` next to this file.

## Notes per app

- **todo-app-backend** — unchanged from q8's wiring; re-run green. Growth since q8's run
  (108 suites / 547 tests → 117 / 696) came from specs added by other lanes. Branch coverage
  remains the weak metric (54.85); `features/todo/http/**` and `app.module.ts` still sit at 0%.
- **ecommerce-app-be** — q8's blocker is resolved: `@nestjs/testing@10.4.22` is now in devDeps and
  installed, matching `@nestjs/common|core@10.4.22`. All 36 suites compile and pass; the previous
  "floor" numbers (lines 20.9) are replaced by real ones above.
- **todo-app-frontend** — vitest, not jest (suite predates this lane). Added only coverage keys to
  `vitest.config.ts` (v8 provider, `text`/`lcov`/`json-summary` reporters, `coverage/` dir,
  src-only include with spec/d.ts/node_modules/dist/.next excludes — the same shape the BE jest
  configs use), a `test:coverage` script, and the `@vitest/coverage-v8@^2.1.2` devDep matching
  installed `vitest@2.1.9`. 16 spec files / 101 tests, all green. v8 reports statements == lines.
- **ecommerce-app-fe** — **no unit suite**: zero `*.spec.*`/`*.test.*` files and no jest/vitest
  config or test script anywhere in the workspace (root + `apps/landing` + `apps/shop`).
  Per the brief, nothing was invented.

## Commands

```
cd examples/todo-app-backend   && npx jest --coverage
cd examples/ecommerce-app-be   && npx jest --coverage
cd examples/todo-app-frontend  && npx vitest run --coverage
```

Each emits `<app>/coverage/lcov.info` plus `coverage-summary.json`.

## Codecov wiring

Root `/.github/workflows/ci.yml` uploads the main repo's `coverage/lcov.info` via
`codecov/codecov-action@v5` with `use_oidc: true` (`id-token: write`). The example apps are not
covered by that job (different working directories, no flags). Added additive workflow
`.claude/.github/workflows/example-coverage.yml`: one job per app that has a suite, each running
its coverage command and uploading with a per-app Codecov **flag** (`todo-be`, `ecommerce-be`,
`todo-fe`) so the four apps stay separable in one Codecov project instead of being merged into the
main repo's numbers. `ecommerce-app-fe` is intentionally absent (no suite). No existing workflow
was edited.

Caveat for the supervisor: root `codecov.yml` gates `project` at 80% and `patch` at 90% with no
per-flag statuses defined. Flags make the uploads separable in the UI, but the repo-wide project
status will still aggregate example lines into the same denominator — `todo-fe` at ~63% lines would
drag the aggregate if the suite stays thin. If that matters, the follow-up is a `flags:` status
section in `codecov.yml` (outside this lane's scope; `codecov.yml` lives at the main repo root, not
under `.claude`).
