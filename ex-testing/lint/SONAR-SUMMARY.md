# SONAR-SUMMARY — v3-7 sonar lane

Date: 2026-09-19
Server: https://sonar.starci.org (SonarQube 26.8.0.126808, status UP)
Scanner: `npx -y @sonar/scan` per app dir; `SONAR_TOKEN` from SOPS-encrypted per-project
`PROJECT_ANALYSIS_TOKEN`s under `.stacks/dev/runtime/files/sonarqube-*-token.key.enc`.

## Projects provisioned

| Project key | Status | Token file |
|---|---|---|
| `starci-todo-app-backend` | pre-existing (prior lane) | `sonarqube-todo-app-backend-token.key.enc` |
| `starci-ecommerce-app-be` | pre-existing (prior lane) | `sonarqube-ecommerce-app-be-token.key.enc` |
| `starci-todo-app-frontend` | **created this lane** | `sonarqube-todo-app-frontend-token.key.enc` |
| `starci-ecommerce-app-fe` | **created this lane** | `sonarqube-ecommerce-app-fe-token.key.enc` |

Tokens named `<key>-local-analysis`, type `PROJECT_ANALYSIS_TOKEN`. Plaintext `.key`
copies sit beside the `.enc` files per the repo's established pattern; no tmp copies
were created (tokens written straight to final path).

## `sonar-project.properties`

- `examples/todo-app-backend/sonar-project.properties` — verified, key matches.
- `examples/ecommerce-app-be/sonar-project.properties` — verified, key matches.
- `examples/todo-app-frontend/sonar-project.properties` — **created**: `sources=src`,
  spec/exclusions mirror main FE repo + BE example (`*.spec.tsx`, `.next`, lcov path).
- `examples/ecommerce-app-fe/sonar-project.properties` — **created**: `sources=apps,types`,
  `tests=apps`, root `tsconfig.json` covers `apps/*/src/**` + `types/**/*.d.ts` exactly.

## Scan results (all ANALYSIS SUCCESSFUL)

| App | Dashboard | Quality gate | Bugs | Vulns | Code smells | Hotspots | Coverage | Dupl. | ncloc |
|---|---|---|---|---|---|---|---|---|---|
| todo-app-backend | https://sonar.starci.org/dashboard?id=starci-todo-app-backend | **OK** | 0 | 3 | 36 | 0 | 70.8% | 1.3% | 8592 |
| ecommerce-app-be | https://sonar.starci.org/dashboard?id=starci-ecommerce-app-be | **OK** | 0 | 5 | 15 | 0 | 67.6% | 2.0% | 3122 |
| todo-app-frontend | https://sonar.starci.org/dashboard?id=starci-todo-app-frontend | **OK** | 0 | 0 | 52 | 0 | 63.4% | 0.0% | 3506 |
| ecommerce-app-fe | https://sonar.starci.org/dashboard?id=starci-ecommerce-app-fe | **OK** | 0 | 0 | 2 | 0 | 0.0% | 0.0% | 877 |

Gate queried via `api/qualitygates/project_status?projectKey=` after server-side CE
processing — zero failing conditions on all four.

## Honest caveats

- All four gates are OK partly because the default "Sonar way" gate evaluates
  **New Code** conditions and these are first analyses with no new-code baseline.
  Existing-code issues are real: security rating B (todo-be, 3 vulns) and C
  (ec-be, 5 vulns). Ratings: reliability A / maintainability A everywhere.
- `todo-app-frontend` scanned **without** coverage initially — `coverage/lcov.info`
  appeared mid-run (v3-6 lane generating it in parallel, mtime 12:25); the server
  shows 63.4% so the report was picked up. If the timing raced, re-scan once lcov
  is stable to confirm the number.
- `ecommerce-app-fe` has **no** `coverage/lcov.info` (no unit tests exist in the
  app; v3-6 wiring coverage in parallel) — scanned without coverage per brief;
  coverage metric is 0.0%/unset, not a scan failure.
- Scanner emitted per-file `[WARN]` lists ("may lead to missing/broken features")
  for files excluded from the TS project (spec files, e2e infra) — informational,
  analysis succeeded; matches the intended source/test split.
- BE apps used `sonar.typescript.tsconfigPaths=tsconfig.json` (no dedicated sonar
  tsconfig — q7 note); FE apps same pattern, ec-fe root tsconfig spans both apps.
