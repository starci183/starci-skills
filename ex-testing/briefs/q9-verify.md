# Lane Q9 (qwen) — verification sweep + TESTING docs

SCOPE (exclusive): NEW `TESTING.md` in each app root + `ex-testing/VERIFY-REPORT.md`. Small FIXES allowed ONLY in `src/modules/**`/`src/features/**` of each app (R1/R2 own `src/tests` — if a breakage is there, report it, don't fix).

Per app: document how to run unit (`npx jest`), e2e (`npm run test:e2e`), coverage, lint. Run `npx tsc --noEmit` + `npx jest` per app; record results in VERIFY-REPORT; fix trivial breakages inside your scope only.
