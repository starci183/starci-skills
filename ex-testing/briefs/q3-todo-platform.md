# Lane Q3 (qwen) — todo platform unit edge-fill

SCOPE (exclusive): `examples/todo-app-backend/src/modules/platform/**` (spec files next to sources only; no src/tests, no features).

Fill remaining unit gaps with TestingModule specs: config validation failure paths, keycloak/http-client error mapping, cache client retry/disconnect, database client/transaction edge cases, event subscriber error paths. Read existing specs first — extend in place, don't duplicate.
