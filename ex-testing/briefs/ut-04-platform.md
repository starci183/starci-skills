# Lane UT-04 — todo platform modules

SCOPE (exclusive): `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend/src/modules/platform/`

Spec coverage for databases (typeorm/data-source providers, transaction helpers), caches (redis), config (validation/fail-fast), keycloak/http-client, events gap-fill. Mock external drivers (ioredis, pg, axios) at boundary; test retry/error paths, config validation failures, provider factories via TestingModule with `useFactory` overrides.
