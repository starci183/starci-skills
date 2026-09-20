# R1 — ENGINE SURFACE REPORT (kernel/, core/, sqlite/, runtime/, worktrees/, deps)

Lane: `r1`. Read-only research; nothing moved/edited/deleted, no commits.
Method: traced the real import graph from the NEW entry points (`scripts/kernel/api.mjs`,
`scripts/kernel/start-workflow.mjs`, `scripts/goal/{define-goal,assess}.mjs`,
`scripts/route/*.mjs`, `scripts/checks/**`), then built a full reverse-importer map
for all 67 `kernel/*.mjs` files and every `core/` file.

## 0. Headline

Of 67 files in `kernel/`, the new surface reaches exactly **3** —
`ledger-db.mjs`, `journal.mjs` (via ledger-db), `source-staleness.mjs` (via
`check-stales.mjs`). A 4th, `common.mjs`, is load-bearing only for one constant
(`ENGINE_SCHEMA`) consumed by the installer `bin/starci-skills.mjs`. Everything
else is imported exclusively by files that are themselves scheduled for deletion
(`hosts/`, `cli/`, `models/`, `workflows/`, `legacy/`, `scripts/ledger/`,
`scripts/work/`) or by the old-engine test suite.

**The live import subgraph of the new architecture (complete):**

```
scripts/kernel/api.mjs            -> kernel/ledger-db.mjs, core/yaml.mjs
scripts/kernel/start-workflow.mjs -> kernel/ledger-db.mjs, core/yaml.mjs
scripts/goal/define-goal.mjs      -> kernel/ledger-db.mjs          (+ fs reads of modules/, .workspaces/)
scripts/goal/assess.mjs           -> (node builtins only)
scripts/route/route-model.mjs     -> core/yaml.mjs                 (+ fs reads of modules/models/**)
scripts/route/route-op.mjs        -> core/yaml.mjs
scripts/route/route-plan.mjs      -> core/yaml.mjs, scripts/example/example-ownership.mjs
scripts/route/dispatch-op.mjs     -> core/yaml.mjs, scripts/example/example-ownership.mjs
scripts/route/build-ops-registry  -> core/yaml.mjs
kernel/ledger-db.mjs              -> kernel/journal.mjs            (newToken, sqliteAtLeast, SETTLED_JOB_STATUSES, RETENTION, reclaimSpace)
kernel/journal.mjs                -> node builtins only
scripts/checks/check-stales.mjs   -> kernel/source-staleness.mjs
kernel/source-staleness.mjs       -> core/index.mjs, core/yaml.mjs
core/index.mjs                    -> core/yaml.mjs, core/runtime-root.mjs, specifications/{validate,sds,sds-map,srs-sections,srs-v3}.mjs
specifications/srs-sections.mjs   -> core/policy-options.mjs
other scripts/checks/**           -> core/yaml.mjs (14 files), core/index.mjs (canonicalJSON/sha256), core/runtime-root.mjs (skillRoot/readDistJson), contracts/journeys.mjs, specifications/*.mjs
scripts/example/**                -> core/yaml.mjs, core/runtime-root.mjs, scripts/checks/{check-example-work,render}.mjs
```

`node:sqlite` (`DatabaseSync`, via `createRequire`) is the only non-trivial
runtime mechanism — zero npm packages are imported by any surviving runtime file.

---

## 1. Per-file / per-dir inventory with verdicts

### 1a. `kernel/` — 67 files (all tracked in git)

Legend: "external importers" = non-kernel files that import it (evidence).

| file | verdict | evidence |
|---|---|---|
| `ledger-db.mjs` (607 ln) | **MOVE → `engine/ledger-db.mjs`** | Imported by `scripts/kernel/api.mjs`, `scripts/kernel/start-workflow.mjs`, `scripts/goal/define-goal.mjs` (live), plus `scripts/ledger/ledger-migrate.mjs`, `hosts/orca/launch.mjs`, ~30 old-surface specs. THE live store: LEDGER_DDL, MACHINE_DDL, openLedger/openMachine/inspectLedger, anchors, verifyChain, inputs, retention. |
| `journal.mjs` (203 ln) | **MERGE helpers → `engine/ledger-db.mjs`; DELETE journal reader half** | ledger-db.mjs imports `{newToken,sqliteAtLeast,SETTLED_JOB_STATUSES,RETENTION,reclaimSpace}` from it — deleting journal.mjs as-is **breaks the live ledger**. Its reader half (`inspectJournal`/`openJournal`/`journalFileFor`/journal `migrate()`) serves only `scripts/ledger/ledger-migrate.mjs` + journal-era specs. |
| `source-staleness.mjs` (312 ln) | **MOVE → `scripts/checks/` (its only live consumer's turf) or `engine/`** | Imported only by `scripts/checks/check-stales.mjs` (+ `tests/source-staleness.spec.mjs`). Imports `core/index.mjs` + `core/yaml.mjs`. Nothing kernel-shaped about it — it's a check implementation. |
| `common.mjs` | **MERGE `ENGINE_SCHEMA` (and only it) into `engine/` constants or the installer; DELETE file** | `bin/starci-skills.mjs` imports `ENGINE_SCHEMA` alone. But common.mjs itself imports `hosts/orca/calls.mjs`, `modules/models/index.mjs`, `kernel/routing.mjs`, `graph.mjs`, `io.mjs`, `audit.mjs` — keeping it whole drags the old engine in through the installer. All other importers are old-surface tests/yamls. |
| `kernel.mjs` (monolith) | DELETE | Old kernel loop; imported by hosts/orca/launch.mjs + ~24 old specs only. |
| `engine.mjs` | DELETE | Old durable engine; only old specs + none in new surface. Cited by `modules/kernel/verdict-contract.yaml` (data ref, stale after cut). |
| `store.mjs` | DELETE | Old store API over the ledger; importers: hosts/orca/{launch,protocol}, scripts/ledger/ledger-migrate, ~30 specs. |
| `ledger.mjs` | DELETE | **Not the sqlite ledger** — the Work-tree YAML ledger (`.starciwork/features/**`). New arch persists goals in runtime.sqlite; Work-tree machinery is old surface. Importers: 4 specs; cited by `modules/goal/*.yaml`. |
| `admission.mjs`, `jobs.mjs`, `job-worker.mjs`, `job-bridge.mjs`, `job-reconcile.mjs`, `job-attestation.mjs`, `job-model-worker.mjs`, `dispatcher.mjs`, `scheduler.mjs`, `schedule.mjs`, `lanes.mjs` | DELETE | Old admission/queue/dispatch machinery. New dispatch = `api.mjs dispatch` + `scripts/route/dispatch-op.mjs`. Importers: old specs only. |
| `supervisor.mjs`, `terminals.mjs`, `launch.mjs`, `runtime-pin.mjs`, `tab.mjs`, `view.mjs`, `progress.mjs`, `work-status.mjs` | DELETE | Old host/supervisor/view layer. New spawn = Orca terminals via api.mjs. Importers: hosts/, cli/, specs. `runtime-pin.mjs` is the sealer that produced `runtime/engine/builds/*` — see §4; pinning is an old-engine concept (kernel is now an LLM agent, not a sealed binary). |
| `owner.mjs`, `owner-inbox.mjs`, `owner-requests.mjs`, `ask.mjs`, `decision-inputs.mjs`, `intake.mjs`, `inputs.mjs`, `inputs-{model,server,ui,components,readiness,replacement}.mjs`, `fill.mjs`, `guards.mjs` | DELETE | Old owner-IPC/inputs-form machinery. New inbox = ledger `inbox`/`signals` tables via api.mjs. Importers: specs only. |
| `contract.mjs`, `verify.mjs`, `audit.mjs`, `sync.mjs`, `trace.mjs`, `reports.mjs`, `reconciliation.mjs`, `continuation.mjs`, `amendment.mjs`, `goal.mjs`, `graph.mjs`, `graph-invalidation.mjs`, `io.mjs`, `routing.mjs`, `chains.mjs`, `candidates.mjs`, `candidate-roots.mjs`, `candidate-bridge.mjs`, `dependency-store.mjs`, `disk.mjs`, `loads.mjs`, `model-policy.mjs`, `budget.mjs`, `manager.mjs`, `journal-maintenance.mjs` | DELETE | Old engine concerns. External importers are exclusively: `hosts/orca/launch.mjs`, `hosts/orca/protocol.mjs`, `hosts/headless/host.mjs`, `cli/main.mjs`, `models/functions.mjs`, `workflows/lifecycle.mjs`, `legacy/ops/validate.mjs`, `scripts/ledger/ledger-migrate.mjs`, and the old test suite — every one itself a delete candidate. Zero files with **no** external importer are reachable either (`graph-invalidation.mjs`, `inputs-components.mjs`, `inputs-ui.mjs`, `job-model-worker.mjs` are kernel-internal only). |

Net: **3 keepers + 1 constant** out of 67.

### 1b. `core/` — 7 files (all tracked)

| file | verdict | evidence |
|---|---|---|
| `yaml.mjs` (7377 ln) | **KEEP → `engine/yaml.mjs`** | esbuild-bundled npm `yaml` (vendored; header proves it). ~130 importers across every live script. Zero-dep — this is why the runtime needs no `dependencies`. |
| `yaml-license.json` | KEEP beside yaml.mjs | license payload of the vendored bundle. |
| `runtime-root.mjs` (120 ln) | **KEEP → `engine/runtime-root.mjs`** | `skillRoot`/`distPath`/`readDistJson`; imported by scripts/checks/{brand,check-scoped-lint}, scripts/example/work-example, scripts/{work,config} (old). HFS already names it for engine/. |
| `index.mjs` (869 ln) | **KEEP → `engine/index.mjs` (flagged)** | `canonicalJSON`, `sha256`, `validateWorkspace`, `evidenceStagingRoot` used by check-stales→source-staleness and checks {check-scoped-lint, check-work-history, work-change}. BUT it imports 5 `specifications/*.mjs` files — it is not a leaf helper; see §2/§4. |
| `policy-options.mjs` (6 ln) | **KEEP → `engine/policy-options.mjs` or fold into index.mjs** | Live via `specifications/srs-sections.mjs` (reached through core/index.mjs ← checks). Other importer `kernel/decision-inputs.mjs` dies. |
| `identity.mjs` (328 ln) | **DELETE** | sops/age credential-custody writer (`_resources/identity/**/secrets.enc.yaml`). Only importers: old kernel (kernel.mjs, goal.mjs, inputs.mjs), cli/main.mjs, hosts/orca/launch.mjs, models/functions.mjs, workflows/*, 2 specs. New arch has no credential-custody writer in-tree. |
| `README.yaml` | **MOVE → `docs/` or `modules/schemas/`** | Pure context doc (canonical Work layout prose). Not code; belongs with docs, not engine/. |

### 1c. `sqlite/` — 15 files (all tracked)

| file | verdict | evidence |
|---|---|---|
| `schema.sql` (313 ln) | **MOVE → `engine/schema.sql`, promoted from "verbatim extract" to the EXECUTED source** | Byte-for-byte mirror of `LEDGER_DDL`+`META_TABLE_DDL`+`EVENTS_DIGEST_TRIGGER` (self-declared, header ln 1-6). Today docs-only; nothing executes it. See §3. |
| `machine.sql` (66 ln) | **MOVE → `engine/machine.sql`** | Mirror of `MACHINE_DDL` (ledger-db.mjs:324-335). |
| `design.yaml` (280 ln) | **MOVE → `docs/` (or `engine/design.yaml`)** | The ERD: per-table purpose/keys/invariants/edges + observed gaps. Accurate and valuable, but its `sources:` list cites ~15 dead kernel files — needs a citation refresh at cut time. |
| `index.yaml` | **MERGE into docs/ or DELETE** | Reader's guide to the directory above; if the dir dissolves into engine/+docs/, the index folds into a short `docs/ledger-db` section. Also cites dead files. |
| `queries/*.sql` (12 files) | **DELETE (or MOVE to docs/ after rewrite)** | Verified: **zero code references** — pure agent-facing documentation of statement shapes. Worse, they document the OLD writers (`admission.mjs::setBudget`, `store.mjs::inbox.push`, `jobs.mjs` queue lifecycle) — after the cut they'd be a catalog of dead code. The live statements now live in api.mjs + ledger-db.mjs; if kept, they must be re-extracted from those two files only. |

### 1d. `runtime/` — untracked local state

- `.gitignore` `/runtime/` covers it; `git ls-files runtime/` → **0 tracked files**. Confirmed local-only.
- Content: `runtime/engine/builds/<sha256>/.dist/**` — sealed runtime-pin payloads produced by old `kernel/runtime-pin.mjs` (the `.dist` snapshots of the pre-distless tree, complete with `checks/`, `cli/`, `contracts/`, `core/` copies). Also referenced by the `RUNTIME_MARKER` fallback in ledger-db.mjs:23 (`fs.existsSync('.dist/kernel/ledger-db.mjs')` — legacy-payload recognition).
- Verdict: **not part of the tree** — local state, safe to delete at will. In the cut: keep `/runtime/` in .gitignore; drop the `.dist` marker clause when the last pre-distless pin ages out.

### 1e. `worktrees/` — parent-repo checkouts, untracked here

- `git ls-files worktrees/` → **0**; `.gitignore` `worktrees/` covers it. Nothing here is tracked in `.claude`'s own repo — confirmed.
- Contents: **6 real git worktrees of the PARENT repo** (`D:/Repositories/starci-academy-backend`), each with a `.git` file pointing at `D:/Repositories/starci-academy-backend/.git/worktrees/<name>`:
  - `agent-a75cd99400d6ba88a` → branch `worktree-agent-a75cd99400d6ba88a` @ f4420ea12
  - `dazzling-tereshkova-dafe3b`, `dreamy-margulis-c127b7`, `exciting-chebyshev-292790`, `goofy-chatterjee-f38403`, `laughing-williamson-09b564` → branches `claude/*` @ 19a2a50c4
  - All appear in the parent's `git worktree list` (verified).
- Plus `worktrees/_briefs/` — a **plain directory** (no `.git` file; resolves to `.claude`'s own gitdir) holding `w1.md`–`w7.md` research briefs — scratch input for the earlier w-lane wave.
- **Safe removal procedure** (for whoever executes; NOT done here):
  1. From the parent repo: `git -C D:/Repositories/starci-academy-backend worktree remove --force .claude/worktrees/<name>` for each of the 6. Deleting the dirs by hand also works but leaves stale admin entries in the parent's `.git/worktrees/` until `git -C <parent> worktree prune`.
  2. Optionally delete the leftover branches (`worktree-agent-*`, `claude/*`) if their commits are merged/abandoned — that's a parent-repo decision.
  3. `worktrees/_briefs/` is a plain `rm -rf` once the w-lanes' outputs are harvested.
  4. Never delete from inside `.claude`'s own git — it owns none of this.

### 1f. `node_modules/` — install surface only

146 top-level entries, all from `devDependencies` (jest/nest/next/esbuild/typescript/yaml/ajv/swr ecosystems). Gitignored. Nothing here ships — but see §5 for which devDeps the surviving tree actually needs.

---

## 2. Single-source-of-truth violations found

1. **Ledger DDL ×5**: `kernel/ledger-db.mjs` `LEDGER_DDL` (executable) ≡ `sqlite/schema.sql` ("extracted VERBATIM") ≡ `docs/ledger-db.md` §4 CREATE TABLEs ≡ `schemas/ledger-db.schema.yaml` (column catalog — self-described "executable twin is kernel/ledger-db.mjs CREATE TABLEs … silent drift is a bug") ≡ `sqlite/design.yaml` (ERD). A test (`tests/execution-contracts.spec.mjs`) enforces catalog↔mjs sync — proof the drift is real and was caught by convention, not structure.
2. **Machine DDL ×3**: `MACHINE_DDL` ≡ `sqlite/machine.sql` ≡ `docs/ledger-db.md` §5.
3. **Retention/queue algorithms ×2**: `journal.mjs` and `ledger-db.mjs` carry the same `compactSnapshots`/`pruneRetiredGenerations`/`liveRows`/`retireWorkflow` bodies — ledger-db's are annotated "ported whole from journal.mjs".
4. **`digestOf` ×2**: ledger-db.mjs's private digest mirrored in `scripts/ledger/ledger-migrate.mjs:22` ("not exported, so it is mirrored here").
5. **`runtimeRootFor` ×3**: identical `LOCALAPPDATA||~/.local/state` + `StarCi/runtime` resolution in `ledger-db.mjs:32`, `journal.mjs:19`, `engine.mjs` (per comments, deliberately copied to avoid the import).
6. **ORCA binary resolution ×2+**: the `where.exe orca` → `orca.exe` dance is duplicated in `api.mjs:36-45` and `start-workflow.mjs:34-47` (start-workflow adds `STARCI_ORCA_COMMAND`/`STARCI_ORCA_ARGS` env overrides api.mjs lacks — the two copies have already diverged).
7. **Op packet builder ×2**: `api.mjs buildPacket` replicates `scripts/route/dispatch-op.mjs`'s unexported builder "same fields, same returns contract" (comment at api.mjs:240-241).
8. **Provider spawn commands ×2**: `start-workflow.mjs` `PROVIDER_CMD` hardcoded map vs `providers/orca/adapters/*.yaml` command fields — the yaml is canonical per the comment, the map is the drift-able fallback.
9. (Intentional, defensible) events digest exists in JS (`digestOf`), SQL trigger (`events_digest_chain`), and registered fn (`starci_sha256`) — a redundancy that *enforces* the invariant; keep, but name it as the sanctioned exception.

---

## 3. Recommended single-source shape for the schema

`sqlite/schema.sql` + `machine.sql` are already verbatim extracts — the cheapest
correct end-state is to make them **the** source:

- `engine/schema.sql`, `engine/machine.sql` hold the DDL as data.
- `engine/ledger-db.mjs` reads and `db.exec()`s them inside `migrateLedger`/
  `migrateMachine` instead of holding `LEDGER_DDL`/`MACHINE_DDL` strings
  (the `${EVENTS_DIGEST_TRIGGER}` interpolation becomes a plain file or a
  second file `engine/triggers.sql`; `META_TABLE_DDL` stays a named export or
  moves into the file — the schema-catalog test's single-occurrence scan must
  be retargeted, it currently greps the .mjs).
- `docs/ledger-db.md` §4/§5 and `schemas/ledger-db.schema.yaml` then either
  generate FROM the .sql or shrink to prose that cites it. The catalog test
  becomes a sql↔catalog check.
- `sqlite/queries/*`: do not rehome as-is — they document dead writers. Either
  delete, or regenerate a slim `docs/ledger-queries.md` extracted from
  `api.mjs` + `ledger-db.mjs` statements only.

---

## 4. .gitignore surface for the open-source cut

Present and still needed: `node_modules/`, `__pycache__/`, `/runtime/`,
`worktrees/`, `settings.local.json`, `resources/settings.json`, `/config.json`,
`/scheduled_tasks.lock`, `dist/`, `/.dist*/`, `/.venv/`, `/mcp/`.

Missing / reconsider:

- **`.starciwork/`** — not ignored anywhere here (fine — the runtime refuses to
  be a Work root by `RUNTIME_MARKER`), but the **installed product** writes
  `.starciwork/runtime.sqlite` + `ledger-anchor.json` into consumer repos; the
  `init/` templates or docs must tell consumers to ignore `.starciwork/` —
  currently `init/{AGENTS,CLAUDE,DEVIN}.md` don't mention gitignore at all.
- `.starci-wk-spec-*/` scratch dirs exist at root (untracked); decide ignore or
  sweep.
- `/sites/docs/.next/` etc. — stale: `sites/` doesn't exist (also stale in
  package.json `files[]`).
- `ex-testing/` (200+ report/scratch files) and `.experiments/` — not in
  `files[]` so they never ship; keep them untracked-but-present or strip before
  cut. Not a gitignore problem, a hygiene one.

---

## 5. package.json — minimal dep surface for the new tree

Runtime code imports **zero** npm packages (node builtins + vendored yaml
bundle + `node:sqlite`). `engines.node >=22.13.0` is exactly right — that's the
release where `node:sqlite` went unflagged.

devDeps actually consumed:

| dep | real use | verdict |
|---|---|---|
| `ajv` | real `import Ajv2020` in 5 specs (execution-contracts, scoped-lint, source-staleness, specification-vnext, next-adapter-aggregate) | keep if those specs keep |
| `yaml` + `esbuild` | only to rebuild `core/yaml.mjs` via `legacy/builders/build-yaml.mjs` — **whose entry `scripts/yaml-source.mjs no longer exists** (bundle is frozen) | keep as optional dev tooling OR drop with legacy/ |
| `typescript`, `next`, `swr`, `@nestjs/*`, `@jest/globals`, `@types/jest` | **never imported by real code** — they appear only inside fixture source strings in pattern/architecture specs, and as `createRequire(fixturePkg).resolve('swr'|'eslint'|...)` targets: checks resolve the *fixture repo's* deps, which walk up into `.claude/node_modules` | needed only if the architecture/pattern check suite ships; document them as "fixture resolution targets", not libs |
| `scripts.test` | `node --test tests/*.spec.mjs` — 181 spec files, overwhelmingly old-surface | keep the runner; the spec set gets pruned by the tests lane. Specs that exercise ONLY surviving engine files: `ledger-db`, `ledger-shape`, `ledger-anchor`, `kernel-api`, `goal-entry`, `source-staleness`, `check-stales-cli`, `start-workflow-restart`, `runtime-tree-hygiene` (+ shared helpers `_ledger-fixture.mjs`, `helpers/`) |
| `files[]` | contains dead entries: `sites/**` (dir absent), `hosts/`, `models/`, `upgrades/`, `approvals/`, `execution/`, `contracts/`, `specifications/`, `workflows/`, `legacy/ops/`, `cli/`, `fixtures/` | rewrite to the HFS: `engine/`, `modules/`, `providers/`, `schemas/`, `skills/`, `init/`, `knowledge/`, `docs/`, `examples/`, `tests/`, `scripts/`, `bin/` (if installer ships), `SKILL.md`, `README.*`, `LICENSE`, `VERSION`, `config.example.yaml`, `UPDATE.yaml`?, `INDEX.yaml`? |
| `bin.starci` → `bin/starci.mjs` | forwards to `hosts/orca/launch.mjs` (dead surface) | rewire to the new surface (a thin dispatcher onto `scripts/kernel/api.mjs` + `start-workflow.mjs`) or drop the bin entry; `bin/starci-skills.mjs` (the `npx starci init` installer) stays but needs `ENGINE_SCHEMA` rehomed and `PAYLOAD` = new files[] |

---

## 6. Proposed canonical targets (consistent with draft HFS)

```
engine/ledger-db.mjs        <- kernel/ledger-db.mjs + the 5 journal.mjs helpers inlined
engine/journal-reader.mjs?  <- ONLY if ledger-migrate ships; else deleted with it
engine/schema.sql           <- sqlite/schema.sql (executed, not just read)
engine/machine.sql          <- sqlite/machine.sql (executed)
engine/triggers.sql?        <- EVENTS_DIGEST_TRIGGER if it leaves the .mjs
engine/yaml.mjs             <- core/yaml.mjs (+ yaml-license.json)
engine/runtime-root.mjs     <- core/runtime-root.mjs
engine/index.mjs            <- core/index.mjs (helpers) — see critique re: specifications/ coupling
engine/policy-options.mjs   <- core/policy-options.mjs (or fold into index.mjs)
engine/constants.mjs        <- ENGINE_SCHEMA (+ LEDGER_SCHEMA/MACHINE_SCHEMA live in ledger-db already)
scripts/checks/source-staleness.mjs  <- kernel/source-staleness.mjs (only consumer is check-stales)
docs/ledger-erd.yaml        <- sqlite/design.yaml
docs/ledger-db.md           <- keep (another lane's), minus inlined DDL or generated from engine/*.sql
schemas/ledger-db.schema.yaml <- keep as generated/checked catalog (another lane)
```

Everything else in `kernel/` (63 files), `core/identity.mjs`, `sqlite/{index.yaml,queries/*}`: DELETE.

---

## 7. HFS critique — what's wrong/missing for this surface

1. **`journal.mjs` has no home in the draft and cannot simply die.** `ledger-db.mjs`
   imports `newToken`, `sqliteAtLeast`, `SETTLED_JOB_STATUSES`, `RETENTION`,
   `reclaimSpace` from it. If `kernel/` is deleted wholesale per "the OLD engine
   is scheduled for deletion", the live ledger breaks on first open. The HFS
   must say explicitly: journal.mjs's helpers merge into `engine/ledger-db.mjs`;
   its journal-reader half dies with `scripts/ledger/ledger-migrate.mjs`.
2. **`source-staleness.mjs` is mislabeled as kernel.** Its only consumer is
   `scripts/checks/check-stales.mjs`. The draft `engine/` list
   (ledger-db + machine + yaml + runtime-root + schema) doesn't name it;
   `scripts/checks/` is the honest home.
3. **`ENGINE_SCHEMA` orphaned.** Installer `bin/starci-skills.mjs` needs exactly
   one constant from `kernel/common.mjs`, a file whose own imports reach into
   `hosts/`, `modules/models/index.mjs`, and four dead kernel modules. The draft
   has no constants/utilities module; add `engine/constants.mjs` or inline it in
   the installer.
4. **`core/index.mjs` is heavier than the draft implies.** It imports five
   `specifications/*.mjs` validators — moving it to `engine/` transitively
   pins `specifications/` (a directory the draft omits). Either `engine/index.mjs`
   keeps the spec imports (and specifications/ must exist), or the
   canonicalJSON/sha256/validateWorkspace helpers split from the spec-bound
   half. This is the biggest hidden coupling in the surface.
5. **`sqlite/` "schema-as-data" is half-specified.** The draft says engine/
   holds it, but doesn't say whether `ledger-db.mjs` *executes* the .sql
   (recommended — kills the 5-way DDL duplication) or the .sql stays a
   docs mirror (drift continues). Decide explicitly; also decide the fate of
   `docs/ledger-db.md` §4/§5 inlined DDL and `schemas/ledger-db.schema.yaml`.
6. **`scripts/ledger/` missing from the draft list** — presumably intentional,
   but then `ledger-migrate.mjs` (the only journal→sqlite migrator) is gone and
   any installed 1.0.3 journal is orphaned. Fine for a clean open-source cut;
   should be a stated decision, not an omission.
7. **`bin/` missing from the draft** — package.json `bin.starci` points at a
   forwarder into `hosts/` (dead). New tree needs either a rewritten thin bin
   or no bin + `scripts/install` (draft's `install?` hedges this).
8. **Runtime-state ignores**: draft tree has no `.starciwork/` story for
   consumer repos (the ledger file the whole product writes). Add it to init
   templates' guidance.
9. Draft's `engine/` name is good; just note `machine.sqlite` handling
   (`openMachine`/`machineFileFor`) is **live** — `api.mjs settle` releases
   `machine_ref` tokens through it — so `machine.sql`/`openMachine` are not
   optional legacy.
