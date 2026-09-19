# Lane E2E-09 — resilience + teardown verification (both apps)

SCOPE (exclusive): `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend/test/e2e/resilience/` + `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/ecommerce-app-be/test/e2e/resilience/` (create dirs)

Specs: `teardown-verification.e2e-spec.ts` per app (boot module → note container/volume names → close → assert `docker ps -a`/`volume ls` contain none of them), `infra-recovery.e2e-spec.ts` per app (kill one infra container mid-flow where the api tolerates it → assert recovery path or clean error). These prove the teardown contract E2E-00/E2E-06 implement — write against documented contract, coordinate via interface only.
