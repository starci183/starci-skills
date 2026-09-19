# Lane E2E-08 — ecommerce order lifecycle + cross-service

SCOPE (exclusive): `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/ecommerce-app-be/test/e2e/order-lifecycle/`

Specs: `order-history.e2e-spec.ts` (multiple orders → list → detail → status transitions), `cross-service-identity.e2e-spec.ts` (identity token revoked/expired mid-journey → order api rejects → re-auth → resume). Tests the identity↔order service boundary for real.
