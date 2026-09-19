# Lane v4-4 — coverage regen + Sonar rescan (4 apps)

SCOPE (exclusive): coverage artifacts + `ex-testing/` reports + sonar scans. You may RUN tests/lint in any app but do NOT edit app source; if a config fix is needed for coverage (e.g. coverage include globs), keep it minimal and note it in the report.

## Context

Four example apps under `D:/Repositories/starci-academy-backend/.claude/examples/`:
- `todo-app-backend` (NestJS+GraphQL, jest) — coverage: `npx jest --coverage` produces `coverage/lcov.info`
- `ecommerce-app-be` (NestJS REST→GraphQL migration in progress by another lane — scan whatever compiles at scan time; if tests fail because lane 2 is mid-flight, retry once later, then report)
- `todo-app-frontend` (Next.js, vitest + `@vitest/coverage-v8`) — `npx vitest run --coverage`
- `ecommerce-app-fe` (monorepo, no unit suite — expected 0% coverage)

SonarQube: `https://sonar.starci.org` (local docker `starci-sonarqube`, UP). Per-project tokens are SOPS/age-encrypted at `.stacks/dev/runtime/files/`:
- `sonarqube-todo-app-backend-token.key.enc` → project `starci-todo-app-backend`
- `sonarqube-ecommerce-app-be-token.key.enc` → `starci-ecommerce-app-be`
- `sonarqube-todo-app-frontend-token.key.enc` → `starci-todo-app-frontend`
- `sonarqube-ecommerce-app-fe-token.key.enc` → `starci-ecommerce-app-fe`

Decrypt WITHOUT printing values: `export SOPS_AGE_KEY_FILE=<the age key file used previously — find it: check env, ~/.config/sops, .stacks docs, or `sops` config files under .stacks>; SONAR_TOKEN=$(sops -d --extract '["sonarqube-todo-app-backend-token"]' .stacks/dev/runtime/files/sonarqube-todo-app-backend-token.key.enc 2>/dev/null || sops -d .stacks/dev/runtime/files/sonarqube-todo-app-backend-token.key.enc | tr -d '[:space:]')`. NEVER echo/commit token values. Each app has `sonar-project.properties` already — verify `sonar.projectKey` matches the table above and `sonar.host.url=https://sonar.starci.org`.

## Tasks

1. Generate fresh `coverage/lcov.info` for todo-app-backend, ecommerce-app-be, todo-app-frontend (skip ecommerce-app-fe: no suite). Verify each `sonar-project.properties` points `sonar.javascript.lcov.reportPaths`/`sonar.coverage.jest.lcov.reportPaths` (whichever key is configured) at the lcov file.
2. Run `npx @sonar/scan` (or `sonar-scanner`) in each app with its own decrypted token. Record per-project: scan success, quality gate, bugs/vulnerabilities/smells counts, coverage %.
3. Verify quality gates via `GET https://sonar.starci.org/api/qualitygates/project_status?projectKey=<key>` (auth with the admin token `sonarqube-admin-token.key.enc`, decrypted the same way).
4. Write consolidated report to `D:/Repositories/starci-academy-backend/.claude/ex-testing/lint/SONAR-SUMMARY.md` (overwrite/update): table of the 4 projects with gate status + metrics + scan timestamps, plus `v4-4-REPORT.md` noting anything that had to be fixed.
5. Do NOT modify encrypted files, do NOT print token values in logs or reports.

## Rules

- If a token fails auth, report it — never invent or substitute tokens.
- If ec-be source is mid-migration (lane 2) and won't compile/scan, wait and retry once; if still failing, scan anyway if the scanner tolerates it and mark the caveat.
