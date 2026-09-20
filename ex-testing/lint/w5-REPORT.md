# w5 — dirs triage + builders + tests (tinkle-18 + 19 + 21)

Scope: `docs/ workflows/ hosts/ providers/ execution/ contracts/ approvals/ scripts/build-* scripts/compile-*
ensure-build.mjs package.json config*.yaml tests/** fixtures/**` plus unclassified dirs
`bin/ cli/ init/ mcp/ runtime/ sites/ skills/ specifications/ upgrades/ notes/ packages/`.

End state: the runtime reads authored source directly. There is no `.dist` build step, no builder call-site,
and no `.dist` entry in the shipped payload. `core/runtime-root.mjs` keeps `distRoot` as a compatibility
alias that resolves to `skillRoot`.

## Per-directory verdicts

| dir | verdict | action |
|---|---|---|
| docs/ | live-runtime (keep) | prose repointed to source layout; superseded pipeline/plan docs `git mv` → `legacy/docs/` (v4-plan, v4.1-supervision-plan, orca-runtime-upgrades, yaml-migration-map, handover-2026-09-14, examples) |
| workflows/ | live-runtime (keep) | `.dist` reader refs repointed to authored yaml/md |
| hosts/ | live-runtime (keep) | `hosts/index.mjs`, `hosts/orca/{calls,launch}.mjs` read source roots |
| providers/ | live-runtime (keep) | `providers/validate.mjs` repointed |
| execution/ | live-runtime (keep) | `execution/supervision.mjs` repointed; stays live (4.x Plan-route modes) |
| contracts/ | live-runtime (keep) | no changes needed beyond repoints |
| approvals/ | live-runtime (keep) | no `.dist` refs |
| scripts/build-*, compile-*, ensure-build | legacy | all moved → `legacy/builders/` (see below) |
| scripts/ (rest) | live-runtime (keep) | `checks/brand.mjs`, `checks/check-json-exceptions.mjs`, `config.mjs`, `plan.mjs`, `present-goal.mjs`, `work-example.mjs`, `route/build-ops-registry.mjs` repointed to source/modules |
| package.json | live-runtime (keep) | `.dist` dropped from `files`; `ops/`+`model/` replaced by `legacy/ops/`+`modules/`; all `build:*`/`prepack` scripts removed; `starci` script kept |
| config*.yaml/json | live-runtime (keep) | no `.dist` refs |
| bin/ | live-runtime (keep) | installer + CLI now copy/read source directly (details below) |
| cli/ | live-runtime (keep) | `cli/main.mjs` repointed |
| init/ | live-runtime (keep) | no `.dist` refs |
| mcp/ | live-runtime (keep) | docker config only, no `.dist` refs |
| runtime/ | local cache | gitignored, holds stale `engine/builds/*/.dist` seals — intentionally untouched (see notes) |
| sites/ | live-runtime (keep) | `sites/docs/build.mjs`, `sites/docs/package.json`, `sites/skills/scripts/generate-data.mjs` consume source data; site-regression spec asserts no `.dist` in output |
| skills/ | live-runtime (keep) | companion skills verified; `INDEX.yaml` folders fix (see below) |
| specifications/ | live-runtime (keep) | readers repointed to source |
| upgrades/ | live-runtime (keep) | historical upgrade notes retain `.dist` prose describing what past versions did — intentional, they are operator-facing history |
| notes/ | legacy | session notes archived → `legacy/notes/` |
| packages/ | live-runtime (keep) | shared libs, per brief |
| ops/ (retired root) | merge target | split handled by other lanes: `modules/ops` + `legacy/ops`; w5 updated `scripts/route/build-ops-registry.mjs` to emit `origin` pointing at `modules/ops/ops/<id>.yaml` and to scan `legacy/ops` for legacy executables |

## Builders moved → `legacy/builders/` (staged `git mv`, uncommitted)

`assemble-site.mjs`, `build-docs.mjs`, `build-workflows.mjs`, `build-yaml.mjs`, `compile-declarative.mjs`,
`compile-knowledge.mjs`, `ensure-build.mjs`, `knowledge-compile/{paths,project,schema}.mjs`,
`runtime-compile/{declarative,emit,import-closure,paths,runtime-modules,stage}.mjs`, `runtime-modules.txt`,
and `tests/{build-entry,compile-knowledge}.spec.mjs` + `tests/fixtures/knowledge-yaml/*` →
`legacy/builders/tests/…`. Builder-relative imports and root resolution inside the moved files updated.

## Build call-sites removed/repointed

- `package.json` — removed `prepack`, `build`, `build:check`, `build:declarative(:check)`,
  `build:knowledge(:check)`, `build:ensure`, `build:sites`, `build:yaml`; `.dist/` removed from `files`.
- `bin/starci-skills.mjs` — installer derives payload from `package.json`, copies source, no build step;
  `buildInstalledRuntime` → `prepareInstalledRuntime`; exports `payloadFiles`; filters payloads (skips
  symlinks, `node_modules`, `.git`, `.runtime`, generated material, `.mjs` example automation, plaintext
  beside `.enc`); keeps `/.dist*/` ignore entries for upgraded trees; recognizes the historical
  `Check/build .dist first` prompt variant for migration while the installed prompt is distless; doctor test
  list updated to current shipped set (`tests/ops.spec.mjs` was deleted by another lane).
- `bin/starci.mjs`, `cli/main.mjs` — launcher/CLI repointed to source.
- `kernel/kernel.mjs` — `launcherOf` now `<host>/hosts/orca/launch.mjs`; `modelPolicy` reads
  `modules/models/capabilities.yaml`; legacy-coordinator pin check reads `hosts/orca/launch.mjs` first with a
  `.dist` fallback for old pins (compat, intentional).
- `kernel/goal.mjs`, `kernel/chains.mjs` — comments/paths repointed; fixed `plain(attempt)` →
  `isPlainObject(attempt)` in `selectExecutionTarget` (ReferenceError under load).
- `core/runtime-root.mjs` — `skillRoot` is the runtime root; `distRoot` alias kept resolving to it.
- `scripts/route/build-ops-registry.mjs` — scans `modules/ops`, legacy executables from `legacy/ops`,
  generated `modules/ops/registry.yaml` `origin` corrected; `--check` passes (30 ops).
- `scripts/checks/brand.mjs` — grammar canon read from `knowledge/grammars` source, no `.dist` preference.
- `scripts/checks/check-json-exceptions.mjs` — `.dist` kept only as a skip-dir for stale trees; GENERATED
  list now names site build output.

## tests/ + fixtures/ repoints

- `tests/application-stacks-integration.spec.mjs` — fixture no longer copies the deleted `ops/` root.
- `tests/integration.spec.mjs` — payload asserts `.dist` absent, `.gitignore` keeps `/.dist*/`; installer
  doctor test matches current test set.
- `tests/pattern-coverage.spec.mjs` — run-state tests rewritten for the SQLite ledger store
  (`.starciwork/runtime.sqlite`): asserts `store.paths` retirement throws `store-paths-removed:*`, exercises
  `saveState`/`appendEvent`/`readEvents`/inbox/reports/contracts/checks APIs; candidate-boundary expectation
  updated `outside-allowlist` → `custody-path-touched` for `.starciwork` writes.
- `tests/workflow-kernel-shared-ledger.spec.mjs` — stages source dirs, imports pinned modules from source
  paths, provenance asserts `knowledge/grammars/` not `.dist/`.
- `tests/engine-adapter.spec.mjs` — two `createJobBridge` calls still passed the retired `journalFile` key
  (→ `openLedger needs a file`); repointed to `ledgerFile`/`machineFile`. 51/51.
- `tests/candidate-multi-root.spec.mjs` — sealed-runtime test drift paths `.dist/kernel/*` → `kernel/*`,
  canon fixture JSON → `knowledge/grammars/index.yaml` (YAML).
- `tests/workflow-kernel.spec.mjs` — `.dist` launcher/execution paths repointed to source paths.
- `tests/{code-examples,code-examples-multifile,runtime-import-closure,verify-proof,workflow-view}.spec.mjs`
  — builder references repointed to `legacy/builders/*` (they exercise retired builders intentionally).
- `INDEX.yaml` — fixed an unquoted `route:` substring inside `folders.modules` that broke YAML parse
  (skills-tree spec).

## Verification

| check | result |
|---|---|
| `node --test tests/engine-adapter.spec.mjs` | 51/51 pass |
| `node --test tests/candidate-multi-root.spec.mjs` | 17/17 pass (standalone) |
| `node --test tests/application-stacks-integration.spec.mjs` | 3/3 pass |
| `node --test tests/integration.spec.mjs` | 26/26 pass |
| `node --test tests/profiles-assets.spec.mjs` | 6/6 pass |
| `node --test tests/skills-tree.spec.mjs` | 3/3 pass |
| `node --test tests/pattern-coverage.spec.mjs` | 7/7 pass |
| `node --test tests/workflow-kernel-shared-ledger.spec.mjs` | 5/5 pass |
| `node --test tests/workflow-view.spec.mjs` | 35/35 pass |
| `node scripts/route/build-ops-registry.mjs --check` | `registry.yaml is current (30 ops)`, exit 0 |
| full suite `node --test "tests/*.spec.mjs"` | pass 2393 / fail 6 — all 6 classified below |
| `.dist` grep sweep of owned dirs | only intentional refs remain (see below) |

## Remaining suite failures — all cross-lane, none caused by w5 edits

1. `tests/goal-contract.spec.mjs` — "owner weights … named order leads capacity heuristics": allocator
   `PREFER_THEN_OVERFLOW` picks `devin-agent` instead of owner-ordered `qwen-agent`, and `review()` reports
   `slots=4` not the quota grant 10. Deterministic. Lives in `kernel/schedule.mjs` (modified by kernel lane).
2-5. `tests/workflow-kernel.spec.mjs` (4 tests): input-recovery refusal no longer fires
   (`recoverWorkflowInputReferences` in `kernel/inputs.mjs` returns ok where the test expects refusal —
   inputs.mjs itself unmodified, so the goal/state it reads changed under it); audit leaves non-empty Work
   bytes; foreign-repo refusal row duplicated ×12 (dedup regression); `usedToday` stays 0 after report
   acceptance (`kernel/loads.mjs` shared-ledger bookkeeping). kernel internals are heavily modified by other
   lanes; w5's only kernel edits are `.dist`→source path repoints, none on these code paths.
6. `tests/candidate-multi-root.spec.mjs` — "complete sealed runtime identity": `verifyRuntimePin` returned
   not-ok inside the full suite but the spec passes 17/17 standalone — a cross-process race while
   `sealRuntime` hashes+copies the live tree in parallel with other specs mutating it. `kernel/runtime-pin.mjs`
   is a kernel-lane file; w5 only repointed this spec's `.dist` drift paths.

## Intentional `.dist` references retained

- `bin/starci-skills.mjs` — historical prompt-entry variant for bootstrap migration; `.dist` in
  `RETIRED_ROOTS` (upgrade cleanup); `/.dist/` `/.dist.staging/` `/.dist.previous/` `.gitignore` entries for
  upgraded trees.
- `scripts/checks/check-json-exceptions.mjs` — `.dist` in SKIP_DIR_NAMES for stale local trees.
- `sites/skills/scripts/site-regression.spec.mjs` — asserts generated output does NOT match `.dist`.
- `tests/*` — assertions that `.dist` is absent/not shipped.
- `kernel/kernel.mjs` — `.dist` fallback read in `reconcileLegacyCoordinatorLease` for pre-migration pins.
- `upgrades/*.md` — historical release notes describing past `.dist` behavior.
- `ex-testing/lint/scratch/**` — historical scratch/replay artifacts, not live source.
- `runtime/engine/builds/<sha>/.dist` — stale local seal cache, gitignored, not owned source. Untouched.

## Assumptions / notes

- `knowledge/` untouched per lane rules; the source-layout/knowledge-patterns concerns belong to another lane.
- `produces:` backfill in `modules/ops/ops/*.yaml` was pre-existing work — not redone.
- No commit made; all `git mv` renames are staged in the working tree alongside other lanes' dirty state.
- `tests/ops.spec.mjs`, `tests/knowledge-yaml.spec.mjs`, `tests/runtime-dist-only.spec.mjs`,
  `tests/package-source-build.spec.mjs`, `tests/yaml-dist-migration.spec.mjs` deletions are other lanes'
  retirements; w5 only adjusted references that broke (doctor test list, ops-dir fixture copy).
- No blockers.
