# Common rules — refactor fleet v2

Working dir: `D:/Repositories/starci-academy-backend/.claude` (own git repo; examples at `examples/`).

## Hard rules
- SCOPE LOCK: create/modify files ONLY inside your lane scope. Out-of-scope edits = mission failure.
- No git ops (add/commit/checkout/stash/branch). No `package.json`/`tsconfig` edits unless scope says so (deps already installed: axios, @apollo/client, graphql in todo; axios in ec).
- TestingModule convention everywhere: `Test.createTestingModule`, `moduleRef.get`. No bare `new X(deps)`.
- Read `ex-testing/ANALYSIS.md` for context; layout target below.

## Target test-infra layout (both apps) — the whole point of v2
`src/tests/` mirrors `src/modules` layering — real Nest modules, not loose files:

    src/tests/
      infra/                        <- spec-facing surface (imports stay `../infra/...`)
        testing-infra.module.ts     TestingInfraModule.register({context, specId}) imports sub-modules
        index.ts                    barrel re-exporting the public services
        platform/
          stack/stack.module.ts + e2e-stack.service.ts   (compose/docker/ports/api spawn + teardown report)
          databases/database.module.ts + e2e-db.service.ts (DataSource out-of-band verify)
        integrations/
          http/http.module.ts + e2e-http.service.ts      (axios.create per service/user, bearer option)
          graphql/graphql.module.ts + e2e-graphql.service.ts (todo only: ApolloClient per user)
        bussiness/
          accounts/accounts.module.ts + e2e-auth.service.ts (register/signIn/revoke/deleteAccount)
      e2e/                          <- journeys only (describe -> it A->Z)

- Existing `src/tests/e2e/infra/*` files MOVE into this tree; `infra/index.ts` keeps old spec imports working (`../infra/e2e-http.service` can remain a thin re-export or specs update imports — lane's call, keep it consistent).
- HTTP = axios (installed). Todo also gets an ApolloClient wrapper for its GraphQL doors.
- Report at end: files created/moved, spec rewires, `npx jest`/`tsc --noEmit` scoped results.
