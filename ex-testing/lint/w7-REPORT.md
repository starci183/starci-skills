# w7 — consistency gate + .dist deletion + E2E verify

Lane: `w7` (Wave 2). Scope: tinkle-13 eight-check consistency gate, tinkle-22
`.dist` sweep/deletion, tinkle-23 cold-boot/route/checks/example-gate/YAML E2E.
Evidence scratch: `ex-testing/lint/scratch/w7/` (all command outputs kept there).

## Lane status sweep

- Done markers present: w1, w2, w3, w4, w6, w8, w9.
- **w5 is still missing `ex-testing/lint/done/w5.done` and `w5-REPORT.md`.**
  w5 was observed actively editing `tests/` during this lane (`application-stacks-integration`,
  `runtime-import-closure`, `workflow-view`, `code-examples*`, `integration`,
  `verify-proof` all had mtimes minutes old while w7 ran). Residual test failures
  below are largely w5 in-flight scope; the suite improved from 192 → 15 failures
  between w7's two full runs as w5 fixes landed.

## tinkle-13 consistency gate — 8 checks

| # | Check | Result |
|---|-------|--------|
| 1 | `modules/ops/ops/*.yaml` vs migrated `legacy/ops/*/operator.yaml` (id, goal, nodeKinds, completionProfile) | **PASS** — 30/30 module op YAMLs match their legacy operator metadata. One extra `legacy/ops/tests/` dir (`ops.spec.mjs`) has no module counterpart — expected (it is a test dir, not an op). Note: original check compared root `ops/`; the checker was corrected to `legacy/ops/` after the migration. |
| 2 | `route:` keys in module YAML vs fields read by `scripts/route/route-op.mjs` | **PASS** — all 30 ops use only `nodeKinds`, `phase`, `intent`, `prerequisites`, `riskHints`; all are consumed by route-op. |
| 3 | `modules/models/selection.yaml` vs `kernel/model-policy.mjs` | **PASS** — risk ladder (low<medium<high<critical), floor ladder (probation<standard<high<critical), high-risk kinds, kernel-function probation exemption, qualification gates, probation budgets, independent-review rules and typed no-effect fallback all correspond between YAML and code. |
| 4 | `modules/goal/legality.yaml` vocabulary vs `produces:`/`consumes:` in op YAML | **FAIL / drift** — see below. |
| 5 | `modules/kernel/dispatch.yaml` + `verdict-contract.yaml` vs `scripts/route/dispatch-op.mjs` | **PASS (shape)** — dispatch-op builds `{op, brief, context{records,owned_paths}, constraints{model,budget,lease}, returns{verdict: pass\|fail\|blocked, evidence, suspicion}}` matching both contracts; verdict enum matches verdict-contract. Cosmetic drift: dispatch-op.mjs header comment still says "modules/kernel/ has NOT landed yet". |
| 6 | `sqlite/schema.sql` vs `kernel/ledger-db.mjs` DDL | **PASS with note** — after separating `LEDGER_DDL` from `MACHINE_DDL`: schema.sql↔LEDGER_DDL 19/19 tables, 6/6 indexes; machine.sql↔MACHINE_DDL 5/5 tables, 1/1 index. Only diff: trigger `events_digest_chain` lives in a separate `EVENTS_DIGEST_TRIGGER` constant injected at init — structural comparison note, not functional drift. |
| 7 | `modules/schemas/index.yaml` vs `schemas/` | **PASS** — 45 schema files, 45 index entries, no missing, no ghosts. (Checker was patched to stop expecting `.dist/schemas`.) |
| 8 | Smoke: route-op, route-model, route-plan | **PASS** — see E2E section. |

### Check 4 drift detail

`modules/goal/legality.yaml` `opProduces` uses short state-variable spellings
(`request: analyzed`, `task: executed`, `node.X: cut into disjoint children`,
`knowledge: repaired`, `workspace: managed`), while the 30 op YAMLs declare
richer top-level `produces`/`consumes` contracts (evidence/output descriptions).
Every op has an `opProduces` entry except `implementation.plan`, which exists in
legality vocabulary but has no `modules/ops/ops/implementation.plan.yaml` — it is
vocabulary without an operator. This is a representation/contract drift to be
reconciled by the owning contract lane: either legality needs a mapping from op
contracts to state variables, or op YAMLs need canonical `produces` spellings.

## tinkle-22 — `.dist` sweep and deletion

- Root `.dist/` was already absent at lane start; **`.dist.w7-hold/` (untracked
  safety copy of old compiled artifacts) has been deleted.** `ls -d .dist*` →
  nothing.
- Live-zone `.dist` references remaining are all intentional compat or benign —
  no broken runtime reads:

  | File | Nature |
  |------|--------|
  | `core/runtime-root.mjs` | The sanctioned compat layer: `readDistJson` maps historical `.dist` spellings to source docs; `distRoot === skillRoot` deprecated alias. |
  | `kernel/common.mjs:469` | Probes `.dist/knowledge` only for payloads sealed before the migration (pre-migration pins). |
  | `kernel/candidate-roots.mjs:77-85` | `.dist/...json` candidate spellings for pre-migration pinned trees. |
  | `kernel/runtime-pin.mjs:53` | Seals `.dist` when present (old-layout roots); no-op now. |
  | `kernel/ledger-db.mjs:23` | Accepts `.dist/kernel/ledger-db.mjs` as an old sealed-root marker. |
  | `kernel/kernel.mjs:535` | `.dist/hosts/orca/launch.mjs` fallback inside pinned payloads. |
  | `kernel/terminals.mjs:207` | ENOENT error regex tolerates `.dist` paths. |
  | `kernel/model-policy.mjs:74` | Translates a caller's `.dist/model/<x>.json` spelling to the source record. |
  | `scripts/checks/brand.mjs:280` | Uses `distRoot` (=skillRoot): dead-equivalent fallback; stale comment says "`.dist` wins". |
  | `bin/starci-skills.mjs` | `RETIRED_ROOTS` guard set; `.gitignore` `/.dist/` upgrade protection; `BUILD_ERA_DIRECT_TASK_ENTRY` deliberately reproduces the old prompt for upgrade diffs. |
  | `scripts/checks/check-json-exceptions.mjs:21` | `.dist` in `SKIP_DIR_NAMES` — correct. |
  | `scripts/checks/render.mjs`, `scripts/work-remap-path.mjs` | Regex false positives (`best.distance`, `...distinct`). |
  | Docs/data | `INDEX.yaml`, `MASTER.md`, `README.*`, `UPDATE.yaml`, `upgrades/*`, `.experiments/*`, `schemas/json-exceptions.yaml` (data), `examples/**/.starciwork` historical evidence. |
  | Non-source artifacts | `runtime/engine/builds/<hash>/.dist/**` are immutable pre-migration sealed builds (data); `worktrees/agent-*/runtime/**` is a routed checkout holding an old snapshot — outside the canonical tree. |

## tinkle-23 — E2E evidence

- **Cold boot**: `node bin/starci.mjs --help` exit 0 (prints starci 1.0.4 usage);
  `import('./kernel/kernel.mjs')` → 283 exports; `import('./kernel/engine.mjs')` ok.
  All with no `.dist` present.
- **Route smoke** (`e2e-route-smoke.txt`):
  - `route-op --intent direction --nodeKind ui` → PICK `interface.draw` (score 12), exit 0.
  - `route-op --intent nonsense --nodeKind nonexistent` → exit 1 (correct refusal).
  - `route-model --kind backend.implement` → PICK `qwen-agent` (qwen3.8-flash, probation), exit 0.
  - `route-model --kind integration.verify` → exit 1 (high-risk, no qualification — correct refusal).
  - `route-plan --target "ui.X: verified"` → 10-step chain, exit 0.
  - `route-plan --target "bogus.var: nowhere" --simulate` → exit 1 (correct infeasible).
- **Checks suite**:
  - `check-example-yaml` → **PASS**, 911 YAML files under `examples/` accepted.
  - `check-example-derived` → **PASS**, 2 work trees, all derived indexes fresh.
  - `check-json-exceptions` → **PASS** after w7 fixes (below): 79 exceptions, 0 offenders, exit 0.
  - `check-example-work` → **FAIL exit 1**: 277 records, 54 refused — predominantly
    `CODE_DIGEST_STALE` on pre-migration example evidence (stale code digests stamped
    against old file contents). Example-data staleness, not a code defect; owning
    lane = example content lanes.
  - `check-work-artifacts` → 38 refused (INPUT_BYTES_MOVED=37, ASSET_DIGEST=32, EVIDENCE_ARTIFACT_GHOST=16, ASSET_MISSING=6, RUN_MEDIA_FAKE=6, PROMPT_INPUT_GHOST=2).
  - `check-work-consistency` → 4 refused; `check-work-history` → 40 refused (includes expected UNTRACKED mid-flight records); `check-work-replay` → 4 refused; `check-work-surfaces` → 2 refused; `check-work-deep` → 0 refused.
- **Example gate E2E**: `node --test tests/example-work-gate.spec.mjs` → **29/29 pass** (`e2e-example-gate.txt`).
- **Modules YAML parse**: all **62** `modules/**/*.yaml` parse via `core/yaml.mjs::parseYaml` (`e2e-modules-parse.txt`, exit 0).
- **Full suite** (`e2e-full-specs.txt`): `npm test` → **2410 tests, 2384 pass, 15 fail** post-hold-deletion (earlier run mid-lane: 2169/192 fail, contaminated by `.dist.w7-hold` and pre-w5-fixes). Residual failures are behavioral/w5-scope:
  engine-adapter sealed-delta (2), goal-contract owner weights (1), integration
  v3 relocated package (1), work-artifacts `_local` run-state binding (2), orca
  candidate selection (1), skills companion declaration (1), owner controls (1),
  shared-ledger pinned enrolled run (1, see below), kernel restart input recovery
  (1), audit Work-byte immutability (1), shared-change cross-repo refusal (1),
  runtime ledger launch hold (1).

## w7 code changes

1. `workflows/frontend.mjs` — read operator authority/secondary from source YAML
   (`legacy/ops/<op>/operator.yaml` + `secondary.yaml`) via `authorityFor` from
   `legacy/ops/role-authority.mjs`, replacing reads of removed compiled
   `authority.json`/`secondary.json`. Frontend workflow spec now 15/15.
2. `tests/frontend-workflow.spec.mjs` — relocated-payload fixture now copies
   `legacy/` so `role-authority.mjs` is importable (matches real install payload).
3. `tests/workflow-kernel-shared-ledger.spec.mjs` — `stageSealableRuntime` allowlist
   updated for distless imports: whole `core`, `scripts`, plus `modules`, `hosts`,
   `models`, `cli`, `specifications`, `contracts`, `providers`, `execution`,
   `approvals`, `workflows`, `schemas`. The test now runs end-to-end; its remaining
   failure is semantic (`candidate-root-binding`: pre-pin op references rewritten to
   `authored-runtime/` are outside accepted routed roots after the pin seals and the
   authored tree is renamed away) — needs w5/runtime-owner decision on whether the
   kernel should remap authored-runtime provenance to the sealed build or the fixture
   should re-point references to the relocated tree.
4. `tests/json-exceptions.spec.mjs` — offender fixture path repointed to
   `legacy/builders/tests/fixtures/yaml-dist/json-exceptions-offender`. Spec 5/5.
5. `schemas/json-exceptions.yaml` — removed 36 stale allowlist entries (UAT run
   receipts the harness no longer writes), added 51 honest entries for example/package
   project JSON (package.json, tsconfig*, lockfiles, i18n catalogs, rendered
   environments, lint configs, captured payload assets, storybook output), sorted by
   `localeCompare`. Checker now green.
6. `scripts/checks/check-json-exceptions.mjs` — added `ex-testing` to `SKIP_DIR_NAMES`
   (lint/scratch area, same class as the already-skipped `tests`).
7. Scratch checkers under `ex-testing/lint/scratch/w7/` (check1/1b, 2, 4/4b/4c,
   6/6b/6c, 7, modules-parse) — corrected `ops/`→`legacy/ops/` and `.dist/schemas`
   expectations during the run.

## Needed elsewhere / blockers

- **w5**: finish + write `w5-REPORT.md`/`w5.done`; owns the residual 14 suite
  failures (all behavioral/semantic, see list above) including the shared-ledger
  pinned-retry semantic and the v3 relocated-package integration test.
- **Contract owner**: check-4 `opProduces` vs op `produces`/`consumes` drift and
  the vocabulary-only `implementation.plan` entry.
- **Example content lanes**: `check-example-work` 54 stale-digest refusals and the
  check-work-* refusals are pre-migration evidence bytes, not code defects.
- `runtime/engine/builds/<hash>/.dist/**` sealed historical builds and
  `worktrees/agent-*/` old snapshots still contain `.dist` trees; they are data,
  not source, and were intentionally left untouched.
- `dispatch-op.mjs` header comment "modules/kernel/ has NOT landed yet" is stale
  cosmetic text (modules/kernel/ has landed).
