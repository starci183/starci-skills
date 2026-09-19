# Lane E2E-00 — todo TestingInfraModule + exemplar spec (CRITICAL PATH)

SCOPE (exclusive): `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend/test/e2e/` — you OWN this whole dir (may delete/port old js lib files into TS under `infra/`; keep `stack/compose.e2e.yaml` assets). Also `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend/package.json` (scripts only: add `test:e2e`) and `test/e2e/jest.config.ts`.

Build the contract all other e2e lanes code against — full TypeScript NestJS:
- `infra/testing-infra.module.ts`: `TestingInfraModule.register({context})` dynamic module.
- `infra/e2e-stack.service.ts`: `onModuleInit` → compose project run-scoped (name = hash of spec path), dynamic ports, wait-for-readiness, spawn api child; `onApplicationShutdown` → `down -v` + assert containers/volumes gone. Port the existing `lib/stack.js` logic — it already does alloc/probe/spawn; reimplement in TS, delete the .js.
- `infra/e2e-http.service.ts`, `e2e-auth.service.ts`, `e2e-db.service.ts`: axios-per-user, account create/delete, DataSource for out-of-band seed/verify.
- `jest.config.ts`: ts-jest, `**/*.e2e-spec.ts`, timeout 120s, maxWorkers 1 initially.
- Exemplar spec `auth/sign-in.e2e-spec.ts` proving the pattern end-to-end (full journey, `afterAll(moduleRef.close())`).
- Old `run.js`/registry/publish-journal: keep files (trò decides removal later) but they are NOT the execution path — jest runs specs directly.
Other flow lanes write specs against your service APIs — keep signatures exactly as documented in ANALYSIS.md §5.
