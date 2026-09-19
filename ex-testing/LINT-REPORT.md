# LINT-REPORT — Lane Q6 (eslint setup + report)

Date: 2026-09-19
Apps: `examples/todo-app-backend`, `examples/ecommerce-app-be`

## Toolchain

- ESLint **9.39.5** (flat config, `eslint.config.mjs`), **typescript-eslint 8.70.0**, **globals 17.12.0**.
- Ruleset: `eslint.configs.recommended` + `tseslint.configs.recommendedTypeChecked` (type-aware via `projectService`), node+jest globals — the standard Nest-scaffold shape, minus prettier (not installed).
- `unsafe-*` rules downgraded to `warn` (large existing `any` surface, esp. jest mocks / `moduleRef.get`); `no-unused-vars` errors except `^_` names; `require-await`/`unbound-method`/`no-floating-promises` warn.
- Scripts added per app: `lint`, `lint:fix` (`eslint "src/**/*.ts"`; ec also `"apps/**/*.ts"`).
- `.eslintignore` files written for legacy tooling/IDEs; ESLint 9 ignores them (prints a benign `ESLintIgnoreWarning`) — real ignores live in `eslint.config.mjs`.

**Caveat — deps not saved.** Scope allowed `package.json` script edits only, so the toolchain was installed with `npm install --no-save` (devDependencies untouched). `npm run lint` works in this checkout but a fresh `npm install` / `npm ci` will prune eslint. To make lint reproducible, add to each app's devDependencies: `eslint@^9`, `typescript-eslint@^8`, `globals`.

## Results

| App | Files linted | Errors | Warnings |
|---|---|---|---|
| todo-app-backend | ~506 | **32** | ~267 |
| ecommerce-app-be | 127 | **18** | **92** |

`npm run lint` exits 1 in both apps — expected: remaining errors sit outside `src/features/**` (lane may not fix them). Counts drifted ±a few while other lanes landed files concurrently.

**Incident note.** `--no-save` installs prune each other: this lane's first ec install removed the ut-lane's unsaved `@nestjs/testing` (breaking spec typecheck: `moduleRef.get` → error type, +229 phantom `unsafe-*` warnings). Restored via a single combined `npm install --no-save eslint@9 typescript-eslint@8 globals @nestjs/testing@10.4.4`. Warning counts above are post-restore. Same fragility applies fleet-wide: **unsaved deps are not durable** — whoever finalizes the apps should add `@nestjs/testing@^10.4.4` (ec) and the eslint trio (both) to devDependencies.

## Fixes applied (only inside `src/features/**`)

- `ec/src/features/checkout/transport/http/cart.controller.spec.ts` — removed unused `SessionGuard` import (no-unused-vars).
- `ec/src/features/checkout/transport/http/order.controller.spec.ts` — same.
- todo `src/features/**`: **zero errors**; only warnings (jest `mock.calls` `any` access — left, not a straightforward fix).

## Top issues

**todo-app-backend** (errors → rule):

| Rule | Count |
|---|---|
| `no-unnecessary-type-assertion` | 10 |
| `no-unused-vars` | 8 |
| `no-base-to-string` | 5 |
| `no-require-imports` | 4 |
| `restrict-template-expressions` | 3 |
| `no-redundant-type-constituents` | 2 |

Warnings (top): `no-unsafe-member-access` 101, `require-await` 66, `no-unsafe-assignment` 54, `no-unsafe-argument` 39, `no-unsafe-call` 10.

**ecommerce-app-be** (errors → rule):

| Rule | Count |
|---|---|
| `no-base-to-string` | 4 |
| `no-unsafe-function-type` | 4 |
| `no-unnecessary-type-assertion` | 3 |
| `no-unused-vars` | 2 |
| `restrict-template-expressions` | 2 |
| `no-require-imports` | 2 |
| `restrict-plus-operands` | 1 |

Warnings (top, post-restore): `no-unsafe-member-access` 32, `no-unsafe-assignment` 24, `require-await` 18, `no-unsafe-call` 10 — mostly jest `mock.calls` `any` access in specs.

## Unfixed errors (outside fix scope — owners should pick up)

### todo-app-backend

- `src/modules/bussiness/audit/audit-operator-role.guard.ts` — unused `Injectable` import.
- `src/modules/bussiness/notify/notify.service.ts:131` — `taskId ?? ''` stringifies `[object Object]` (likely real bug: payload typed wider than assumed).
- `src/modules/bussiness/notify/testing/fake-notify-entity-manager.ts:53` — `unknown` in template literal ×2.
- `src/modules/bussiness/plan/{payment,subscription}.service.ts` — unnecessary type assertions.
- `src/modules/integrations/integrations.modules-edge.spec.ts` — unused `NotifyQueuePort` import.
- `src/modules/integrations/keycloak/keycloak.client.spec.ts:41,142`, `sepay/sepay.client.spec.ts:108` — possible `[object Object]` stringification of `init?.body` / fetch arg (assert intent with `JSON.stringify`).
- `src/modules/platform/databases/postgresql/primary/{primary.module.spec.ts,testing/fake-entity-manager.ts}` — unnecessary assertions.
- `src/tests/e2e/**` + `src/tests/infra/**` (r-lane infra, duplicated old+new trees) — unnecessary assertions ×7, unused destructure args `pgUser/pgPassword/pgDb` ×6, `require()` imports ×4 in `resilience/e2e-infra-contract.ts`, `no-base-to-string` on `'last'`, redundant union constituent ×2.
- Note: `src/tests/e2e/infra/**` and `src/tests/infra/**` both exist (v2 move in-flight) — same issues flagged in both copies; old tree likely gets deleted by q10-cleanup.

### ecommerce-app-be

- `src/modules/bussiness/payment/payment.service.spec.ts` — unused `Repository` import.
- `src/modules/integrations/identity/identity.client.spec.ts:25` — `restrict-plus-operands` on mixed-type `+`.
- `src/modules/platform/caches/redis/primary/redis.client.ts:22` — template literal on `never` (dead/error-path code — inspect).
- `src/modules/platform/config/{identity,order}/app-config.service.ts` — `(parsed as {project?: unknown}).project ?? ''` stringifies object (config parse fallback bug candidate).
- `src/modules/platform/databases/postgresql/order/entities/entities.spec.ts` — `Function` type ×4.
- `src/modules/platform/databases/postgresql/{identity,order}/primary.module.spec.ts` — unnecessary assertions.
- `src/tests/e2e/identity/sign-up-sign-in.e2e-spec.ts:24` — unused `auth`.
- `src/tests/e2e/resilience/e2e-infra-contract.ts` — `require()` ×2, `no-base-to-string` + `restrict-template-expressions` on `'last'`.
- `src/tests/infra/platform/{databases/e2e-db.service.ts,stack/e2e-stack.service.ts}` — unnecessary assertion, `no-base-to-string` on `record.Health`.

## Files created/modified by this lane

- `examples/todo-app-backend/eslint.config.mjs`, `.eslintignore` (new)
- `examples/ecommerce-app-be/eslint.config.mjs`, `.eslintignore` (new)
- `examples/*/package.json` — `lint` + `lint:fix` scripts only
- `examples/ecommerce-app-be/src/features/checkout/transport/http/{cart,order}.controller.spec.ts` — unused-import fixes
- `ex-testing/LINT-REPORT.md` (this file)
