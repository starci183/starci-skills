# f1 REPORT — triage: `cli/`, `init/`, `contracts/`, `execution/`, `sqlite/`

Scope: prove live or move to `legacy/`. Result: **all five dirs LIVE — nothing moved, no refs updated.**

## Verdicts

| Dir | Verdict | Evidence |
|---|---|---|
| `cli/` | **LIVE** | `bin/starci.mjs:86,88` `await import('../cli/main.mjs')` (the one entry forwards non-workflow commands here); `bin/starci-skills.mjs:524` hard-fails doctor when installed tree lacks `cli/main.mjs`; spawned/imported by specs: `tests/code-patterns-cli.spec.mjs:5`, `tests/stacks.spec.mjs:207`, `tests/integration.spec.mjs:298,535`, `tests/application-stacks-integration.spec.mjs:42,47`, `tests/npm-package.spec.mjs:38`; declared in `INDEX.yaml:23` (`cli: Inspection commands`), `package.json` `files`, `kernel/runtime-pin.mjs:36` RUNTIME_PAYLOAD_DIRS, `modules/schemas/index.yaml:454` usedBy. |
| `init/` | **LIVE** | `bin/starci-skills.mjs:90-92` `readFileSync(packageRoot, 'init/{AGENTS,CLAUDE,DEVIN}.md')` at module top level — removing any file breaks every installer import; asserted by `tests/integration.spec.mjs:104-105`, `tests/engine-lifecycle.spec.mjs:49`, `tests/workflow-kernel-shared-ledger.spec.mjs:32` (expected payload list); `SKILL.md:82` "bootstrap entrypoints installed from `init/`"; `INDEX.yaml:8`, `package.json` `files`, runtime-pin payload. All 3 files live — no split. |
| `contracts/` | **LIVE** | `workflows/frontend.mjs:1-2` imports `../contracts/journeys.mjs` + `../contracts/assets.mjs` (frontend.mjs itself live via `tests/frontend-workflow.spec.mjs:9` and `tests/specifications.spec.mjs:8,121`); `specifications/validate.mjs:1` imports journeys; `tests/profiles-assets.spec.mjs:6` imports assets; `INDEX.yaml:18` (`contracts: Validation code`); runtime-pin payload. Both files live — no split. |
| `execution/` | **LIVE** | `cli/main.mjs:272-273,286` dynamic imports `../execution/{contracts,api,resolve}.mjs`; `hosts/orca/launch.mjs:12` imports `../../execution/supervision.mjs` (hosts/ is canon — dispatch-op launches through it); `execution/orca.mjs` is the documented 4.x child-workflow boundary (`docs/orca-execution.md:19,167,211`, `hosts/orca/adapter.mjs:5` is its injected adapter) exercised by `tests/orca-adapter.spec.mjs:7` + `tests/orca-execution.spec.mjs:12`, and itself imports `./supervision.mjs`; `execution/solo.mjs` backs the solo execution mode `SKILL.md:43` declares (`docs/solo-execution.md`), imported by `tests/solo-execution.spec.mjs:3`; `tests/execution-{api-cli,contracts,resolve-v3}.spec.mjs`; `modules/schemas/index.yaml:453-472` + `relationships.yaml:92` name `execution/api.mjs`/`contracts.mjs` as contract consumers; `UPDATE.yaml` runtime-layout block: "`execution/` still carries the 4.x Plan-route execution modes"; runtime-pin payload. All 6 files live — no split. |
| `sqlite/` | **LIVE** (documentation canon) | Not imported by `.mjs` at runtime — DDL is inlined in `kernel/ledger-db.mjs` — but it is the declared ledger-design catalog: `INDEX.yaml:22` (`sqlite: Ledger DB schema and migrations for .starciwork/runtime.sqlite`); `sqlite/index.yaml` self-indexes against `kernel/ledger-db.mjs`, `kernel/store.mjs`, `schemas/ledger-db.schema.yaml`, `docs/ledger-db.md`, `scripts/ledger-migrate.mjs`; `INDEX.yaml:20` ledger-db.schema.yaml documents the same table catalog; w7 lane verified `schema.sql`↔LEDGER_DDL 19/19 tables and `machine.sql`↔MACHINE_DDL 5/5; `_common.md` CANON-never-move list names `sqlite/`; `.experiments/OPENSOURCE-GOAL.md:22` calls it canonical layout. Kept per canon declaration + rule 2 (unsure → live). |

## Greps run

- `(cli|init|contracts|execution|sqlite)/[A-Za-z]` and quoted-path variants across the whole tree; scoped greps over `scripts/`, `kernel/`, `core/`, `bin/`, `modules/`, `providers/`, `hosts/`, `tests/`, `SKILL.md`, `INDEX.yaml`, `UPDATE.yaml`, `README.md`, `package.json`.
- Per-file checks: `execution/(api|orca|resolve|solo|supervision|contracts).mjs`, `contracts/(assets|journeys)`, `cli/main`, `init/AGENTS|CLAUDE|DEVIN`, `sqlite/schema.sql|machine.sql|queries/`.
- Note: `rg` is not on PATH in this shell (exit 127); used the built-in ripgrep-backed grep tool instead.

## Moves / ref updates

None. All five dirs are referenced by live code or declared canonical; `legacy/` untouched.

## Notes for the parent agent

- `kernel/runtime-pin.mjs:36` RUNTIME_PAYLOAD_DIRS seals `cli`, `contracts`, `execution`, `init` (and `legacy` itself) into runtime pins — moving any of them would change pin digests and break `verifyRuntimePin` on existing payloads. They must stay at root regardless of code-import analysis.
- `execution/` is NOT in `INDEX.yaml` `folders` (lists init/skills/modules/workflows/kernel/hosts/models/upgrades/providers/knowledge/contracts/core/schemas/specifications/sqlite/cli/scripts/tests/docs/sites/legacy) despite being declared live in `UPDATE.yaml` — likely an INDEX.yaml gap a docs lane may want to fix; out of my scope (root file).
- `sqlite/` is docs-only canon (yaml/sql context, no executables). If the final target layout truly excludes it, the move is a design decision — evidence says keep: INDEX.yaml, `_common.md` canon list, and the w7 DDL-parity check all treat it as canonical.
- Sibling-lane dirs observed still at root (`workflows/`, `hosts/`, `models/`, `docs/`, `specifications/`, `approvals/`, `upgrades/`, `sites/`, `skills/`, `fixtures/`, `packages/`, `runtime/`, `worktrees/`, `--help`, `m[1]).join('`, `nul`, `0`) were not touched — not mine.
- `git status` on all five dirs: clean, fully tracked. No commits made.
