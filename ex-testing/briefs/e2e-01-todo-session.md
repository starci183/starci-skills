# Lane E2E-01 — todo session flows

SCOPE (exclusive): `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend/test/e2e/session/`

Specs: `sign-out.e2e-spec.ts`, `session-expiry.e2e-spec.ts` (or token-refresh journey — pick what the api supports). Each = ONE `it` covering the complete journey via E2EHttpService/E2EAuthService from TestingInfraModule (API contract in ANALYSIS.md §5 — code against it; if E2E-00 hasn't landed, create `../infra/testing-infra.module.d.ts` stub matching the documented signatures, never implement infra yourself). Real stack per spec. Teardown asserted.
