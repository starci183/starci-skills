# Common rules — ALL lanes

You are one lane in a 20-agent testing fleet. Working dir: `D:\Repositories\starci-academy-backend` (the `.claude` repo checkout — examples live at `.claude/examples/`).

## Hard rules
- **Scope lock**: create/modify files ONLY inside your lane scope listed below. Touching any file outside scope = mission failure.
- **No git ops**: do NOT run `git add/commit/checkout/branch/stash`. Trò tổng hợp + commit sau.
- **No manifest edits** unless your scope says so (`package.json`, `tsconfig*`, `jest.config*` are infra-lane-owned).
- **TestingModule convention**: every spec boots via `Test.createTestingModule({...}).compile()` and `module.get(...)`. No bare `new XService(deps)` in new specs. Mock at provider boundary (`{provide: Dep, useValue: mock}`).
- Read `.claude/ex-testing/ANALYSIS.md` first for the fleet contract.
- Report at end: files created, spec count, `jest` run result for your specs (run with `npx jest <paths>` scoped to your files only).
- If an existing spec in your scope uses direct instantiation, convert it to TestingModule when the conversion is mechanical; otherwise leave it and note it.
- Vietnamese-style commit-ready code, English identifiers. Comments only where the test intent is non-obvious.
