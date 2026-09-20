# k4 REPORT — `scripts/goal/assess.mjs` (bounded cold-scan for define-goal --plan)

## Deliverable

New file `scripts/goal/assess.mjs` (229 lines, pure `node:fs`/`node:path`, ESM sibling of `define-goal.mjs`).
CLI: `node scripts/goal/assess.mjs --repo <path> [--repo <path2>...] [--json]`.
No commits made; no other files touched.

## Implementation notes

- **Walk**: iterative stack + `readdirSync(withFileTypes)`, skip-list `node_modules, .git, dist, coverage, .next, out`, hard cap 20k files per tree. `.starciwork` gets a second bounded walk for artifact counts.
- **Reads**: content greps (`eslint-disable`, `: any`, `as any`) on `.ts/.tsx/.js` only, cap 2000 files. LOC counted on up to 6000 `.ts/.tsx/.js` reads, extrapolated by average beyond that (field is an estimate by contract); extrapolation disclosed in `notes`.
- **Framework detect**: root `package.json` deps + config filenames discovered *anywhere* in the walk (monorepo-safe): `vitest.config.*`/`vitest` dep → vitest; `jest.config.*`/`jest`/`@nestjs/testing` → jest; `playwright.config.*`/`@playwright/test` → playwright; else `none`. Coverage via `.nycrc/.c8rc/codecov.yml`, `coverage` in scripts, `jest.collectCoverage/coverageThreshold`, or `coverage` inside any discovered jest/vitest config.
- **Never throws**: missing path → `exists:false` + signal; non-dir → note; unreadable/locked dirs collected into `notes` (capped at 10 + overflow count) and surfaced as `scan: partial` signal; whole `assessRepo` wrapped per-repo so one bad repo can't kill the batch.
- **Signals** map to quality-bar.yaml layers: `tests:` (framework/specs/e2e smoke-only ≤5/coverage), `static-correctness:` (eslint config, eslint-disable count — "lint relaxed" wording >50, any-leaks), `sonar:` (aggregator wiring), `starciwork-artifacts:` (missing tree / no index nodes / no UAT / no evidence / no media), `dependencies:` (no lockfile / stale >90d), `scan:` (truncation/partial).
- Extra fields beyond spec: `notes[]` (partial-scan disclosure) — harmless additive; `e2eDir files count` emitted as `e2eFiles`.

## Verification

| command | result |
|---|---|
| `node --check scripts/goal/assess.mjs` | OK |
| `node scripts/goal/assess.mjs --repo D:\Repositories\nivo-backend --repo D:\Repositories\nivo-fe` | OK, **5.3s total** for both (nivo-backend hits the 20k file cap) |
| `... --repo D:\Repositories\nivo-fe --json` | clean machine output |
| `... --repo D:\Repositories\does-not-exist --json` | `exists:false`, no throw, exit 0 |

## Real smoke output

```
$ node scripts/goal/assess.mjs --repo "D:\Repositories\nivo-backend" --repo "D:\Repositories\nivo-fe"

nivo-backend  (D:\Repositories\nivo-backend)
  size     20000 files | 5210 ts | ~524033 loc
  tests    jest | 752 specs | e2e 115 files | coverage cfg: yes
  lint     eslint cfg: yes | disables: 30 files | any leaks: 7 files
  sonar    configured
  work     nodes 2014 | uat 7 | evidence 747 | media 133
  deps     52+34 dev | lock: ~12d | npm:yes pnpm:yes
  signals  static-correctness: 30 files with eslint-disable ; static-correctness: 7 files contain ': any'/'as any' ; scan: truncated at 20000 files
  notes    file scan truncated at 20000

nivo-fe  (D:\Repositories\nivo-fe)
  size     4608 files | 619 ts | ~48518 loc
  tests    vitest | 183 specs | e2e 1 files | coverage cfg: yes
  lint     eslint cfg: yes | disables: 0 files | any leaks: 0 files
  sonar    configured
  work     nodes 0 | uat 0 | evidence 0 | media 0
  deps     0+18 dev | lock: ~12d | npm:yes pnpm:yes
  signals  tests: e2e is smoke-only (1 files) ; starciwork-artifacts: no index nodes ; starciwork-artifacts: no UAT ; starciwork-artifacts: no evidence ; starciwork-artifacts: no media assets
```

`--json` for nivo-fe (abbreviated — full keys verified):
`testInfra.framework: "vitest"`, `specFiles: 183`, `e2eFiles: 1`, `coverageConfig: true`, `starciwork.present: true` with all counts 0, `deps: {count:0, devCount:18, lockfileAge:12, hasPackageLock:true, pnpmLock:true}`, signals as above, `notes: []`.

Missing-repo JSON returns `exists:false`, all zeroed sections, `signals: ["repo path does not exist"]` — no exception, exit 0.

## Spot-checks vs reality

- nivo-backend: `jest-harness.json` files exist under `src/tests/harness/` → framework `jest` correct (no jest dep at root; detected via config + `@nestjs/testing`). 20k cap is real — repo carries large scratch/archive dirs outside the skip-list; truncation is disclosed in both `notes` and `signals`. `.starciwork` counts (2014 index nodes, 7 uat, 747 evidence, 133 media) match the known work tree.
- nivo-fe: `.starciwork` exists but contains only `_local` → `present:true`, all counts 0, correct "no UAT/no evidence" signals. Root manifest is a workspace shell → `deps.count:0` is the honest root-manifest count (real deps live in `apps/*`/`packages/*` manifests; out of scope for a root-level heuristic).
- nivo-fe `e2e 1 file` = `apps/app/e2e/smoke.spec.ts`-class file → "e2e is smoke-only" signal correct.

## Notes for the parent agent

- The `deps` counts are root-`package.json` only — for workspace repos (nivo-fe) they under-report. Acceptable for a bounded heuristic, but if define-goal --plan needs workspace-aggregate deps that's a deliberate follow-up, not a bug.
- `e2eFiles` counts any file under a dir segment matching `/e2e/i` plus `*.e2e-*` names — catches `e2e/`, `test/e2e/`, `e2e-tests/` conventions.
- Bare `assess.mjs` (no args) prints usage and exits 2; `--json` alone scans `process.cwd()` (sibling-script convention).
