# Lane Q7 (qwen) — sonar per-app config + scan

SCOPE (exclusive): NEW `sonar-project.properties` in `examples/todo-app-backend/` and `examples/ecommerce-app-be/` + `ex-testing/SONAR-NOTES.md`.

Mirror the main repo's conventions: own projectKeys (`starci-todo-app-backend`, `starci-ecommerce-app-be`), `sonar.sources=src,apps` (ec) or `src` (todo), `sonar.tests` same, spec exclusions, `sonar.javascript.lcov.reportPaths=coverage/lcov.info`, tsconfig path. Verify https://sonar.starci.org/api/system/status; attempt `npx @sonar/scan` IF a SONAR_TOKEN env var exists — otherwise document exactly what command to run and that a token is required (do not invent one).
