# Lane UT-01 — todo gql mutations A (session, task, share)

SCOPE (exclusive): `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend/src/features/todo/graphql/mutations/{session,task,share}/`

Write `*.spec.ts` for every resolver in scope (sign-in, sign-out, create/complete/reopen/delete-task, invite, accept-invitation, revoke-collaborator). Convention: `Test.createTestingModule` with the resolver under test as provider + its use-case/service deps mocked via `{provide, useValue}`. Cover: happy path, authz failure (unauthenticated/forbidden), domain error propagation (NotFound/Conflict/BadRequest from use-case), input mapping dto→command. Match the existing spec style in `src/modules/bussiness/`.
