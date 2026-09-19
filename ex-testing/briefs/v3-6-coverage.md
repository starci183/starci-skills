# v3-6 — coverage: lcov for all 4 apps + codecov wiring
Read `briefs/v3-HEADER.md` first.
SCOPE: `**/jest.config*`, `**/package.json` (coverage scripts/devDeps ONLY — eslint deps belong
to lint lanes; if a manifest already has open edits, add ONLY your lines), `ex-testing/lint/**`,
`.github/**` if a coverage workflow is needed (READ existing `.github/workflows/` first).
Prior art: `ex-testing/COVERAGE-REPORT.md` (q8's work — read it first).

## Mission
1. For each app (todo-app-backend, ecommerce-app-be, todo-app-frontend, ecommerce-app-fe):
   ensure `jest --coverage` produces `coverage/lcov.info` with `collectCoverageFrom` covering
   real sources and excluding specs/tests/infra/main.ts (ec-be already has this — verify).
   FE apps may have NO jest — check; if absent, add minimal jest+ts-jest/next-jest setup ONLY
   if the app already has specs; otherwise record "no unit suite" honestly, don't invent tests.
2. Run coverage per app; record real numbers to `ex-testing/lint/coverage-<app>.json`
   {lines, functions, branches, statements} + `ex-testing/lint/COVERAGE-SUMMARY.md` table.
3. Codecov: root workflow uses codecov-action@v5 OIDC for the MAIN repo. Check whether a
   workflow/config should cover the example apps (flags per app? separate uploads?) —
   propose the minimal change; if adding a workflow, keep it additive (new file, no edits
   to existing workflows).
4. NO git ops; write the workflow file but do not commit.
Report: per-app coverage %, lcov paths, codecov wiring added/proposed, blockers.
