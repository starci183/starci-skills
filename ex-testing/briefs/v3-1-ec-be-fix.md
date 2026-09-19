# v3-1 — ec-be: burn remaining lint debt
Read `briefs/v3-HEADER.md` first.

APP: `examples/ecommerce-app-be` — canon ALREADY wired (config, vendored plugin, aliases,
tsconfig-paths, jest mappers all done; 251 errors remain at last measure).
SCOPE: `examples/ecommerce-app-be/src/**/*.ts`, `examples/ecommerce-app-be/apps/**/*.ts`,
`ex-testing/lint/**`. Do NOT touch eslint.config.mjs / package.json / tsconfig (settled).

## Remaining debt (ec-lint.json, 2026-09-19)
- require-export-jsdoc ×108 (61f) — write REAL doc comments on flagged exports.
- throw-abstract-exception ×31 (11f) — app lacks AbstractException base? Check
  src/modules/**/errors or exceptions first; if none, create the minimal hierarchy the
  rule expects (look at the rule's tests in `.claude/packages/be/exceptions.test.mjs` and
  how starci-academy-backend structures exceptions) then route throws through it.
- must-deep-module-import ×21 — imports must reach the deep file, not a barrel.
- no-folder-reexport ×16 — index.ts barrels that just re-export; fix import sites to deep
  paths and delete the barrel.
- no-non-global-module-import ×11 (2f) — module boundary; restructure imports.
- no-restricted-syntax ×10 (2f) — process.env reads outside allowed files → route through
  the app's config service.
- e2e-asserts-persisted-state ×7 — e2e specs must assert persisted state, not just the
  response envelope (user's explicit requirement — fix the SPEC).
- rest-door-needs-a-reason ×6 — REST endpoints need documented justification or conversion.
- misc: unused-vars ×5, no-injected-repository ×3, no-self-global-module ×3,
  unit-test-colocated ×3, e2e contract files using require() ×2, no-console ×2, others.
RULE: fix the code, never the rule. If a rule seems wrong for this codebase, list it in the
report — do NOT suppress inline.
Verify: `npx eslint` counts drop per-rule; `npx tsc --noEmit` clean; `npx jest` FULL suite green
(216 tests baseline — must stay green). Update `ex-testing/lint/debt-ec-be.json` with remaining.
Report: per-rule before/after, files touched, false-positive candidates.
