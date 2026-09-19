# Lane E2E-04 — todo audit flows

SCOPE (exclusive): `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend/test/e2e/audit/`

Specs: `erasure-journey.e2e-spec.ts` (request-erasure → data anonymized (verify via API + db out-of-band) → complete-erasure → audit lines appended), `export-and-log.e2e-spec.ts` (activity generates audit lines → export-my-data returns them → audit-log query consistent). 
