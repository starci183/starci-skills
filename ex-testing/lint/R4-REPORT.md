# R4 REPORT — OLD-ENGINE REMNANTS

Lane: `execution/`, `workflows/`, `hosts/`, `models/` (root), `contracts/` importers, `packages/`,
`upgrades/`, `legacy/`, `ex-testing/`, `runtime/`, `worktrees/`.
Repo: `D:\Repositories\starci-academy-backend\.claude` (own git repo, branch `main`).
Method: import-graph sweep (`grep -rn` over `*.mjs`, excluding `node_modules/`, `runtime/`,
`worktrees/`, `legacy/`, `ex-testing/`), package.json/.gitignore/git-worktree inspection.
Verdicts assume the surviving set = `scripts/{kernel,route,goal,checks,example,config,ledger}`,
`modules/`, `kernel/ledger-db.mjs` (+its real deps), `core/`, `schemas/`, `sqlite/`, `providers/`,
`skills/`, `init/`, `bin/` (rewritten), `knowledge/`, `docs/`, `examples/`, `tests/` (rewritten).

---

## 1. `execution/` — DELETE whole dir (6 files)

| File | Importers (live tree) | Verdict |
|---|---|---|
| `execution/api.mjs` | `cli/main.mjs`, `tests/execution-api-cli.spec.mjs` | DELETE |
| `execution/contracts.mjs` | `cli/main.mjs`, `tests/execution-contracts.spec.mjs` | DELETE |
| `execution/resolve.mjs` | `cli/main.mjs`, `tests/execution-resolve-v3.spec.mjs` | DELETE |
| `execution/orca.mjs` | `hosts/orca/adapter.mjs`, `tests/orca-{adapter,execution}.spec.mjs` | DELETE |
| `execution/solo.mjs` | `tests/solo-execution.spec.mjs` only | DELETE |
| `execution/supervision.mjs` | `hosts/orca/launch.mjs`, `execution/api.mjs`, `tests/supervision.spec.mjs` | DELETE |

Every importer is itself scheduled for deletion (`cli/`, `hosts/`, old `tests/`). Internal imports
pull from `core/` (`canonicalJSON`, `sha256`, `skillRoot`) and `providers/validate.mjs` — keepers
that stay; nothing unique flows the other way. Nothing to rescue.

## 2. `workflows/` — DELETE whole dir (17 .mjs + 12 .yaml)

Importers of `workflows/*.mjs` outside the dir: `cli/main.mjs` (6 imports), `scripts/work/plan.mjs`
+ `scripts/work/present-goal.mjs`, ~25 files in `tests/`. The `.yaml` contracts are referenced by
`SKILL.md`, `INDEX.yaml`, `docs/*`, `bin/starci-skills.mjs` help text — all stale-doc references,
not code.

Load-bearing note for other lanes:
- `workflows/lifecycle.mjs`, `delegation.mjs`, `auto.mjs`, `plan.mjs`, `select.mjs`, `flash.mjs`,
  `frontend.mjs`, `matrix.mjs`, `evidence.mjs`, `storage.mjs`, `work-binding.mjs`,
  `producer-verification.mjs`, `presentation.mjs`, `typed.mjs`, `source-layout.mjs`,
  `catalog-validate.mjs`, `contracts.yaml` — all reachable only through the old engine. The new
  kernel does goal→op-chain via `scripts/goal/define-goal.mjs` + `scripts/kernel/api.mjs`; none of
  this is on that path.
- `workflows/` imports `legacy/ops/role-authority.mjs` and `legacy/ops/select.mjs` — proof that
  parts of `legacy/ops` are still live code for the old engine; they die together.
- `scripts/work/` is itself an orphan candidate: its only callers are old SKILL.md flow and tests;
  it is not in the draft HFS scripts list. Recommend DELETE `scripts/work/` too (its YAML-schema
  knowledge, if any survives, belongs to the goal lane — `schemas/goal-plan.yaml` already exists).

## 3. `hosts/` — DELETE whole dir (7 files)

| File | Importers | Verdict |
|---|---|---|
| `hosts/index.mjs` | `hosts/orca/*`, `tests/hosts.spec.mjs` | DELETE |
| `hosts/headless/host.mjs` | `hosts/index.mjs`, `models/functions.mjs`, `tests/{headless-model-registry,hosts,luna-allocation}.spec.mjs` | DELETE |
| `hosts/orca/{adapter,calls,launch,observe,protocol}.mjs` | `kernel/*` monolith (kernel.mjs, lanes.mjs, sync.mjs, terminals.mjs, common.mjs), `bin/starci.mjs`, `cli/main.mjs` indirectly, `tests/helpers/kernel-harness.mjs` + ~10 specs | DELETE |

The one question the brief asked to verify — **does dispatch need `hosts/headless` as a non-orca
backend? NO.** `scripts/route/dispatch-op.mjs` spawns `orca` directly via `spawnSync`
(`orca terminal create`/`send`, or `orca orchestration worker-start` for managed profiles per
`providers/orca/index.yaml:managedFallback`). `scripts/kernel/api.mjs dispatch` delegates to that
same spawn path. There is no non-orca spawn path in the new architecture; if one is ever wanted it
is a new `providers/` adapter, not this file.

Consequence outside my surface: `bin/starci.mjs` line 66 forwards all 30+ `LAUNCHER_COMMANDS` to
`hosts/orca/launch.mjs`. When `hosts/` dies, `bin/starci.mjs` must be rewritten to drop the kernel
command page (new entry is `node scripts/kernel/api.mjs`), or deleted. `bin/` is absent from the
draft HFS — see §6.

## 4. `models/` (root) — DELETE whole dir (3 files, 888 lines)

| File | Live importers | Verdict |
|---|---|---|
| `models/functions.mjs` (817 lines) | `kernel/{goal,kernel,verify,job-model-worker,amendment}.mjs`, `hosts/headless/host.mjs`, 9 test specs | DELETE |
| `models/manager-contract.mjs` | `kernel/manager.mjs`, `models/functions.mjs`, tests | DELETE |
| `models/validator-transport.mjs` | `kernel/engine.mjs`, `models/functions.mjs`, tests | DELETE |

No surviving file imports root `models/`. `scripts/route/route-model.mjs` reads
`modules/models/*.yaml` data directly (verified — imports only `core/yaml.mjs`);
`scripts/config/config.mjs` likewise. `modules/models/index.mjs` exists as a JS resolver but its
only importers are old-engine (`kernel/*`, `hosts/headless`, `workflows/frontend.mjs`, tests) —
flag to the modules lane: either delete `modules/models/index.mjs` or it becomes dead-on-arrival.
Nothing in `models/functions.mjs` needs rescuing: the new kernel IS the LLM; the
function-calling/headless-provider layer (`runHeadlessWithUsage`, `usageClaude/Codex/Qwen`,
`assessGoal`, `manageWorkflow`) is exactly what the architecture removes.

## 5. `contracts/` — DELETE whole dir (2 files)

`contracts/journeys.mjs` ← `specifications/validate.mjs`, `workflows/frontend.mjs`, tests.
`contracts/assets.mjs` ← `workflows/frontend.mjs`, `tests/profiles-assets.spec.mjs`.
No surviving importer. (`specifications/` is another lane's call, but its validator is the only
non-doomed consumer — flag for coordination.)

## 6. `packages/` — SPLIT verdict; not in draft HFS at all

Workspace root `packages/package.json` = `@starci/eslint` monorepo (`workspaces: eslint/*`).

| Subdir | Package | Evidence of use | Verdict |
|---|---|---|---|
| `packages/eslint/be` | `@starci/eslint-canon-be@1.2.1` | `scripts/checks/check-scoped-lint.mjs` resolves `profile.canon.package` from the **target repo's** `node_modules` (`createRequire(repository/package.json)`); `probe-reference-conventions.mjs` probes `<root>/node_modules/@starci/eslint-canon-be`; examples depend on `^1.2.1` from registry. `schemas/json-exceptions.yaml` lists its files. `KNOWN-DEFECTS.md` documents 3 red assertions. | **KEEP source, MOVE** — it is the published source of a runtime dep of surviving checks. Target: `packages/` is missing from the draft HFS; either publish-only (delete from tree, examples pin registry version) or keep at `packages/eslint/{be,fe}` — NOT `scripts/checks/vendor/` (the check resolves the canon from the *target's* node_modules, so vendoring inside scripts/ gains nothing). |
| `packages/eslint/fe` | `@starci/eslint-canon-fe@3.1.0` | examples use `file:../../packages/eslint/fe`; same check path. | Same as above. |
| `packages/e2e-kit` | `@starci-examples/e2e-kit@0.0.0` | `file:` dep of `examples/todo-app-backend`, `examples/ecommerce-app-be`; has own `node_modules/` vendored install. | Conditional: KEEP iff examples/ ship with `file:` deps (then belongs wherever examples live in HFS); else DELETE. |
| `packages/fe-kit` | `@starci-examples/fe-kit@0.0.0` | `file:` dep of `examples/todo-app-frontend`. | Same as e2e-kit. |
| `packages/grammar` | `@starci/grammar@0.4.13` | examples pin registry `0.4.13` (not file:); referenced by `knowledge/grammars/*`, `modules/models/code-patterns.yaml`, docs — provenance/digest references, not imports. | Provenance-only. DELETE from tree (published artifact is the canon) or KEEP if policy is "source ships". Recommend delete — it's a product package, not skill machinery. |
| `packages/heroicons` | `@starci/heroicons@0.3.0` | No `file:` consumer; knowledge/docs/code-patterns references only. | DELETE from tree (published artifact suffices). |
| `packages/node_modules`, per-pkg `node_modules`, `dist`, `storybook-static`, `reference-renders` | — | Vendored installs/build output (tens of thousands of files). | DELETE regardless (never ship vendored `node_modules/`). |
| `packages/KNOWN-DEFECTS.md`, `README.md` | — | Canon test-state documentation. | KEEP with the eslint source if kept. |

Net: the only load-bearing content is `packages/eslint/{be,fe}` **source**, and only because the
surviving scoped-lint check needs the canon *installed in target repos*. If `@starci/eslint-canon-*`
stay published on a registry, the skill tree can drop `packages/` entirely and pin versions.

## 7. `upgrades/` — DELETE (4 files) once installer is rewritten

`upgrades/{index.yaml,1.0.0.md,1.0.4.md,5.0.0-plus.md}`. Sole live consumer:
`bin/starci-skills.mjs:450-456` reads `upgrades/index.yaml` on `starci update` to print the note
for the installed version. All three notes describe migrating *from retired trees* (`_local`
import, retired launcher path, pre-1.0 protocol) — meaningless for a v1 open-source install that
never had the old tree. Verdict: DELETE. If the new installer keeps an upgrade-note mechanism,
it is one YAML key in `scripts/install`, not a directory.

## 8. `legacy/` — DELETE whole dir, but TWO rescues first

Tracked: 179 files. Subdirs: `builders/` (54), `docs/` (8), `model/` (13), `notes/` (42),
`ops/` (43), `scripts-loose/` (1), `sites/` (**74,658 files** — vendored site builds).

NOT pure cold storage — two live hooks remain:

1. **`core/runtime-root.mjs` (a KEEPER — draft `engine/`) resolves reads into `legacy/`**:
   `contractCandidates()` falls back to `legacy/ops/<id>/operator.*`, `legacy/ops/<id>/<doc>`,
   `legacy/model/<record>.*`, `legacy/model/<rt>/profiles/<id>.*`, and `policy/<doc>.json` →
   `legacy/ops/<doc>.yaml`. The *surviving* callers (`check-scoped-lint.mjs` →
   `readDistJson('model','code-patterns.json')`, `core/index.mjs` → `schemas/*.json`) all resolve
   to `modules/`/`schemas/` primaries first — **the legacy fallbacks only fire for old-engine
   callers** (`kernel/*` reads `model/kinds.json`, `ops/<id>/operator.json`). So: cut the legacy
   arms of `contractCandidates` when `legacy/` is deleted; no data rescue needed for model/ records
   (all covered by `modules/models/`).
2. **`modules/ops/registry.yaml` + `scripts/route/build-ops-registry.mjs:144` name
   `.claude/legacy/ops/common.yaml` as `origin.commonDocument`** — a canonical generated file
   pointing at legacy. `cli/main.mjs:474` also reads it via `readPolicyDocument('common.yaml')`
   (old path). **Rescue `legacy/ops/common.yaml` → `modules/ops/common.yaml`** (it is authored
   policy prose: work-tree rules + lifecycle gates) and update the two code refs + registry
   `origin` block.

Everything else in `legacy/` is either imported only by dying code (`legacy/ops/role-authority.mjs`,
`select.mjs`, `basic-ops.mjs` ← `workflows/`; `legacy/builders/*` ← retired projection pipeline) or
pure history (`legacy/docs`, `legacy/notes`, `legacy/sites`). Nothing is worth keeping as docs —
owner said delete all traces; git history retains it.

## 9. `ex-testing/` — DELETE whole dir

**4,308 tracked files** (it is committed, not ignored). Contents: lane briefs, `.processed*`
markers, `.tmp-*` measurement dumps, `lint/` reports + `done/` markers, `probe/`, `uat/`,
`db-erd/`, watchdog scripts/logs, `scratch/_tinkle4-*` snapshot trees.

No canon code imports it. `modules/` mentions are provenance comments (`# Brief: ex-testing/...`)
except **`modules/ops/ops/ex-test.probe.yaml`** — a canary op manifest inside the canonical ops
dir whose `writes:` target `ex-testing/probe/` + `ex-testing/lint/`. It is lane scratch wearing a
canonical address: DELETE it and regenerate `modules/ops/registry.yaml` (drop its entry at line 412).
Also `modules/kernel/driver-loop.yaml` cites `ex-testing/lint/done/*.done` as the fleet-monitoring
convention — that convention dies with the dir; the doc should point at wherever the final lanes'
reports land.

Where the final HFS report should live instead: **the cut PR body**, or `docs/` if a durable record
is wanted. Do NOT keep `ex-testing/` for the reports — the reports describe the deletion, they are
not part of the deleted product.

## 10. `runtime/` + `worktrees/` — removal commands

- `runtime/` — `/runtime/` in `.gitignore` (line 10). Contains `engine/builds/<hash>/.dist/` old
  compiled trees. Untracked; plain delete is safe: `rm -rf .claude/runtime` (no git action needed).
- `worktrees/` — `worktrees/` in `.gitignore` (line 13). **But the subdirs are registered git
  worktrees of the PARENT repo** `D:/Repositories/starci-academy-backend`, so they must be removed
  through the parent or its `.git/worktrees/` metadata rots:

  ```
  # run from anywhere; CWD of this repo is the parent
  cd D:/Repositories/starci-academy-backend
  git worktree list   # shows 5 entries under .claude/worktrees/:
  #   agent-a75cd99400d6ba88a (worktree-agent-a75cd99400d6ba88a)
  #   dazzling-tereshkova-dafe3b  (claude/dazzling-tereshkova-dafe3b)
  #   dreamy-margulis-c127b7      (claude/dreamy-margulis-c127b7)
  #   exciting-chebyshev-292790   (claude/exciting-chebyshev-292790)
  #   laughing-williamson-09b564  (claude/laughing-williamson-09b564)
  git worktree remove --force .claude/worktrees/agent-a75cd99400d6ba88a
  git worktree remove --force .claude/worktrees/dazzling-tereshkova-dafe3b
  git worktree remove --force .claude/worktrees/dreamy-margulis-c127b7
  git worktree remove --force .claude/worktrees/exciting-chebyshev-292790
  git worktree remove --force .claude/worktrees/laughing-williamson-09b564
  rm -rf .claude/worktrees/_briefs          # plain dir, no .git file
  git worktree prune                        # safety net if anything was rm'd first
  ```
  Branches (`claude/*`, `worktree-agent-*`) survive `worktree remove`; delete separately only if
  wanted (`git branch -D ...`), which is destructive — confirm with owner first.
  Also note `.claude/.starci-wk-spec-dDhOsN/` — stray runtime state dir at repo root, same class
  as `runtime/`; add to `.gitignore` or delete.

---

## 11. Single-source-of-truth violations found

1. **Ledger DDL inlined in `kernel/ledger-db.mjs` (25 `CREATE TABLE`s) vs `sqlite/schema.sql`
   (19 `CREATE TABLE`s + indexes/extras)** — the known duplication, confirmed: `ledger-db.mjs`
   never reads `sqlite/schema.sql`. Single-source: make `sqlite/schema.sql` (schema-as-data) the
   one canon and have `engine/ledger-db.mjs` `fs.readFileSync` it, or generate schema.sql from the
   DDL constant in a build step + a drift test.
2. **Op registry `commonDocument` points at `legacy/ops/common.yaml`** while the registry itself is
   canonical — a canonical file sourcing authority from the retired tree. Fix by moving the doc to
   `modules/ops/common.yaml` (one location).
3. **`workflows/*.yaml` contract data duplicated as code**: `select.mjs`/`matrix.mjs` encode rules
   also expressed in `gates.yaml`/`jobs.yaml`/`transitions.yaml` — moot once deleted, but the
   pattern (YAML + parallel .mjs validator per file) is why the dir is being abandoned; don't
   reintroduce it in `modules/`.
4. **`modules/models/index.mjs`** duplicates in JS what `route-model.mjs` reimplements against the
   same YAML — two resolvers for `modules/models/`; pick one (recommend the script; delete the
   module or make the script the only consumer and move it to `engine/`).
5. **hosts concept twice**: `hosts/index.mjs` `BUILT_IN_HOSTS`/`HOSTS_PROFILE` vs
   `modules/models/hosts.yaml` — YAML is canon, JS dies with the dir.

## 12. HFS critique (what the draft gets wrong/missing for this surface)

- **`bin/` is absent from the draft HFS** but `package.json.bin` points at `bin/starci.mjs` and the
  installer `bin/starci-skills.mjs` is the only `upgrades/` consumer. The HFS needs an explicit
  `bin/` or `scripts/install` story before `hosts/` can die (bin forwards to `hosts/orca/launch.mjs`).
- **`engine/` list is missing `journal.mjs`.** `kernel/ledger-db.mjs` imports
  `{newToken, sqliteAtLeast, SETTLED_JOB_STATUSES, RETENTION, reclaimSpace}` from
  `./journal.mjs` (203 lines, node builtins only — clean). The draft's "machine" is not a file:
  `machineFileFor`/`openMachine` live inside `ledger-db.mjs`. Canonical engine set from this
  surface's evidence: `engine/{ledger-db.mjs, journal.mjs, yaml.mjs, runtime-root.mjs, index.mjs?}`
  — and `runtime-root.mjs` must lose its `legacy/` fallback arms (§8).
- **`packages/` absent from HFS** — needs a verdict (§6): publish-and-drop vs keep-source.
- **`tests/` is listed as kept** but ~all existing specs test the deleted engine
  (`workflows/`, `execution/`, `hosts/`, `models/`, `kernel/*`, `cli/`). The HFS should say
  "tests/ rebuilt around api.mjs + checks; current suite deleted" or the tree keeps 100+ specs of
  dead code.
- **No home for `scripts/{work,ledger,config}`** — `scripts/work/` dies with workflows/;
  `ledger-migrate.mjs` is reachable only via `bin→hosts/orca/launch.mjs` (old path) and has no v1
  purpose (nothing to migrate from); `scripts/config/config.mjs` is imported by `models/functions.mjs`
  AND `scripts/route/*` (surviving) — check before deleting: it must stay or its `targetAliases`
  logic inlines into route.
- **`ex-testing/` absent** — fine to omit, but `modules/ops/ops/ex-test.probe.yaml` +
  `modules/kernel/driver-loop.yaml` reference it; canonical modules must not point at deleted paths.
- **`cli/`, `specifications/`, `fixtures/`, `approvals/`, `contracts/` absent** — all die per this
  evidence (contracts/ confirmed here; cli/ confirmed: only old-engine deps). Say so explicitly in
  the HFS so no lane "rescues" them back.

## Proposed canonical targets summary

| Item | Verdict | Target |
|---|---|---|
| `kernel/ledger-db.mjs` | MOVE | `engine/ledger-db.mjs` |
| `kernel/journal.mjs` | MOVE (dep of ledger-db) | `engine/journal.mjs` |
| `core/runtime-root.mjs` | MOVE + strip legacy fallbacks | `engine/runtime-root.mjs` |
| `core/yaml.mjs`, `core/index.mjs` (used by checks) | MOVE | `engine/` |
| `legacy/ops/common.yaml` | RESCUE | `modules/ops/common.yaml` |
| `sqlite/schema.sql` | KEEP as schema-as-data; make it the single DDL source | `engine/schema.sql` or `sqlite/schema.sql` |
| `packages/eslint/{be,fe}` | KEEP-source or publish-drop | `packages/` (if kept) — decide policy |
| `packages/{e2e-kit,fe-kit}` | KEEP iff examples keep `file:` deps | beside `examples/` policy |
| `packages/{grammar,heroicons}` | DELETE (published artifacts suffice) | — |
| `execution/`, `workflows/`, `hosts/`, `models/`, `contracts/`, `cli/`, `scripts/work/`, `upgrades/`, `ex-testing/`, rest of `legacy/` | DELETE | git history |
| `runtime/` | DELETE (untracked) | — |
| `worktrees/*` | REMOVE via parent `git worktree remove --force` | — |
