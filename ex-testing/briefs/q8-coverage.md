# Lane Q8 (qwen) — coverage wiring + numbers

SCOPE (exclusive): root `jest.config.js` of each app (coverage settings only) + `package.json` scripts section (add `test:coverage`) + NEW `ex-testing/COVERAGE-REPORT.md`.

Ensure `npx jest --coverage` emits `coverage/lcov.info` per app with sensible collectCoverageFrom (exclude spec files, main.ts, dist, node_modules). Add `test:coverage` script. Run coverage per app, record line/branch/function numbers in the report, flag domains below 80%. Do NOT weaken tests to inflate numbers.
