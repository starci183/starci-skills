# Lane v5-8 (devin) — post-v4-1 audit + codecov verify + write missing v4-4 report

SCOPE: read-everything audit; write only `.claude/ex-testing/lint/v4-4-REPORT.md`, `.claude/ex-testing/lint/v5-8-REPORT.md`, and codecov workflow fixes under each example app's CI dir if broken. Do NOT touch files other lanes own (`src/tests/infra/**` = v5-1, `packages/{e2e-kit,fe-kit}` = v5-1/v5-2, `packages/{grammar,heroicons}` = v5-3, BE `src/features`+e2e specs = v5-7, todo-fe components/messages = v5-5, ec-fe specs = v5-6).

## Tasks

1. **v4-4 report gap**: the sonar/coverage lane's agent crashed (exit 0xc0000409) before writing its report. Reconstruct `.claude/ex-testing/lint/v4-4-REPORT.md` from `.claude/ex-testing/lint/SONAR-SUMMARY.md` + the v3-6/v3-7 reports already in `lint/` — mark it clearly as reconstructed-by-v5-8.
2. **Stale-ref audit after v4-1** (ec-fe shared-pkg move): grep `examples/ecommerce-app-fe` for references to the deleted `types/` dir and old component paths — `next.config.mjs`, `tsconfig*.json` paths, CSS `@source`/`@import`, `eslint.config.mjs` globs, `sonar-project.properties` sources. Fix any stale refs you find in-place.
3. **Codecov verification**: find the coverage workflow v3-6 added (`example-coverage.yml` or similar under `.github/workflows` or the example apps' CI) — verify flags per app, lcov paths point at each app's real `coverage/lcov.info`, and the workflow references scripts that actually exist. Fix broken references only; do not redesign.
4. **FE canon spot-check**: confirm `route-slot-fixed-name` (canon-fe 3.1.0 in `.claude/packages/eslint/fe`) is in each FE app's active eslint config, and that `apps/shop/src/app/[lang]/page.tsx` exporting `Page` satisfies it. No code change needed.
5. Report findings → `.claude/ex-testing/lint/v5-8-REPORT.md`: stale refs found/fixed, codecov verdict, rule verification.

## Rules

- Read-mostly: only fix genuinely broken references. No new deps, no refactors.
