# v3-0 — todo-be: canon setup + fix src/modules/**
Read `briefs/v3-HEADER.md` first.

APP: `examples/todo-app-backend`  SCOPE: its `eslint.config.mjs`, `plugins/**`, `package.json`,
`package-lock.json`, `tsconfig.json`, `jest.config*`, `src/modules/**/*.ts`, `ex-testing/lint/**`

## Mission
1. devDeps: `eslint@^9 typescript-eslint@^8 globals @starci/eslint-canon-be@^1.2.1 tsconfig-paths@^4.2.0`
   (+ `@nestjs/testing` if absent — q9 flagged manifest gaps).
2. Vendor `plugins/eslint/` (host's UPDATED copy — has lang exemption) → app's `plugins/eslint/`.
3. Write `eslint.config.mjs` — MIRROR `examples/ecommerce-app-be/eslint.config.mjs` exactly
   (same blocks: stylistic, no-restricted-syntax w/ spec+src/tests carve-outs, canon+local merge,
   module-boundary globs, spec throw-abstract off, lang-file exemption block). This app has
   GraphQL — `src/tests/` also has e2e specs; same carve-outs apply.
   Retarget any path-bound bits to THIS app's layout (check for a parse-env/config file first —
   if it exists keep it as the only allowed process.env reader).
4. tsconfig `paths` (@modules/@features/@tests → src/*) + jest `moduleNameMapper` in BOTH
   jest configs (root + `src/tests/e2e/jest.config*`) + `tsconfig-paths/register` in start
   scripts AND wherever the e2e stack spawns the api (check `src/tests/infra/platform/stack/`).
5. `eslint --fix` on your scope, then import-convention pass: cross-capability relative imports
   → aliases (resolve each `../`-import to absolute; if it lands under src/{modules,features,tests}
   in a DIFFERENT first-segment capability than the file's own → alias; same capability → keep
   relative — `no-self-module-alias` polices this). Verify with eslint.
6. Hand-fix remaining errors in `src/modules/**` only: require-export-jsdoc (real docs),
   throw-abstract-exception (app needs an AbstractException hierarchy if none — check
   src/modules for existing exception base first), unused vars, etc.
7. `npx tsc --noEmit` clean + `npx jest src/modules` green.
8. Write `ex-testing/lint/debt-todo-be.json` (per-rule counts, whole app) +
   `ex-testing/lint/setup-todo-be.done` marker. v3-9 waits on this marker.
Report: devDeps added, per-rule fixed/remaining, files touched.
