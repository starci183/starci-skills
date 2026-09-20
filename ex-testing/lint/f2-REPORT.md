# f2 cleanup-lane report

Repo: `D:\Repositories\starci-academy-backend\.claude` (own git repo; all inspection done with cwd there).
Dirs triaged: `workflows/`, `hosts/`, `runtime/`, `upgrades/`, `approvals/`, `packages/`.

**Result: zero moves.** Every assigned dir proved live (or is deliberately-gitignored live state).
No files moved, no references rewritten, no commits made.

Note on tooling: `rg` is not on PATH in this environment; all greps below were run with `grep -rn`
against the live-code set (`scripts/ kernel/ core/ bin/ cli/ modules/ providers/ tests/ schemas/
SKILL.md package.json INDEX.yaml README* UPDATE.yaml MASTER.md`) plus targeted follow-ups.

---

## `workflows/` — LIVE (kept)

Evidence:
- `package.json` `files[]` ships `"workflows/"` (line 20).
- `kernel/runtime-pin.mjs:36` — `RUNTIME_PAYLOAD_DIRS` includes `'workflows'` (sealed into every runtime pin).
- `cli/main.mjs:7,384,391,442` — imports `../workflows/{storage,source-layout,lifecycle,select}.mjs`.
- `scripts/plan.mjs:6-9,48` — imports `workflows/{plan,storage,auto}.mjs`, reads `workflows/catalog.yaml` and `workflows/plan.template.yaml`.
- `scripts/present-goal.mjs:7-11` — same catalog read.
- `INDEX.yaml:37,49` — `gates: workflows/gates.yaml`, `explicitFlash: workflows/flash.yaml`.
- `SKILL.md` (~10 refs), `modules/schemas/index.yaml` (4 refs), `modules/goal/anatomy.yaml`, `modules/ops/ops/*.yaml`, `modules/models/*` reference `workflows/` contract paths.
- Tests: `frontend-workflow.spec.mjs`, `auto.spec.mjs`, `delegation.spec.mjs`, `authored-work-binding.spec.mjs`, `implementation-output-binding.spec.mjs`, `workflow-*`, `backend-handoff`, `integration` and more import `../workflows/*.mjs` or read `workflows/*.yaml`.
- File-level check: all 29 tracked files reachable. The four `.mjs` with no direct-name grep hit (`catalog-validate`, `presentation`, `typed`, `work-binding`) are imported by sibling workflow modules / named by workflow YAML (`catalog-validate` ← `workflows/select.mjs`; `presentation` ← `auto.mjs`, `delegation.mjs`, `lifecycle.mjs`, `producer-verification.mjs` + `auto.yaml`/`delegation.yaml`/`plan.yaml`; `typed` ← `lifecycle.mjs`, `producer-verification.mjs` + `auto.yaml`/`gates.yaml`/`plan.yaml`/`supervision.yaml` + tests; `work-binding` ← `auto.mjs`, `evidence.mjs`, `lifecycle.mjs`, `producer-verification.mjs` + 2 specs).

Files moved: none. Refs updated: none.

## `hosts/` — LIVE (kept)

Evidence:
- `kernel/kernel.mjs:17-19` — imports `../hosts/orca/calls.mjs`, `../hosts/orca/protocol.mjs`, `../hosts/orca/launch.mjs` (`buildOperationLaunch`, `settleDispatch`, `sweepWorktree`, …); also referenced at line 5016.
- `kernel/terminals.mjs:2-3`, `kernel/common.mjs:5` — import hosts modules.
- `bin/starci.mjs` — forwards the whole `LAUNCHER_COMMANDS` set to `hosts/orca/launch.mjs` (header comment + dynamic import ~line 66).
- `kernel/runtime-pin.mjs:36` — `'hosts'` in `RUNTIME_PAYLOAD_DIRS`; `package.json` `files[]` ships `"hosts/"`.
- `modules/models/hosts.yaml:8-9` — declares `hosts/index.mjs` the sole loader of the hosts profile; `modules/models/index.yaml:15`, `modules/schemas/index.yaml:411,484`, `providers/orca/validation.yaml:15,20,74`, `providers/validate.mjs:59` reference it.
- Tests: `hosts.spec.mjs:6-8` (imports `hosts/index.mjs` + `hosts/headless/host.mjs`), `orca-headless.spec.mjs:8`, `workflow-kernel.spec.mjs:18`, `headless-model-registry.spec.mjs:4`, `luna-allocation.spec.mjs:6`, `integration.spec.mjs:365`. All 7 files reachable.

Files moved: none. Refs updated: none.

## `runtime/` — LIVE (kept; gitignored root-local state, not authored source)

Evidence:
- `.gitignore:10` — `/runtime/` is deliberately ignored; `git ls-files runtime` = 0 tracked files.
- `scripts/checks/check-json-exceptions.mjs:53` — `ROOT_LOCAL_DIRS = new Set(['.starciwork', 'runtime'])`: the checker treats root `runtime/` as runtime-owned storage, not authored source. A `runtime/` dir nested anywhere else IS inventoried — so moving this to `legacy/runtime/` would turn its JSON into authored-source offenders and break the checker.
- `tests/json-exceptions.spec.mjs:68-99` — spec explicitly classifies `runtime/engine/builds/digest/runtime-pin.json` as root-local runtime JSON that must be preserved, not flagged.
- Contents confirm it: `runtime/engine/latest-pin.json` (`starci/runtime-pin@1`, points at `builds/<sha256>`), `pin-*.json`, `pins/*.pin.json`, `builds/<digest>/` sealed payloads — the output of `kernel/runtime-pin.mjs` `sealRuntime({buildsRoot})`. Live generated state with an active pin pointer.

Files moved: none. Refs updated: none.

## `upgrades/` — LIVE (kept)

Evidence:
- `bin/starci-skills.mjs` — `upgradeNote()` (~lines 445-460) reads `upgrades/index.yaml` then `upgrades/<version>.md` at install time; nearby comment (~line 332) states "`upgrades` is deliberately absent" from `RETIRED_ROOTS` because upgrade notes accumulate and are never superseded.
- `tests/integration.spec.mjs:158-171` — asserts `.claude/upgrades/index.yaml` schema `starci/upgrades@1` and per-version note files exist after install.
- `tests/source-layout.spec.mjs:38` — copies `upgrades/` into the synthetic installed layout it validates (i.e. part of the install contract).
- `INDEX.yaml:15`, `UPDATE.yaml:6`, `README.md:220`, `SKILL.md:17,84`, `MASTER.md:124-135`, `docs/installation.md:70` all reference it; `package.json` `files[]` ships `"upgrades/"`.

Files moved: none. Refs updated: none.

## `approvals/` — LIVE (kept)

Evidence:
- `kernel/runtime-pin.mjs:36` — `'approvals'` in `RUNTIME_PAYLOAD_DIRS`.
- `package.json` `files[]` ships `"approvals/"` (line 28).
- `workflows/lifecycle.mjs` (9 refs: lines 62-171), `workflows/delegation.mjs:38-143`, `workflows/auto.mjs:111,117`, `workflows/producer-verification.mjs:94-96` — live workflow code reads the approvals policy.
- `cli/main.mjs:263-276`, `scripts/plan.mjs:38-44`, `scripts/checks/work-layout.mjs:30`, `schemas/work-layout.yaml:99`, `modules/models/registry.yaml:54`, `SKILL.md` (5 refs).
- Tests: `backend-handoff.spec.mjs` (6 refs), `workflow-entry-audit.spec.mjs:12,73`, `frontend-workflow.spec.mjs:137`, `execution-api-cli.spec.mjs:87`, `workflow-kernel-shared-ledger.spec.mjs:32`, `source-layout.spec.mjs:38` (installed-layout copy list).

Files moved: none. Refs updated: none.

## `packages/` — LIVE (kept; unsure → live per rule 2, evidence below)

Borderline dir — not in `package.json` `files[]`, not in `RUNTIME_PAYLOAD_DIRS`, and no `kernel/ bin/ scripts/`
module imports `.claude/packages/` directly. Kept as LIVE on these grounds:

1. **Live checker allowlist names 18 paths under it.** `schemas/json-exceptions.yaml:162-216` allowlists
   `packages/{package.json,package-lock.json}`, `packages/e2e-kit/{package.json,package-lock.json,tsconfig.json}`,
   `packages/eslint/{be,fe}/package.json`, `packages/fe-kit/{package.json,tsconfig.json}`,
   `packages/grammar/{package.json,package-lock.json,tsconfig.build.json,storybook-static/*}`,
   `packages/heroicons/{package.json,package-lock.json,tsconfig.build.json}` — all verified present on disk.
   `checkJsonExceptions` fails on allowlist paths missing on disk (`missingAllowlist`), and
   `tests/json-exceptions.spec.mjs` ("checker CLI succeeds only when the installed authored source is clean")
   runs the real checker against this tree asserting exit 0. Moving `packages/` → `legacy/packages/` would
   produce 18 missingAllowlist entries AND new offenders (`legacy/` is not in `SKIP_DIR_NAMES`), requiring an
   atomic rewrite of `schemas/json-exceptions.yaml` — inside a never-touch dir.
2. **Knowledge provenance source.** `knowledge/grammars/common/DNA.yaml` (and sibling grammar records) cite
   `packages/grammar/**` as `observedSource` with per-file sha256 `digests` ("a digest that moved means
   re-capture, not reinterpretation") — the vendored `@starci/grammar@0.4.13` tree under `packages/grammar/`
   is the evidence those knowledge records point at. Moving it breaks the provenance chain in never-touch
   `knowledge/`.
3. **Authored source of shipped canon.** `packages/package.json` is an npm workspace root
   (`workspaces: eslint/*`) for `@starci/eslint-canon-{be,fe}` — the plugins
   `scripts/probe-reference-conventions.mjs:11` probes as installed reference rules
   (`node_modules/@starci/eslint-canon-be`). `packages/README.md` + `KNOWN-DEFECTS.md` document it as the
   lint-canon machine with its own (known-red, deliberately unskipped) suite. c7's report likewise classified
   `packages/` as a canon dir imported by specs.
4. Caveat for the integrator: its README cites a `gates/{fe,be}/lints` trust tree that no longer exists at
   root, and its tests are not in the root `node --test tests/*.spec.mjs` glob. If leadership decides the
   canon sources are abandoned, the move is `git mv packages legacy/packages/` **plus** rewriting the 18
   `packages/*` entries in `schemas/json-exceptions.yaml` to `legacy/packages/*` (and checking `packages/`
   node_modules stays ignored) — a schemas edit this lane did not make because the dir proved live.

Files moved: none. Refs updated: none.

---

## Cross-lane observations (for the integrator)

- `node scripts/checks/check-json-exceptions.mjs` currently exits nonzero on the working tree: the earlier
  `sites/` → `legacy/sites/` move (uncommitted renames in `git status`) left 6 stale allowlist paths
  (`sites/*`) and 7 offenders (`legacy/sites/*`). Whoever owns schemas/ needs to repoint those allowlist
  entries to `legacy/sites/...` (and likely add `legacy/sites/skills/src/catalog.generated.json` or extend
  the GENERATED list). Not mine to fix — flagged only.
- `kernel/runtime-pin.mjs:36` `RUNTIME_PAYLOAD_DIRS` still lists dirs owned by sibling lanes
  (`cli contracts docs execution init models specifications`) — a sealing-time coupling to keep in mind if
  those lanes move their dirs: any moved dir simply drops out of the seal (the code filters by existence),
  but pins sealed pre-move remain resolvable.
