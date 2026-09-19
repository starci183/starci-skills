# Lane R1 (devin) — todo: tests/infra module tree + axios + apollo + spec rewire

SCOPE (exclusive): `examples/todo-app-backend/src/tests/**` (the whole dir: e2e specs + infra + jest.config.ts). Do NOT touch `src/modules`, `src/features`, `package.json`, root `jest.config.js`, `tsconfig*`.

1. Restructure `src/tests/e2e/infra/` into the module tree from _common-v2 (platform/stack, platform/databases, integrations/http, integrations/graphql, bussiness/accounts). Move, don't rewrite from scratch — the existing logic (compose lifecycle, port alloc, api spawn, teardown verification) is good, it just needs proper Nest module packaging.
2. `integrations/http`: E2EHttpService backed by `axios.create` (per-service baseURL, bearerToken option, get/post/put/patch/delete, `.data` response field).
3. `integrations/graphql`: E2EGraphqlService wrapping `ApolloClient` (uri from stack, bearer per client, `query`/`mutate` with DocumentNode — the app's public surface is GraphQL; specs should hit doors through it where the flow is GraphQL).
4. `bussiness/accounts`: E2EAuthService (register/signIn/revokeSession/deleteAccount via public doors).
5. Keep `TestingInfraModule.register({context, specId})` + teardown verification; re-export TestContext/options from module.
6. Rewire ALL specs under `src/tests/e2e/**` to the new API (specs keep their A→Z journey structure — fix imports/calls only where the surface changed; prefer `../infra/index` barrel for service imports).
7. Verify: `npx tsc --noEmit` clean for src/tests; `npx jest --config src/tests/e2e/jest.config.ts` — docker must be up; if a spec fails for environment reasons, report honestly, don't weaken assertions.
