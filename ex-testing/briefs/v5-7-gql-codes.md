# Lane v5-7 (devin) — align GraphQL error-code contract across both BE apps

SCOPE (exclusive): `examples/todo-app-backend/src/features/**` + `src/tests/e2e/**` spec files, `examples/ecommerce-app-be/src/features/**` + `src/tests/e2e/**` spec files. Do NOT touch `src/tests/infra/**` (v5-1 owns), `src/modules/**`, FE, or `packages/`.

## Context
Contract drift: todo-be's GraphQL `formatError` STRIPS the `_EXCEPTION` suffix (`INVALID_CREDENTIALS`), ec-be's asserts the FULL code (`INVALID_CREDENTIALS_EXCEPTION`). Todo's API doc + REST parity expect no suffix. Pick ONE convention and align both apps — the documented convention wins: wire code = the stable business code WITHOUT the `_EXCEPTION` transport-suffix (exception class codes keep the suffix internally).

## Tasks
1. Find ec-be's GraphQL error formatter and make it emit the same stripped code todo emits (mirror todo-be's `formatError` implementation).
2. Update ec-be e2e specs + any unit specs that assert `*_EXCEPTION` wire codes → assert stripped codes. Also align its API docs if they document codes.
3. Re-verify todo-be still strips correctly (it does — just confirm no drift).
4. Confirm REST error codes stay identical in both apps (parity between transports is the contract).
5. Gates per app: `npx eslint src` → 0; `npx tsc --noEmit` → clean; `npx jest` → green; e2e spec files you touched must still pass (run at least the affected e2e specs — docker stack — or if infra is mid-refactor by v5-1, run unit specs + note the e2e limitation honestly).
6. Report → `.claude/ex-testing/lint/v5-7-REPORT.md`.

## Rules
- Fix in owning source; don't weaken assertions — changing expected codes is the CONTRACT change, keep assertions strict.
