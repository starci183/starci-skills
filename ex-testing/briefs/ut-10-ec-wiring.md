# Lane UT-10 — ecommerce module wiring

SCOPE (exclusive): new spec files under `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/ecommerce-app-be/apps/*/test/` (create the dir) — do NOT modify app.module.ts or any source file.

Module-compile smoke specs: `Test.createTestingModule({imports:[AppModule]})` with platform providers overridden by mocks (overrideProvider for DataSource/redis/config) — assert the module compiles and key providers resolve. Plus guard/interceptor wiring specs (APP_GUARD providers, ordering). This is the classic Nest "module boots" test catching DI misconfig.
