# Lane Q10 — Scaffolding Cleanup Sweep Report

Date: 2026-09-19
Scope: `examples/todo-app-backend` + `examples/ecommerce-app-be` (delete-only sweep).
Method: enumerated every candidate category from the brief (`stubs/`, `infra-contract.d.ts`,
shadow `.d.ts`, `test/` dirs outside `src/tests`, `*.js`/`.cjs` leftovers under `src/tests`, `nul`
files), then grep-verified each candidate had zero live references before deleting.

## Deleted (5 files)

### `nul` redirect artifacts (Windows `> nul` accidents — literal files named `nul`)

| Path | Proof unreferenced |
|---|---|
| `examples/todo-app-backend/nul` | 122 bytes of captured `ls` stderr (`ls: cannot access 'test/e2e/*.ts'...`). Repo-wide grep for `nul` as an import/require/path token: 0 matches. Not a valid module name on any platform. |
| `examples/ecommerce-app-be/nul` | 60 bytes of captured `ls` stderr (`ls: cannot access 'node_modules'...`). Same grep: 0 matches. |

### Dead lane-scoped jest runners (parallel-lane-phase scaffolding)

Each file's own header documents it existed only so its lane could run specs before the
canonical config landed, and "once the canonical config lands ... this file can be deleted".
All three are now double-dead:

1. Their `roots` point at `test/e2e/...` — those directories no longer exist (suite moved to
   `src/tests/e2e/`); running any of them today yields "no tests found".
2. The canonical configs landed and cover the specs via `testMatch: **/*.e2e-spec.ts`:
   - todo: `src/tests/e2e/jest.config.ts` (roots `<rootDir>/src/tests/e2e`)
   - ec: `src/tests/e2e/jest.config.js` (wired to `package.json` `test:e2e`)
3. Grep for `lane.config` across both apps: the only matches are each file's own doc comment.
   No `package.json` script, no spec, no doc references them.

| Path | Stale root |
|---|---|
| `examples/todo-app-backend/src/tests/e2e/recur/jest.lane.config.cjs` | `test/e2e/recur` (gone); also mapped `../infra/*` → `test/e2e/recur/stubs/` which never existed post-move |
| `examples/todo-app-backend/src/tests/e2e/resilience/jest.lane.config.cjs` | `test/e2e/resilience` (gone) |
| `examples/ecommerce-app-be/src/tests/e2e/resilience/jest.lane.config.cjs` | `test/e2e/resilience` (gone) |

## Examined and KEPT (verified referenced / intentional)

| Path | Why kept |
|---|---|
| `examples/ecommerce-app-be/src/tests/e2e/jest.config.js` | Referenced by `package.json` script `test:e2e`. Header documents why it is `.js` (jest loads `.ts` configs only via ts-node, which the repo lacks). Canonical suite config, not a leftover. |
| `src/tests/e2e/resilience/e2e-infra-contract.ts` (both apps) | Real adapter + docker helpers; imported by `infra-recovery.e2e-spec.ts` and `teardown-verification.e2e-spec.ts` in each app (`from './e2e-infra-contract'`). |
| `src/tests/e2e/infra/*` (both apps) | Live infra module — 50+ `../infra/*` imports across all e2e specs. |
| `src/tests/e2e/infra/{e2e-util,testing-infra.options}.ts`, `e2e/order-lifecycle/lifecycle.helpers.ts` (ec) | Imported by specs and by `testing-infra.module`/`e2e-stack.service`. |

## Categories searched with zero findings

- `**/stubs/` — none exist in either app (the recur lane config's `moduleNameMapper` target
  `test/e2e/recur/stubs/` was already gone with the `test/` tree).
- `**/infra-contract.d.ts` — none.
- `*.d.ts` shadowing real `.ts` under `src/tests/` — none (the only `.d.ts` in `examples/` are
  legitimate frontend globals: `ecommerce-app-fe/types/global.d.ts`,
  `todo-app-frontend/src/components/blocks/task-list/turtle-master.d.ts` — outside sweep scope).
- `test/` dirs outside `src/tests` — none in either backend app.
- Other `*.js` under `src/tests` — only the kept canonical `jest.config.js` above.

## Out-of-scope observations (not touched — outside lane deletion categories)

- `todo-app-backend/scripts/{probe.mjs,notify-queue-live-check.cjs}`,
  `ecommerce-app-be/scripts/live-proof.mjs` — live under `scripts/`, not `src/tests`.
- `todo-app-backend/dist/**/*.js` — build output, not `src/tests`.
- `.starciwork/**` assets and `*.contract.spec.ts` / `*.contracts.ts` under `src/modules` —
  explicitly off-limits.

## Result

5 files deleted, 1 file created (this report). No files outside lane scope modified. No spec
imports rewired — nothing deleted was referenced.
