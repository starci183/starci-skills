# Lane v4-4 — coverage regen + Sonar rescan (4 apps)

**RECONSTRUCTED by lane v5-8.** The v4-4 agent crashed (exit 0xc0000409) before
writing this report. This file is rebuilt from the brief
(`ex-testing/briefs/v4-4-cov-sonar.md`), `lint/SONAR-SUMMARY.md`,
`lint/COVERAGE-SUMMARY.md` (v3-6), `ex-testing/COVERAGE-REPORT.md` (q8), and
on-disk artifact timestamps. It records what can be proven from disk, not what
the crashed agent may have done in memory.

## What the lane was asked to do

1. Regenerate `coverage/lcov.info` for todo-app-backend, ecommerce-app-be and
   todo-app-frontend (ecommerce-app-fe skipped: no unit suite); verify each
   `sonar-project.properties` lcov key points at that file.
2. Re-scan all four apps against `https://sonar.starci.org` with the per-project
   SOPS-encrypted tokens.
3. Verify quality gates via `api/qualitygates/project_status`.
4. Refresh `lint/SONAR-SUMMARY.md` and write this report.

## Provenance evidence (file mtimes, 2026-09-19)

| Artifact | mtime | Attributed to |
|---|---|---|
| `lint/coverage-*.json`, `lint/COVERAGE-SUMMARY.md` | 12:25–12:27 | v3-6 |
| `lint/SONAR-SUMMARY.md` | 12:29 | v3-7 (title still says "v3-7 sonar lane") |
| `*/.scannerwork/report-task.txt` (all 4 apps) | 12:28–12:29 | v3-7 scans — **no newer scan task exists on disk** |
| `todo-app-backend/coverage/lcov.info` | 12:24 | v3-6 |
| `ecommerce-app-be/coverage/lcov.info` | 12:24 | v3-6 |
| `todo-app-frontend/coverage/lcov.info` | 14:37 | v4-5's own gate run (45 KB / 106 SF matches its report) |
| `ecommerce-app-fe/coverage/` | absent | expected — no unit suite |

No `v4-4`-era scan or coverage artifacts exist, so the v3-6 coverage numbers and
v3-7 sonar results below remain the latest verified data. Whether the crashed
agent re-ran anything before the fault cannot be proven; nothing it could have
written survived.

## Coverage state (per v3-6, `lint/COVERAGE-SUMMARY.md`)

| App | Runner | Suites | Tests | Lines | Functions | Branches | Statements |
|---|---|---|---|---|---|---|---|
| todo-app-backend | jest | 117/117 | 696/696 | 94.00 | 89.27 | 54.85 | 86.21 |
| ecommerce-app-be | jest | 36/36 | 216/216 | 96.14 | 98.38 | 56.12 | 87.76 |
| todo-app-frontend | vitest (v8) | 16/16 | 101/101 | 62.95 | 57.01 | 79.33 | 62.95 |
| ecommerce-app-fe | — | no unit suite | | | | | |

q8's ec-be blocker (`@nestjs/testing` missing) was resolved before v3-6 ran.

## Sonar state (per v3-7, `lint/SONAR-SUMMARY.md`)

All four projects scanned ANALYSIS SUCCESSFUL on sonar.starci.org
(SonarQube 26.8.0.126808), all quality gates **OK**:

| App | Bugs | Vulns | Smells | Hotspots | Coverage | ncloc |
|---|---|---|---|---|---|---|
| starci-todo-app-backend | 0 | 3 | 36 | 0 | 70.8% | 8592 |
| starci-ecommerce-app-be | 0 | 5 | 15 | 0 | 67.6% | 3122 |
| starci-todo-app-frontend | 0 | 0 | 52 | 0 | 63.4% | 3506 |
| starci-ecommerce-app-fe | 0 | 0 | 2 | 0 | 0.0% (no suite) | 877 |

Caveats carried forward from SONAR-SUMMARY: gates are OK partly because the
default gate evaluates New Code on first analyses; security rating is B
(todo-be, 3 vulns) and C (ec-be, 5 vulns); ec-fe scanned without coverage by
design.

## What v5-8 verified while reconstructing

- `sonar.javascript.lcov.reportPaths=coverage/lcov.info` is set in all four
  `sonar-project.properties`; the three apps with suites have a real
  `coverage/lcov.info` at that path.
- ec-fe `sonar.sources` is now `apps,packages` (v4-1 moved `types/` →
  `packages/shared/`). SONAR-SUMMARY's description of it as `apps,types` is
  stale narrative only; the file on disk is correct.
- If fresh sonar numbers are needed post-v4-1 (ec-fe sources changed shape), a
  re-scan of `starci-ecommerce-app-fe` is the one piece of v4-4's mission with
  no evidence of completion — flagged for whoever next owns the sonar lane.
