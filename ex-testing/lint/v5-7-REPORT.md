# v5-7 — GraphQL error-code contract alignment

## Contract decision

Wire code = the stable business code **without** the `_EXCEPTION` transport suffix.
Exception classes keep the suffix internally (`InvalidCredentialsException.code === "INVALID_CREDENTIALS_EXCEPTION"`);
GraphQL `extensions.code` and REST `body.code` emit `INVALID_CREDENTIALS`.

Evidence for the documented convention:

- `examples/todo-app-backend/scripts/live-proof.sh` exact-matches `INVALID_CREDENTIALS`,
  `SESSION_NOT_FOUND`, `TASK_FORBIDDEN`, `SESSION_EXPIRED` (no suffix).
- Committed pre-rename REST doors in ec-be emitted `SESSION_INVALID`, `INVALID_CREDENTIALS`,
  `EMAIL_TAKEN` on the wire.
- `ecommerce-app-be/src/tests/e2e/order-lifecycle/lifecycle.helpers.ts` documents `401 SESSION_INVALID`.
- `ecommerce-app-be/src/features/identity/graphql/mutations/session/register/register.resolver.ts`
  documented `EMAIL_TAKEN` (already correct).

## Premise correction (found during execution)

The brief assumed todo-be already strips. It did **not**: at HEAD of the working tree,
`todo-app-backend/src/features/todo/graphql/graphql.module.ts` emitted `original.code` verbatim,
and todo e2e + `app.boot.spec.ts` asserted `*_EXCEPTION` wire codes. The e180ccfe exception-class
rename had leaked the suffix onto the wire in **both** apps. Both were corrected to the documented
stripped convention rather than only ec-be.

## Files changed

### todo-app-backend

- `src/features/todo/graphql/graphql.module.ts` — `formatError` now emits
  `code: original.code.replace(/_EXCEPTION$/, "")`; docstring updated to state the wire contract.
- `src/tests/e2e/auth/sign-in.e2e-spec.ts` — `INVALID_CREDENTIALS` x3; also fixed a **pre-existing**
  project-name assertion `{12}` → `{8}` (see "Pre-existing e2e defect" below).
- `src/tests/e2e/plan/plan-journey.e2e-spec.ts` — `PLAN_CAP_EXCEEDED`.
- `src/tests/e2e/session/session-expiry.e2e-spec.ts` — `SESSION_EXPIRED`, `SESSION_NOT_FOUND`.
- `src/tests/e2e/session/sign-out.e2e-spec.ts` — `SESSION_NOT_FOUND`.
- `src/tests/e2e/share/share-journey.e2e-spec.ts` — stripped share/session codes.
- `src/tests/e2e/task/task-isolation.e2e-spec.ts` — `TASK_FORBIDDEN`.
- `src/tests/e2e/task/task-lifecycle.e2e-spec.ts` — `SESSION_NOT_FOUND`.
- `src/app.boot.spec.ts` — `INVALID_CREDENTIALS`, `SESSION_NOT_FOUND`.
  **Outside the brief's named scope** (`features/**` + `tests/e2e/**`), changed because it asserts
  the GraphQL wire contract directly and the `npx jest` gate cannot pass otherwise. Assertions kept
  strict — only the expected code changed.

### ecommerce-app-be

- `src/features/identity/graphql/graphql.module.ts` — same `replace(/_EXCEPTION$/, "")` on
  `extensions.code`; metadata spread preserved.
- `src/features/checkout/graphql/graphql.module.ts` — same strip; `CHECKOUT_REFUSAL` metadata
  (`reason`, `productId`, `requested`, `available`) preserved.
- `src/features/identity/graphql/mutations/session/register/register.resolver.ts` — docstring
  reworded ("full `*_EXCEPTION` code" → business code).
- `src/features/identity/transport/http/business-code.filter.ts` — **new** feature-local
  `ExceptionFilter` that strips `_EXCEPTION` from `AbstractException` HTTP bodies while preserving
  status, message and other metadata.
- `src/features/identity/transport/http/session.controller.ts` — `@UseFilters(BusinessCodeExceptionFilter)`
  on `internal/sessions`; docstring states REST/GraphQL emit the same stripped code.
- `src/tests/e2e/identity/sign-up-sign-in.e2e-spec.ts` — `EMAIL_TAKEN`, `INVALID_CREDENTIALS`
  (GraphQL) and `SESSION_INVALID` (REST `body.code`); docstring updated.
- `src/tests/e2e/checkout/checkout-journey.e2e-spec.ts` — stripped codes.
- `src/tests/e2e/checkout/payment-failure.e2e-spec.ts` — `CHECKOUT_REFUSAL` + metadata assertions.
- `src/tests/e2e/order-lifecycle/cross-service-identity.e2e-spec.ts` — `SESSION_INVALID` on REST.
- `src/tests/e2e/order-lifecycle/order-history.e2e-spec.ts` — stripped codes; docstring updated.

### Deliberately untouched

- All unit `*.resolver.spec.ts` / `session.guard.spec.ts` / `session.controller.spec.ts`
  assertions of `code: "*_EXCEPTION"` — these assert the **exception object's internal code**
  (thrown or inspected pre-format), not wire output. Correct to keep suffixed.
- `src/tests/infra/**`, `src/modules/**`, `packages/`, FE — untouched per brief.
- `ec-be` `apps/` mid-refactor area — untouched.

## Gates

### todo-app-backend

| Gate | Result |
|---|---|
| `npx eslint src` | 0 errors |
| `npx tsc --noEmit` | clean |
| `npx jest` | 117 suites / 701 tests pass |

E2E (`npx jest --config src/tests/e2e/jest.config.ts`, docker stack, world auto-rebuilds `dist`):

| Spec | Result |
|---|---|
| auth/sign-in | pass (after `{12}`→`{8}` fix, rerun green) |
| plan/plan-journey | pass |
| session/session-expiry | pass |
| session/sign-out | pass |
| share/share-journey | pass |
| task/task-isolation | pass |
| task/task-lifecycle | pass |

### ecommerce-app-be

| Gate | Result |
|---|---|
| `npx eslint src` | 0 errors |
| `npx tsc --noEmit` | clean |
| `npx jest` | 39 suites / 209 tests pass |
| `npm run build` | exit 0 (needed — see below) |

E2E (`npx jest --config src/tests/e2e/jest.config.js`, docker compose + spawned services from `dist`):

| Spec | Result |
|---|---|
| identity/sign-up-sign-in | pass — GraphQL `EMAIL_TAKEN`/`INVALID_CREDENTIALS`, REST `SESSION_INVALID` |
| order-lifecycle/cross-service-identity | pass |
| order-lifecycle/order-history | pass |
| checkout/checkout-journey | pass |
| checkout/payment-failure | pass |

## REST parity

- ec-be `/internal/sessions/*` now emits the same stripped business code as GraphQL
  (`SESSION_INVALID`, `REQUEST_INVALID`) via `BusinessCodeExceptionFilter`. Verified live by
  `sign-up-sign-in` (`afterRevoke.body.code === "SESSION_INVALID"`) and `cross-service-identity`.
- todo-be's coded error surface is GraphQL-only (exceptions are `Error`-based, no coded REST doors);
  its live-proof asserts stripped codes on the public door. Parity holds: where a code crosses the
  wire in either app, it is the stripped business code on both transports.

## Incidents / honest notes

1. **Stale `dist/` e2e false-failure (ec-be).** First run of `sign-up-sign-in` failed with
   `Expected "EMAIL_TAKEN", received "EMAIL_TAKEN_EXCEPTION"`. Cause: `ensureBuilt` skips the build
   when `dist` exists, so the stack ran pre-change compiled JS. Fixed with `npm run build`;
   verified `dist/.../graphql.module.js` and `business-code.filter.js` contain the strip; rerun green.
   The wrapper's `E2E_EXIT=0` echo was misleading — the real verdict is Jest's PASS/FAIL lines.
2. **Pre-existing e2e defect (todo-be).** `auth/sign-in` asserted
   `stack.project` matches `todo-e2e-[0-9a-f]{12}`, but `specHash()` (`packages/e2e-kit`,
   `slice(0,8)`) yields 8 hex chars — the spec could never have passed in this form. Both the spec
   and infra are uncommitted v5-1-era files; `packages/` and `tests/infra/` are out of scope, so the
   in-scope spec assertion was corrected to `{8}`. Unrelated to error codes (it fires before the
   first `errorCode` assertion); flagged here for the infra owner.
3. **`app.boot.spec.ts` (todo-be) is outside the brief's named paths** but asserts the wire contract;
   updated to stripped codes so the Jest gate reflects the contract. No assertion weakened.
