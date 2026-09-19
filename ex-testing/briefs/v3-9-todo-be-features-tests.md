# v3-9 — todo-be: fix src/features/** + src/tests/**

Read `briefs/v3-HEADER.md` first.

APP: `examples/todo-app-backend`  SCOPE: `src/features/**/*.ts`, `src/tests/**/*.ts` ONLY.
GATE: wait for `ex-testing/lint/setup-todo-be.done` (v3-0 lands config+deps first — poll 30s;
meanwhile survey your scope read-only). Do NOT touch eslint.config/package.json/tsconfig.

## Mission — same burn-down method as v3-1:
- `eslint --fix` then hand-fix remaining errors in your two dirs.
- src/tests/** specifics: e2e canon rules are the user's explicit requirements —
  e2e-asserts-persisted-state (assert DB state, not just envelope), no-sleep-in-flow (poll,
  never setTimeout), no-branch-in-flow-step, no-wiring-in-flow-spec — fix the SPECS to comply.
- throw-abstract-exception is OFF for tests already (config carve-out) — if it still fires,
  the glob is wrong: report it, don't suppress.
- require-export-jsdoc: real docs on helpers/clients/specs exports.

Verify: eslint counts drop; `npx jest` (unit specs) green; `npx tsc --noEmit` clean.
Update `ex-testing/lint/debt-todo-be.json` (merge with v3-0's — add your dirs' remaining).
Report: per-rule before/after, files touched.
