# VERIFY-REPORT — Lane Q9 verification sweep

Date: 2026-09-19 (~12:00). Scope executed: new `TESTING.md` per app + this report. No source files edited; no git ops.

**Concurrency caveat:** results are a snapshot while R1/R2 (src/tests restructure), Q6 (eslint) and Q8 (coverage script) lanes were actively landing in the same tree — suite counts and lint totals moved during the sweep. Numbers below are the final observed state; re-run after the fleet quiesces.

## Summary

| App | `tsc --noEmit` | `npx jest` | e2e smoke | `npm run lint` |
|---|---|---|---|---|
| todo-app-backend | PASS (0 errors) | PASS — 117/117 suites, 696/696 tests (~32s) | FAIL — keycloak readiness timeout (env/infra, R1-owned) | 300 problems (33 err / 267 warn) — Q6 in flight |
| ecommerce-app-be | PASS (0 errors, after env repair) | PASS — 36/36 suites, 216/216 tests (~17s) | not run (see notes) | 110 problems (18 err / 92 warn) — Q6 in flight |

## todo-app-backend

- **`npx tsc --noEmit`**: clean, 0 errors. Verified twice — before and after R1's `src/tests/infra/**` tree landed.
- **`npx jest`**: 117/117 suites, 696/696 tests, ~32s.
  - First attempt this sweep failed 97/108 suites — all transient environment failures, not code: a concurrent `npm install` was mid-write in the app's `node_modules` (ENOENTs on half-extracted packages such as `escape-string-regexp`), and `graphql`/`graphql-tag` resolution escaped upward into the parent checkout's `node_modules`, which holds a **broken partial install** (`graphql/index.js` present, `version.js`/`package.json` missing). Identical re-run after the install settled: fully green.
  - `[Nest] ERROR ... INVALID_CREDENTIALS / SESSION_NOT_FOUND` lines in output are expected stderr from failure-path specs, not failures.
- **e2e smoke** — `npx jest --config src/tests/e2e/jest.config.ts auth/sign-in`: FAILED at stack boot: `readiness timeout after 240000ms for keycloak:/realms/todo`. Container logs show keycloak still in Quarkus re-augmentation at the deadline — cold-boot cost, not a spec failure. The owning file (`src/tests/infra/platform/stack/e2e-stack.service.ts`) is R1-scope and was being actively written; a second run of the same spec (same compose project hash) was observed starting concurrently — left undisturbed. Docker Desktop 29.5.2 + compose v5.1.4 up; required images cached. Needs re-verification once R1 lands and keycloak warm-boots.
- **Leftover**: `src/tests/e2e/infra/*` (v1 infra files) still present alongside the new `src/tests/infra/*` tree at check time — R1 cleanup presumably pending.

## ecommerce-app-be

- **`npx tsc --noEmit`**: initially FAILED — 98 × `TS2339: Property 'get'/'close' does not exist on type 'TestingModule'` across all TestingModule specs.
  - **Root cause (manifest gap, outside Q9 fix scope):** `@nestjs/testing` is declared in no `package.json` of this app — not root devDependencies, not `apps/*/dependencies`. Resolution escaped upward into the parent checkout's `@nestjs/testing@11.1.19`, whose `@nestjs/common` peer is itself a broken install (no `package.json`), so `TestingModule`'s base class `NestApplicationContext` could not be resolved and its inherited members disappeared from the type.
  - **Environment repair (no tracked files touched):** `npm install --no-save "@nestjs/testing@^10.4.4"` — matches the app's `@nestjs/*@10` line. After repair: `tsc --noEmit` clean, re-verified clean at end of sweep.
  - Side note: the `--no-save` install pruned 88 extraneous packages; nothing needed broke (jest + tsc green after). A normal `npm install` should re-run once the manifest is fixed (follow-up 1).
- **`npx jest`**: 36/36 suites, 216/216 tests, ~17s.
  - Mid-sweep this was 34/35: `src/tests/order/app-module.boot.spec.ts` failed with `Nest could not find AppConfigService element` — the spec imported `AppConfigService` from `config/identity` while `apps/order/src/app.module.ts` registers the `config/order` flavor (different provider token). R2-owned file, reported not fixed; **R2 fixed it during the sweep** — final run fully green.
- **e2e**: not executed — same Docker cost class as todo plus R2 actively rewriting `src/tests/**` underneath; commands and architecture documented in `TESTING.md`.
- **Coverage**: `npm run test:coverage` produces `coverage/lcov.info` (reporters: text, lcov, json-summary).

## Follow-ups required (outside Q9 scope)

1. **ec manifest owner**: add `"@nestjs/testing": "^10.4.4"` to `ecommerce-app-be` devDependencies + normal `npm install`. The current green depends on a non-saved `node_modules` repair that `npm ci` will wipe; every TestingModule spec in the app is unrunnable without it.
2. **R1**: delete superseded `src/tests/e2e/infra/*`; re-run e2e. Keycloak cold-boot exceeded the 240s readiness budget (Quarkus augmentation) — consider raising `E2E_BOOT_TIMEOUT_MS` for cold environments.
3. **Q6**: lint still red in both apps at check time (todo 33 err, ec 18 err); several errors sit inside `src/tests/**` (R1/R2 files) — coordinate.
4. **Fleet**: parent checkout `node_modules` contains broken partial installs (`graphql`, `@nestjs/common` — files without package.json). Harmless once example apps carry their own deps, but any upward resolution escape will hit it again.

## Files created by this lane

- `examples/todo-app-backend/TESTING.md`
- `examples/ecommerce-app-be/TESTING.md`
- `ex-testing/VERIFY-REPORT.md` (this file)
