# v3-2 — todo-fe: canon-fe setup + fix
Read `briefs/v3-HEADER.md` first.

APP: `examples/todo-app-frontend` (Next.js single-app: src/{app,components,features,hooks,modules})
SCOPE: its `eslint.config.mjs`, `package.json`, `package-lock.json`, `src/**`, `ex-testing/lint/**`
NOTE: v3-4 works in THIS SAME APP on i18n/theme (touches src/app structure + new src/messages).
Stay out of `src/i18n/**`, `src/messages/**`, `src/modules/theme/**` — those are v3-4's; lint
them only after v3-4 writes `ex-testing/lint/i18n-todo-fe.done`.

## Mission
1. devDeps: `eslint@^9 typescript-eslint@^8 globals @starci/eslint-canon-fe@^3.0.2` + canon-fe
   peers (`npm view @starci/eslint-canon-fe peerDependencies`: eslint-plugin-react/-hooks/jsx-a11y
   as needed).
2. `eslint.config.mjs` mirroring `D:/Repositories/starci-academy-fe/eslint.config.mjs`:
   `starciFeConfig({layout:"single-app", plugin, recommended, linterOptions})`, same stylistic
   block (indent 4, double quotes, no semi, array-type generic), jsx-a11y rule list verbatim,
   ignores (.next/node_modules/dist/coverage/next-env.d.ts), storybook block only if stories exist.
   ADD the lang-file exemption: files `**/messages/**`, `**/*.lang.*` get
   `starci-fe/no-second-language-in-source` off (dictionary content IS Vietnamese — check the
   rule's real name via `Object.keys(canon.rules)` after install).
3. `eslint --fix`, then hand-fix src/** debt (canon-fe rules + a11y + hooks).
4. `npx tsc --noEmit` clean; `npx jest`/`npm test` if the app has tests.
5. `ex-testing/lint/debt-todo-fe.json` + `ex-testing/lint/setup-todo-fe.done`.
Report: devDeps, per-rule counts before/after, files touched.
