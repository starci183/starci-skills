# Sonar lane (Q7) — per-app config + scan notes

Date: 2026-09-19
Lane: Q7 (sonar per-app config + scan)

## Files created

- `examples/todo-app-backend/sonar-project.properties` — projectKey `starci-todo-app-backend`, `sonar.sources=src`, `sonar.tests=src`
- `examples/ecommerce-app-be/sonar-project.properties` — projectKey `starci-ecommerce-app-be`, `sonar.sources=src,apps`, `sonar.tests=src,apps`

Both mirror the main repo's `sonar-project.properties` conventions: spec exclusions
(`*.spec.ts`, `*.int-spec.ts`, `*.e2e-spec.ts`, `*.harness-spec.ts`, `dist`, `coverage`),
`sonar.test.exclusions=**/*.e2e-spec.*`, `sonar.javascript.lcov.reportPaths=coverage/lcov.info`,
and `sonar.javascript.node.maxspace=8192`.

Deviations from the main repo file, all forced by exclusive lane scope:

- `sonar.typescript.tsconfigPaths=tsconfig.json` — the main repo uses a dedicated
  `tsconfig.sonar.json`, but creating one here is outside this lane's scope. Each app's
  `tsconfig.json` already includes exactly the sonar sources (`src` for todo; `src,apps`
  for ec), so analysis scope is identical. If a dedicated sonar tsconfig is wanted later,
  create it and update the property.
- `sonar.sources` for todo is `src` (no `apps/` tree exists there); ec uses `src,apps`
  per its monorepo layout, matching the brief.

## Server verification

`GET https://sonar.starci.org/api/system/status` on 2026-09-19:

```json
{"id":"532C3E16-AaA63fXTYjsThFcLkACG","version":"26.8.0.126808","status":"UP"}
```

## Scan — NOT run (token required)

`SONAR_TOKEN` is not set in this environment, so no scan was attempted (the brief forbids
inventing a token). To run the scans, a SonarQube token with **Execute Analysis**
permission on both projects is required — provision one on sonar.starci.org
(My Account → Security → Generate Token), then:

```bash
# todo-app-backend
cd D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend
SONAR_TOKEN=<token> npx @sonar/scan

# ecommerce-app-be
cd D:/Repositories/starci-academy-backend/.claude/examples/ecommerce-app-be
SONAR_TOKEN=<token> npx @sonar/scan
```

`@sonar/scan` reads `sonar-project.properties` from the working directory, so the
properties files are picked up automatically; `sonar.host.url` is already set inside them.

## Prerequisites / caveats

- The projects `starci-todo-app-backend` and `starci-ecommerce-app-be` must exist (or be
  auto-provisioned by the token's permissions) on sonar.starci.org; if unprovisioned the
  scan will fail authorization — report honestly rather than working around it.
- Coverage: run `npx jest --coverage` in each app first so `coverage/lcov.info` exists for
  `sonar.javascript.lcov.reportPaths`; missing lcov only degrades coverage reporting, it
  does not fail the scan. Codecov upload stays per-app via flags `todo-be` / `ecommerce-be`
  (see `ex-testing/ANALYSIS.md` §3).
- The old JS e2e harness under todo's `test/e2e/` is outside `sonar.sources=src` and is
  not analyzed. The new `src/tests/e2e/**.e2e-spec.ts` files are excluded via
  `sonar.exclusions`/`sonar.test.exclusions`, matching main-repo behavior.
