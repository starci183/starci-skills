# Lane v5-4 (qwen) — fix Sonar security vulnerabilities in both BE apps + rescan

SCOPE (exclusive): `examples/todo-app-backend/src/**` (NOT `src/tests/**`), `examples/ecommerce-app-be/src/**` (NOT `src/tests/**`), each app's `sonar-project.properties` if needed. Do NOT touch `src/tests/**` (v5-1/v5-7 own it), FE apps, or `packages/`.

## Context
`https://sonar.starci.org` — all 4 gates OK but security ratings: todo-be **B (3 vulns)**, ec-be **C (5 vulns)**. Sonar summary: `.claude/ex-testing/lint/SONAR-SUMMARY.md`. Per-project analysis tokens: `.stacks/dev/runtime/files/sonarqube-<app>-token.key.enc` (SOPS/age — decrypt to env var, NEVER print).

## Tasks
1. Fetch the actual vulnerability issues per project via Sonar API: `api/issues/search?projectKeys=<key>&types=VULNERABILITY&resolved=false` (use the decrypted token as `Authorization: Bearer`). Also grab `types=BUG` with severity blocker/critical if cheap.
2. Fix each vuln in the OWNING source file — real fixes (sanitize, parameterized queries, auth checks, whatever Sonar flagged), no suppression comments, no `// NOSONAR` unless the rule is genuinely a false positive AND you document why in the code comment.
3. Verify per app: `npx eslint src` → 0 errors; `npx tsc --noEmit` → clean; `npx jest` → all green.
4. Rescan both BE projects (`npx -y @sonar/scan` with project token), wait for CE processing, re-query `api/qualitygates/project_status?projectKey=` — must stay OK; verify vuln count dropped (api/issues/search again).
5. Report → `.claude/ex-testing/lint/v5-4-REPORT.md`: each vuln (rule, file, fix), gate results, remaining issues.

## Rules
- Never print token values. Fix in owning source, not in tests. English only.
