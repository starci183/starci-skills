# Lane v5-6 (qwen) — give ec-fe a real unit suite so coverage isn't 0%

SCOPE (exclusive): `examples/ecommerce-app-fe` — spec files + `package.json`/`vitest.config`/`tsconfig`/`sonar-project.properties` changes needed for the suite. Do NOT touch `packages/shared/src/theme/**` or `packages/shared/src/i18n/**` (v5-2 is moving those — write specs ONLY for stable surfaces: `CatalogueTile`, `StateBlock`, `DuckMascot`, and components under `apps/landing` + `apps/shop`). Do NOT touch other repos.

## Context
`ecommerce-app-fe` has zero unit tests → Sonar coverage 0.0%. todo-fe already has a vitest setup — mirror its harness (`vitest.config`, test setup, jsdom/happy-dom choice, `@testing-library/react` if todo-fe uses it). Grammar components come from `@starci/grammar` (published) — mount real components, don't snapshot-test implementation trivia.

## Tasks
1. Add vitest harness to the monorepo root (reuse todo-fe's devDep versions — check its package.json first; do NOT add different versions of the same libs).
2. Write meaningful specs for the stable surfaces above: render states (`isLoading`, `state` union values), props-driven output, action callbacks via `on` handlers. Business behavior, not snapshot noise.
3. Wire coverage: `vitest run --coverage` → `coverage/lcov.info` at repo root; update `sonar-project.properties` `sonar.javascript.lcov.reportPaths` + ensure `tests=`/`exclusions=` match.
4. Gates: `npm run test` (or vitest script) green; `npx eslint` clean on new files (canon-fe: specs live beside their twin, `*.spec.tsx`, English only); `npx tsc --noEmit` clean; both `npm run build` (landing + shop) still green.
5. Report → `.claude/ex-testing/lint/v5-6-REPORT.md` with the coverage number achieved.

## Rules
- No next-themes, no new runtime deps. English only. If v5-2 moves a file you spec'd mid-flight, follow the move rather than blocking.
