# R5 — TESTS + FIXTURES + EXAMPLES + KNOWLEDGE + DOCS-QUALITY

Lane: `r5`. Read-only research; nothing moved/edited. Suite baseline (r1):
`node --test tests/*.spec.mjs` → 2410 tests / 2399 pass / 0 fail / 11 skipped.

Method: extracted every static `import`/`import()` specifier from all 181
`tests/*.spec.mjs` + `tests/helpers/*` + `tests/fixtures/*`, mapped each to its
top-level dir, and classified vs the decided architecture (survives:
`kernel/ledger-db.mjs`+`kernel/journal.mjs`, `core/{yaml,runtime-root}.mjs`,
`scripts/{kernel,goal,route,checks,example}/`, `modules/`, `providers/`,
`sqlite/`, `skills/`, `knowledge/`, `init/`; doomed: `kernel/*` other,
`hosts/`, `execution/`, `cli/`, `workflows/`, `contracts/`, `approvals/`,
`models/`, `packages/`, `upgrades/`, `legacy/`). Then re-grep'd KEEP-classified
files for *spawned* script paths (specs that exercise `node scripts/...` via
`spawnSync`) and for transitive doom (kept spec → kept script → doomed import).

## 1. Inventory & verdicts

### 1a. tests/*.spec.mjs — 181 files

**Result: 59 KEEP / 13 CONDITIONAL / 109 DELETE** (approx. test-count split
by `test(` occurrences: keep ≈830, conditional ≈145, delete ≈1447 of ≈2401).

#### KEEP — clean import graph to surviving surface only (59)

Ledger/kernel-api surface (new-architecture tests, mostly k-lane):

| Spec | Verifies |
|---|---|
| `kernel-api.spec.mjs` | `scripts/kernel/api.mjs`: survey/enqueue/dispatch-packet/settle/incident/retire (6 tests) — spawns the script, imports `kernel/ledger-db.mjs` |
| `goal-entry.spec.mjs` | `scripts/goal/define-goal.mjs` + `scripts/kernel/start-workflow.mjs`: --plan read-only, workflow+goal+inbox rows (4 tests) |
| `start-workflow-restart.spec.mjs` | spawns `define-goal` + `start-workflow`; imports `kernel/ledger-db.mjs` |
| `ledger-db.spec.mjs` | `kernel/ledger-db.mjs` (24 tests) |
| `ledger-shape.spec.mjs` | ledger table topology via `kernel/ledger-db.mjs` |
| `ledger-anchor.spec.mjs` | §12 anchor/identity-mismatch refusals via `kernel/ledger-db.mjs` + `_ledger-fixture.mjs` |
| `runtime-tree-hygiene.spec.mjs` | runtime tree rules via `kernel/ledger-db.mjs` |

Checks surface (`scripts/checks/` + `scripts/example/` — all resolve to
`core/yaml.mjs`, `core/runtime-root.mjs`, or intra-checks imports only):

`acceptance-gates`, `application-stacks-kit`, `architecture`,
`architecture-contracts`, `architecture-next-data`, `brand-checks`,
`example-critique`, `example-derive`, `example-evidence`, `example-verify`,
`example-work-gate`, `frontend-source-layout`, `grammar-guards`,
`json-exceptions`, `nest-boundaries`, `nest-code-patterns`,
`nest-error-identity`, `nest-errors`, `nest-identity-aggregate`,
`nest-metadata`, `nest-test-aggregate`, `nest-test-patterns`,
`next-adapter-aggregate`, `next-code-patterns`, `next-error-context`,
`next-error-patterns`, `next-required-value-aggregate`, `render-checks`,
`stacks`, `verify-proof`, `work-artifacts`, `work-change`,
`work-consistency`, `work-replay`, `work-surfaces`, `work-record-schemas`.

Providers/meta/knowledge surface:

`provider-orca` (`providers/validate.mjs` incl. `adapters.{qwen,devin}` cards),
`skills-tree`, `npm-package` (reads `package.json` `files[]` — will need its
expected allowlist rewritten), `code-examples-multifile`
(`knowledge/code-examples/`).

Conditional-looking but actually clean (verified): `grammar-guards` — its
`../runtime/helper.js` hit is fixture *text* written into a temp
`node_modules/@starci/grammar/` tree, not a repo import. String mentions of
`cli/main.mjs`, `bin/starci.mjs`, `hosts/orca/launch.mjs` inside
`brand-checks`, `stacks`, `skills-tree`, `provider-orca`, `index-md`,
`architecture` are fixture/file-content assertions — they survive, but their
expected-content strings will need updating when those paths die.

#### KEEP-IF specifications/ survives — `core/index.mjs` dependents (fold into KEEP if spec validators are kept)

`core/index.mjs` re-exports `specifications/{validate,sds,sds-map,srs-sections,srs-v3}.mjs`
and is imported by kept checks (`check-scoped-lint`, `check-work-history`,
`work-change`, `work-example`) and by:

`acceptance` (+`fixtures/build-workspace.mjs`), `core`, `design-review`
(+`fixtures/sds.mjs`), `index-md`, `module-spec`, `split-freshness`,
`source-identity-completion`, `work-layout`, `work-history-check`,
`work-change`, `architecture-input-scope`, `nest-errors`,
`nest-identity-aggregate`, `nest-test-aggregate`, `next-adapter-aggregate`,
`next-required-value-aggregate`, `check-stales-cli` (via
`check-stales.mjs` → `kernel/source-staleness.mjs`, which itself only needs
`core/index`+`core/yaml` — MOVE to `scripts/checks/` or `engine/`).

Direct specifications specs: `sds`, `sds-map`, `srs-sections`, `srs-v2`,
`specification-vnext`, `source-provenance` — verdict **MOVE** (import-path
rewrite only) iff validators land at `engine/specs/` or
`scripts/checks/specs/`; DELETE iff the spec-document model is dropped.

#### CONDITIONAL — tied to undecided surfaces (13→12 after grammar-guards)

| Spec | Dependency | Verdict |
|---|---|---|
| `application-stacks-integration`, `cli`, `integration` | `bin/starci-skills.mjs` installer (+`core/identity.mjs` sops custody in `cli`) | keep iff installer retained (draft `scripts/install?`); `cli.spec` also carries `fixtures/forward-goal` |
| `config` | `scripts/config/config.mjs` (clean deps; installer dependency) | keep with installer |
| `goal-presentation`, `plan-template` | `scripts/work/{plan,present-goal}.mjs` → **doomed** `workflows/*` | DELETE unless those scripts are ported off `workflows/` |
| `work-remap-path` | `scripts/work/work-remap-path.mjs` — deps clean (`check-example-work`, `example-ownership`) | MOVE with script to `scripts/checks/` or `scripts/work/` |
| `public-package` (currently in DELETE tally) | `workflows/storage.mjs` + installer | rewrite candidate for the new `files[]` allowlist |
| `sds`, `sds-map`, `srs-sections`, `srs-v2`, `specification-vnext`, `source-provenance` | `specifications/*` | MOVE/DELETE per above |

#### DELETE — import doomed surface (109)

`admission`, `approval-policy`, `ask-report`, `authored-work-binding`, `auto`,
`backend-handoff`, `candidate-bridge`, `candidate-multi-root`,
`candidate-reference-resolution`, `candidate-snapshot`, `cli-ledger-commands`,
`code-patterns-cli`, `consolidation`, `continuation-binding`,
`contract-steps`, `coordinator-terminals`, `decision-inputs`, `delegation`,
`dependency-store`, `disk-headroom`, `dispatcher`, `engine-adapter`,
`engine-kernel-flow`, `engine-lifecycle`, `engine-migration`, `entry`,
`execution-api-cli`, `execution-contracts`, `execution-resolve-v3`,
`execution-route`, `flash`, `frontend-workflow`, `goal-contract`,
`goal-grounds-intake-scope`, `graph-invalidation`, `headless-model-registry`,
`hosts`, `implementation-output-binding`, `inrun-aggregate-readiness`,
`intake-continuation`, `io`, `journal-retention`, `kernel-engine`,
`kernel-guards`, `kernel-seams`, `kind-graph`, `launch`, `ledger-migrate`,
`ledger-routing`, `lifecycle-yaml`, `llm-functions`, `loads`,
`luna-allocation`, `maintenance-regressions`, `manager-contract`,
`model-policy`, `orca-adapter`, `orca-calls`, `orca-execution`,
`orca-headless`, `orca-supervised-launch`, `owner-requests`,
`pattern-coverage`, `plan-coverage`, `profiles-assets`, `provider-observe`,
`public-package`, `reconciliation`, `reports`, `review-epoch`,
`runtime-allocator`, `runtime-budget`, `scoped-evidence-publication`,
`scoped-lint` (imports `kernel/audit.mjs`; `check-scoped-lint.mjs` itself is
still covered by the nest/next-aggregate specs), `solo-execution`,
`source-check-operations`, `source-layout`, `source-staleness`,
`specifications`, `standalone-workflow`, `store`, `supervision`,
`supervisor`, `tab`, `trace`, `verify-required`, `w1-reconcile`,
`w2-parallel-writers`, `w3-ops-view`, `w4-fanout`, `w5-retry-coverage`,
`work-ledger`, `work-status`, `work-verdict`, `workflow-amendment`,
`workflow-continuation`, `workflow-entry-audit`, `workflow-first-enrollment`,
`workflow-inputs`, `workflow-kernel`, `workflow-kernel-lanes`,
`workflow-kernel-shared-ledger`, `workflow-manager`,
`workflow-manager-integration`, `workflow-progress`, `workflow-restart`,
`workflow-routing`, `workflow-store`, `workflow-view`.

Salvage notes: `journal-retention`, `kernel-engine`, `engine-lifecycle`,
`w5-retry-coverage`, `store` all exercise `ledger-db.mjs`/`journal.mjs`
through old-engine scaffolding — the surviving behavior (retention,
`reclaimSpace`, job lifecycle rows) needs re-covering in new specs rather
than file-level salvage. `admission.spec` is half ledger-db, half
`kernel/admission.mjs` — DELETE; admission as a concept is replaced by
`api.mjs`'s transaction boundary.

### 1b. tests/helpers/, tests/_ledger-fixture.mjs, tests/fixtures/

| File | Importers | Verdict |
|---|---|---|
| `_ledger-fixture.mjs` | `ledger-anchor`, `work-change` (keep) + 7 doomed | **KEEP** |
| `helpers/read-public.mjs` | `provider-orca` (keep) + 13 doomed | **KEEP** |
| `helpers/png.mjs` | `render-checks`, `work-artifacts` (keep) + 2 doomed | **KEEP** |
| `helpers/kernel-harness.mjs` | 4 doomed workflow-kernel specs | DELETE |
| `helpers/input-fixture.mjs` | 3 doomed | DELETE |
| `helpers/pools.mjs` | `goal-contract` (doomed) | DELETE |
| `helpers/fake-sops.mjs` | `cli` only | DELETE (sops custody is old-surface) |
| `fixtures/nested-business/` | `design-review` (keep) + 4 soft/doomed | **KEEP** |
| `fixtures/source-provenance-business.json` | `source-provenance` | keep iff that spec moves |
| `fixtures/nivo-setup/` | `specifications` (doomed) | DELETE |
| `fixtures/orca/live-1.4.188` | `orca-*`, `workflow-inputs` (doomed) | DELETE |
| `fixtures/quality-source.spec.mjs` | referenced by `cli.spec` as fixture content; **not run** by the `tests/*.spec.mjs` glob | DELETE |

### 1c. Root `fixtures/` → `tests/fixtures/` merge — exact rewrite sites

| Fixture | Import sites (the whole list — these are the only importers repo-wide) |
|---|---|
| `build-workspace.mjs` | `tests/acceptance.spec.mjs`, `tests/cli.spec.mjs` (`../fixtures/build-workspace.mjs` → `../tests/fixtures/…` or `./fixtures/…`) |
| `sds.mjs` | `authored-work-binding`, `design-review`, `sds`, `specification-vnext` |
| `srs-v3.mjs` | `specification-vnext` |
| `srs-v3-workspace.mjs` | `specification-vnext` |
| `forward-goal/draft/` | `cli.spec.mjs:288` (`fs.cpSync` of `../fixtures/forward-goal/draft`) |
| `forward-goal-report.yaml` | **no importer found** — orphan, DELETE |

If `cli.spec`/`authored-work-binding`/`specification-vnext` die, their
fixtures die with them; only `build-workspace.mjs` + `sds.mjs` are needed by
KEEP/conditional specs. Also note: several specs already resolve
`fixtures/...` to `tests/fixtures/` — the two-level fixture layout is itself
a wart the merge fixes.

### 1d. examples/

- `todo-app-backend/` — **KEEP, flagship**. 817 tracked `.starciwork` files
  (evidence bundle validated by `check-example-work` — 277 records green per
  r2), plus `gateway/nginx.conf`, `ex-testing/`, `.starcistacks`. Junk to
  clean: `scripts/notify-queue-live-check.cjs` (one-off live probe),
  `ex-testing/negative/_evidence/`, `lf.json`/`lt.json` scratch at root.
  `node_modules/`, `dist/`, `coverage/` are untracked — fine.
- `ecommerce-app-be/` — **KEEP** (second reference; 178 tracked
  `.starciwork` evidence files, `.starcistacks`, sonar/coverage lane
  artifacts untracked).
- `todo-app-frontend/`, `ecommerce-app-fe/` — **no `.starciwork`**; source
  references only. Keep only if checks/docs reference them (verify in r3's
  pass); otherwise they are half of a BE/FE pair the evidence doesn't cover.
- `package.json` `files[]` ships all of `examples/` — decide whether the
  995 tracked evidence files belong in the npm payload (see §4).

### 1e. knowledge/ — 99 files, authored-only. One-line verdicts:

- `index.yaml` — catalog root; KEEP.
- `application-stacks.yaml`, `architecture-rules.yaml`,
  `code-pattern-enforcement.yaml`, `coding-reference.yaml`,
  `design-patterns.yaml` — authored rules referenced by `SKILL.md` and
  `scripts/checks/stacks.mjs`/`code-patterns`; KEEP.
- `code-examples/{backend,frontend}/` — canonical multi-file examples
  guarded by `code-examples-multifile.spec.mjs` + `schemas/code-example-*`;
  KEEP.
- `grammars/{common,starci}/` — UI grammar DNA/idioms/playbook for
  `interface.draw`; references `.starciwork` correctly (survives); KEEP.
- `patterns/{be,fe}/` — executable code-pattern rules consumed by
  `scripts/checks/code-patterns/*`; KEEP.
- `ui/{composition,presentation,proof}/` — design vocabulary; KEEP.
- Staleness check: **no references to `kernel.mjs`, `workflows/`, `hosts/`,
  `execution/`** anywhere under `knowledge/` — nothing misleads vs the new
  architecture. All `.starciwork` mentions remain correct.

### 1f. Test infrastructure

- Runner: `package.json` → `"test": "node --test tests/*.spec.mjs"`. **No
  jest/vitest config at root.** `jest.config.js`/`vitest.config.ts` exist
  only inside `examples/*` apps; nest/next specs synthesize their own
  `node_modules/jest` fixtures in tmp dirs.
- `devDependencies` `@nestjs/*`, `@jest/globals`, `typescript`, `ajv`,
  `next`, `swr` are still needed by the kept nest/next/architecture check
  specs (they compile/parse fixture sources). Do not strip with the cut.
- Convention worth documenting in CONTRIBUTING: flat `tests/*.spec.mjs`,
  `node:test`, tmp-dir fixture builders, no real network/process effects
  outside spawned `scripts/*` under test.

## 2. Single-source-of-truth violations

1. **Ledger DDL ×3(+1)**: `kernel/ledger-db.mjs` `LEDGER_DDL` inlined ⇄
   `sqlite/schema.sql` ("extracted VERBATIM") ⇄ `schemas/ledger-db.schema.yaml`
   ⇄ prose in `docs/ledger-db.md` §4. schema.sql's own header admits the
   duplication. Draft HFS puts "sqlite schema-as-data" in `engine/` — make
   `engine/schema.sql` canonical and have ledger-db load it, plus a parity
   spec (see §3).
2. **Ops catalog ×2**: `modules/ops/ops/*.yaml` (29 manifests) vs
   `legacy/ops/*/operator.yaml` + `legacy/ops/common.yaml` — legacy dies;
   verify no `modules/ops` manifest still cites a `legacy/ops` id.
3. **fixtures/ at root vs tests/fixtures/** — two fixture homes; merge per §1c.
4. **CLI surface ×3**: `bin/starci.mjs` (dispatcher→launcher),
   `bin/starci-skills.mjs` (installer), `cli/main.mjs` — three help texts,
   three command vocabularies; new model needs one install entry.
5. **Doc/model conflict**: `docs/architecture.md`, `docs/workflow-kernel.md`,
   `docs/execution-agent-model.md` describe the *deterministic* kernel
   ("kernel owns state; bounded model functions choose offered actions")
   while `README.md`/`SKILL.md` describe the LLM-agent kernel + `api.mjs`
   gate. Both can't be canon — the docs are stale, not the code.
6. **`schemas/` (root, ~40 JSON schemas) vs `modules/schemas/` (2 yaml)** —
   two "schemas" homes; r3/schema lane should merge under `modules/schemas/`
   or `engine/`.

## 3. New-surface coverage gaps — specs to write

Existing: `kernel-api`, `goal-entry`, `start-workflow-restart`,
`ledger-db/shape/anchor`, `runtime-tree-hygiene`, `provider-orca`.

Missing (proposed names):

- `goal-assess.spec.mjs` — `scripts/goal/assess.mjs` cold-scan → enriched
  goal draft; assert read-only `--plan` and no ledger writes.
- `route-model.spec.mjs` — `scripts/route/route-model.mjs`, incl. `--plan`
  read-only and kind `model.manageWorkflow` routing to a profile.
- `route-op.spec.mjs` + `route-plan.spec.mjs` — op selection from
  `modules/ops/ops/*.yaml` `route:` keys; plan ordering.
- `ops-registry.spec.mjs` — `build-ops-registry.mjs`: every manifest's route
  resolves to a `modules/models` profile; no dangling kinds.
- `dispatch-spawn.spec.mjs` — `api.mjs dispatch --spawn`: Orca terminal
  spawn argv assembled from `providers/orca/adapters/*.yaml` (kernel-api
  covers only the un-spawned packet).
- `adapter-cards.spec.mjs` — each adapter card's spawn flags/env/model map
  validate against `providers/common/envelopes.yaml`.
- `verdict-contract.spec.mjs` — `modules/kernel/verdict-contract.yaml`
  enforced by `settle` (pass/fail/blocked; bad verdict exits 2).
- `journal.spec.mjs` — `kernel/journal.mjs` (→`engine/`): hash chain,
  `sqliteAtLeast`, `RETENTION`, `reclaimSpace` — today only covered inside
  doomed `journal-retention`/`kernel-engine`.
- `ledger-schema-parity.spec.mjs` — `engine/schema.sql` ≡ DDL actually
  applied by `openLedger` (the SSOT fix's guard rail).
- `entry-skills.spec.mjs` — define-goal/start-kernel entry contract +
  `SKILL.md` load order (partially in `skills-tree`).

## 4. Docs that SHOULD exist (open-source "wow" set) + mapping

Minimal set:

| Doc | Status |
|---|---|
| `README.md` quickstart | exists, already describes kernel-agent+`api.mjs` model; fix stale tree listing (`scripts/{work,ledger,config}`) |
| `docs/architecture.md` | **rewrite** — currently documents old host/source-routing + deterministic kernel; should be the kernel-agent/api/ops model (one page: agent ↔ api.mjs ↔ ledger ↔ op terminals) |
| `docs/ledger.md` | rename/adapt `docs/ledger-db.md` — it is already the schema walk; trim §13 cutover notes to a migration appendix |
| `docs/ops.md` | **new** — op manifest anatomy (`modules/ops/ops/*.yaml`: route, io, verdict) — the "write your own op" doc |
| `docs/providers.md` | adapt `providers/README.md` + `docs/orca-execution.md` — adapter card contract |
| `CONTRIBUTING.md` | **missing** — test conventions (§1f), evidence re-record policy (r2's rule: re-run, never hand-edit), checks layout |
| `CHANGELOG.md` | **missing** — `docs/releasing.md` covers process, not history |
| `docs/examples/` | keep `todo-app-standard.md`; `grit/`, `v4-live-proof/` are lane artifacts — r3 to triage |

Everything else under `docs/` (~55 files: `workflow-*`, `execution-*`,
`scoped-*`, `work-*`, `nest-*-check.md`, `5-plus.md`, `v5-plan.md`) documents
the old engine — r3 owns the per-file calls, but from the quality side none
of them belongs in the minimal open-source set; at most a
`docs/legacy-concepts.md` pointer during transition.

## 5. HFS critique (my surface)

- `engine/` must explicitly absorb **`kernel/journal.mjs`** (ledger-db's
  only intra-kernel dep) and a decision on **`specifications/*.mjs` +
  `core/index.mjs`** — ~20 kept specs transit on them. Suggest
  `engine/{ledger-db,journal,yaml,runtime-root,specs/}.mjs`.
- `kernel/source-staleness.mjs` is a checks helper misfiled under `kernel/`
  — move to `scripts/checks/` so `check-stales` survives.
- `tests(+fixtures/)` should also state the runner convention
  (`node --test tests/*.spec.mjs`, no jest at root) and own
  `tests/helpers/` + `_ledger-fixture.mjs` explicitly.
- `scripts/install?` is marked optional, but `bin/starci.mjs` +
  `bin/starci-skills.mjs` + `scripts/config/` + `init/` + 4 specs hang off
  it — the draft needs a real home for the installer (recommend
  `scripts/install/` + keep `bin/starci.mjs` as thin entry).
- Draft omits `fixtures/` merge (root→`tests/fixtures/`), `CONTRIBUTING.md`,
  `CHANGELOG.md`, and an `examples/` shipping policy (995 tracked evidence
  files, 72M working tree under `todo-app-backend` — decide if evidence
  ships in `files[]` or is regenerated by a check).
- `package.json` `files[]` still lists `workflows/`, `hosts/`, `cli/`,
  `contracts/`, `approvals/`, `execution/`, `legacy/ops`, `packages` —
  `npm-package.spec.mjs` is the guard that must be rewritten with the new
  allowlist.
