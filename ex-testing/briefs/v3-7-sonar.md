# v3-7 — sonar: provision + scan all 4 apps + quality gates
Read `briefs/v3-HEADER.md` first.
SCOPE: `**/sonar-project.properties`, `.stacks/dev/runtime/files/sonarqube-*`,
`ex-testing/lint/**`. NO other app files.
Prior art: `ex-testing/SONAR-NOTES.md`; sonar.starci.org UP (v26.8); projects + tokens ALREADY
provisioned for the 2 BE apps and stored SOPS-encrypted:
  .stacks/dev/runtime/files/sonarqube-todo-app-backend-token.key.enc
  .stacks/dev/runtime/files/sonarqube-ecommerce-app-be-token.key.enc
Admin password: `sops -d .stacks/dev/runtime/files/sonarqube-admin-password.txt.enc`
(set SOPS_AGE_KEY_FILE=%USERPROFILE%/.starci/master.identity). NEVER print token values.

## Mission
1. Read SONAR-NOTES.md + existing `sonar-project.properties` files (q7 may have created them
   in the BE apps — verify/fix: projectKey must match provisioned names).
2. Provision 2 FE projects on sonar.starci.org: `starci-todo-app-frontend`,
   `starci-ecommerce-app-fe` + per-project PROJECT_ANALYSIS_TOKENs named
   `<key>-local-analysis`. Write `.key` files + `sops -e` to `.key.enc` under
   `.stacks/dev/runtime/files/` (same naming pattern); delete plaintext copies from tmp.
3. Scan all 4 apps: `SONAR_TOKEN=$(sops -d <enc file>) npx @sonar/scan` in each app dir
   (needs coverage/lcov.info — if missing for FE, scan without coverage and note it; v3-6
   is wiring coverage in parallel).
4. Query quality gate per project via `api/qualitygates/project_status?projectKey=` —
   record PASS/FAIL + failing conditions honestly.
5. `ex-testing/lint/SONAR-SUMMARY.md`: per-app key, gate status, issue counts, links.
Report: projects provisioned, scan status, gate results, blocker details.
