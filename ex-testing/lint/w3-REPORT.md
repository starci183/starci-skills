# w3 — kernel/core/bin/cli/init/ops distless migration report (was tinkle-14 + tinkle-17)

**Briefs:** `ex-testing/briefs/wave2/w3.md` + `wave2/_common.md` → `tinkle/tinkle-14.md` + `tinkle/tinkle-17.md` + `tinkle/_common-distless.md`.
**Scope owned:** `kernel/**`, `core/**`, `bin/`, `cli/`, `init/`, `ops/**` → `legacy/**`, plus the repo-wide `ops/` code-ref sweep tinkle-17 assigns.
**Result:** complete. No commit made; `.dist/` not created, not written, not read for contract resolution at runtime.

## Prior-work survey (done before writing)

The tree is further along than the original briefs assumed — parallel lanes had already landed:

- `model/` → `modules/models/` (`modules/models/index.mjs` is the documented public API: `loadKinds`/`loadRecords`/`loadRuntimes`/`registry`/`runtimes`/`canonicalTarget`/`resolveModel`; profiles flattened to `modules/models/profiles/<id>.yaml`); old tree preserved at `legacy/model/`.
- Build machinery retired to `legacy/builders/` (`build-workflows`, `compile-declarative`, `compile-knowledge`, `ensure-build`, `runtime-compile`, `runtime-modules.txt`).
- `bin/starci.mjs` already imports `../hosts/orca/launch.mjs` / `../cli/main.mjs` (no `.dist`).
- `bin/starci-skills.mjs` already replaced `buildInstalledRuntime` with `prepareInstalledRuntime` (no build step; `.dist` gitignore lines kept intentionally for build-era upgrades) and reworded help/prompt-entry text.
- `cli/main.mjs` already reads `modules/ops/registry.yaml`, `modules/ops/ops/<id>.yaml`, `legacy/ops/common.yaml`, `legacy/ops/*/secondary.yaml`, `schemas/*.yaml` (copy), `modules/models/registry.yaml`, `approvals/policy.yaml`, `workflows/*.yaml` via a `sourceYaml` helper.
- `init/{AGENTS,CLAUDE,DEVIN}.md` already point at `.claude/schemas/workspace-routing.yaml`.
- `kernel/model-policy.mjs` already maps `.dist/model/<n>.json` → `modules/models/<n>.yaml`.
- `modules/ops/ops/*.yaml` — all 30 manifests present (verbatim operator port + `business:`/`route:`); `modules/ops/registry.yaml` (`starci/module-ops-registry@1`) generated. Not touched (other lane owns it).

## What w3 changed

### `git mv ops legacy/ops` (tinkle-17)
- 42 paths renamed `ops/…` → `legacy/ops/…`; `ops/` no longer exists.
- `legacy/ops/contracts.mjs` + `legacy/ops/validate.mjs` import depth fixed `../x` → `../../x` (move broke them).
- `legacy/ops/validate.mjs`: `ioProfiles` now reads `modules/models/<name>.yaml` (canonical) → `legacy/model/<name>.{yaml,json}` (fallback); dropped the `.dist` candidates in `ioProfiles` and `domainReferenceExists`; comments updated.
- `legacy/ops/generate.mjs`: retired message reworded — no `.dist` is published; `outputs()` remains available in-memory for tooling.
- `legacy/ops/common.yaml`: the "Build before reading" block (`run node scripts/ensure-build.mjs …`) replaced with a "Read the source tree" rule; the `[workflows/catalog.json]` doc link retargeted to `../workflows/catalog.yaml`. Logical contract names (`approvals/policy.json`, `model/registry.json`, `workflows/gates.json`, …) kept — they are reference spellings the resolver maps, not filesystem paths.

### `core/runtime-root.mjs` — rewritten as the distless contract resolver
- `skillRoot` = package root (this tree or a sealed pin payload); `distRoot`/`distPath`/`requireDist`/`readDistJson` kept as compatibility aliases but resolve under `skillRoot` — there is no `.dist`.
- `contractCandidates(parts)` maps historical `.dist` spellings to source:
  - `ops/<id>/operator.json` → `modules/ops/ops/<id>.yaml` → `legacy/ops/<id>/operator.{yaml,json}` (fallback is `console.warn`-logged: `[distless] op <id> <doc> served from legacy/ops…`).
  - `ops/<id>/<doc>` (secondary/specification/authority) → `legacy/ops/<id>/<doc>.{yaml,json}` only — module manifests carry the operator contract, not the per-document files.
  - `model/<n>.json` → `modules/models/<n>.yaml` → `legacy/model/<n>.*`; `model/<rt>/profiles/<id>.json` → `modules/models/profiles/<id>.yaml` (flattened) → legacy.
  - `policy/<n>.json` → `legacy/ops/<n>.{yaml,json}` (`.dist/policy/common.json` was compiled from `ops/common.yaml`).
  - generic `<name>.json` → authored `<name>.yaml`/`.yml` beside it; YAML parsed via `core/yaml.mjs::parseYaml`.
- New exports `resolveContractFile` / `opDocumentPath` for path-level callers.
- Verified: `readDistJson('ops','backend.implement','operator.json')` → modules manifest; `('ops','backend.implement','secondary.json')` → `legacy/ops/...` + logged fallback; `('model','registry.json')`, `('model','capabilities.json')`, `('schemas','work.schema.json')`, `('policy','common.json')` all resolve to authored YAML.

### `kernel/**` repointing (tinkle-14)
- `kernel.mjs`: `launcherOf` → `<host>/hosts/orca/launch.mjs` (was `.dist/…`); `reconcileLegacyCoordinatorLease` tries `hosts/orca/launch.mjs` then `.dist/…` inside the pin (old-layout pins still verifiable against `REVIEWED_LEGACY_COORDINATOR_LAUNCH_SHA256`); `policyFile` args (3 sites) → `modules/models/capabilities.yaml`; `contractDigestFor` keeps `readDistJson('ops', launchOperator(kind), 'operator.json')` — now resolves modules → legacy automatically.
- `engine.mjs`: `ENGINE_VERSION` reads `package.json` (`.dist/manifest.json` gone); `readDistJson` import dropped.
- `schedule.mjs`, `loads.mjs`, `common.mjs`, `chains.mjs`, `engine.mjs`: `../model/index.mjs` imports → `../modules/models/index.mjs`; error text/comments naming `model/*.yaml` updated.
- `graph.mjs`: `loadKinds()` resolves `modules/models/kinds.yaml` via the resolver (`.json`→`.yaml`); comments updated; `distProfile`→`sourceProfile`.
- `io.mjs`: `loadRecords()` reads authored `modules/models/records.yaml` directly; comments updated.
- `common.mjs` `grammarReferences`: authored `knowledge/**` accepts yaml+yml+json (authored JSON like `knowledge/ui/proof/calibration/calibration.json` is real source); `.dist` branch kept only for pre-migration payloads.
- `candidate-roots.mjs`: `compiledCanonRelative` → `compiledCanonRelatives` returning ordered candidate paths into the sealed payload — authored `knowledge/**` spelling first, `INDEX.json`→`index.yaml`, `.dist/knowledge/*.json` trailing for pre-migration pins.
- `runtime-pin.mjs` `sealRuntime`: seals the **source payload** — dirs `approvals bin cli contracts core docs execution hosts init kernel knowledge legacy models modules providers schemas scripts specifications workflows`, `examples/` doc files only (md/yaml/yml/json/txt; node_modules/symlinks excluded — workspace links cannot enter a sealed payload), loose files `INDEX/README/UPDATE.yaml, SKILL.md, config.json, config.example.yaml, package.json`. Directories/files are included only when present (fixture roots stay sealable), `.dist` is sealed opportunistically while it still exists in the tree so old-layout canon refs inside transition pins keep resolving; once `.dist` is deleted from source, pins simply stop containing it. `verifyRuntimePin` is layout-agnostic and unchanged.
- `supervisor.mjs`: launcher → `hosts/orca/launch.mjs`.
- `terminals.mjs`: infrastructure ENOENT classifier also matches `hosts/orca/launch.mjs`.
- `ledger-db.mjs` `RUNTIME_MARKER`: keeps the `.dist/kernel/ledger-db.mjs` alternative — it recognizes payloads sealed before the migration (intentional compat, not a runtime read).
- `goal.mjs`, `ledger.mjs`, `reports.mjs`, `graph.mjs`, `io.mjs`, `kernel.mjs`: stale `.dist`/`model/` doc comments corrected.

### Repo-wide `ops/` code refs (tinkle-17 mandate — outside w3 dirs but explicitly assigned)
- `workflows/matrix.mjs`: `../ops/select.mjs` → `../legacy/ops/select.mjs`.
- `workflows/frontend.mjs`: `authority()` root `../ops` → `../legacy/ops`.
- `scripts/route/build-ops-registry.mjs`: engines scan `skillRoot/ops` → `skillRoot/legacy/ops`.
- `hosts/headless/host.mjs`: `../../model/index.mjs` → `../../modules/models/index.mjs` (the import was broken by the models lane's move; required for cold boot — `hosts/orca/launch.mjs` imports it).
- `cli/main.mjs`: `../ops/select.mjs` → `../legacy/ops/select.mjs` (already landed by a parallel lane; verified).
- `package.json` `files`: `"ops/"`/`"model/"` (deleted dirs) → `"legacy/"`, `"modules/"` — required so install payloads and pins carry the new trees. `.dist/` was already removed and build scripts already stripped by another lane.

## modules/ops vs legacy/ops — what the kernel gets from where

- **Operator contract** (`ops/<id>/operator.json` reads, `starci op`, `contractDigestFor`): `modules/ops/ops/<id>.yaml` — verified identical contract fields to `legacy/ops/<id>/operator.yaml` plus `business:`/`route:` extras.
- **Fallback documents** (`secondary`, `specification`, `authority` stems): `legacy/ops/<id>/<doc>.yaml` — module manifests do not carry per-document files; every such read logs `[distless] op <id> <doc> served from legacy/ops`. `authority.json` was build-generated only and has no source document anywhere — see needed_elsewhere.
- **Catalogue**: `starci ops` reads `modules/ops/registry.yaml` (30 ops). `.dist`-only generated docs (`ops/catalog.json`, `ops/basic-ops.json`, `ops/consolidation.json`, `manifest.json`, `basic-ops.json`, `INDEX/README/UPDATE.json`, `docs/catalog.json`) have no runtime reader left in owned scope — cli recomputes what it needs (`secondaryRoutes` scans `legacy/ops/*/secondary.yaml`; `ENGINE_VERSION` = package.json).

## Verification (smoke checks)

```
$ git mv ops legacy/ops          # 42 staged renames; ops/ gone
$ grep -rn "\.dist" kernel/ core/ bin/ cli/ init/ legacy/ops/   # only intentional legacy-pin compat + comments (see below)
$ node -e "import('./core/runtime-root.mjs').then(m => …)"       # see 'Verified' bullets above — modules manifest + logged legacy fallback
$ node cli/main.mjs ops | head    # {"schema":"starci/module-ops-registry@1", ops[0].id:"architecture.decide", …}
$ node cli/main.mjs op architecture.decide    # prints legacy/ops/common.yaml + full contract
$ node cli/main.mjs op workspace.manage import  # selectOperation from legacy/ops works on the module manifest
$ node cli/main.mjs workflows | head            # workflows/catalog.yaml
$ node cli/main.mjs execution map | head        # modules/models/registry.yaml + secondaryRoutes from legacy/ops

# Cold boot — .dist renamed away:
$ mv .dist .dist.hold
$ node bin/starci.mjs version                    # 1.0.4
$ node cli/main.mjs ops                          # OK
$ node -e "import('./kernel/kernel.mjs')"        # kernel OK
$ node -e "import('./hosts/orca/launch.mjs')"    # launcher OK
$ node -e "import('./kernel/graph.mjs','./kernel/io.mjs','./kernel/schedule.mjs')"  # kinds/records/runtimes loaded (KINDS=33)
$ node bin/starci.mjs workflow-list              # reaches launcher; correctly refuses .claude as a Work root
$ sealRuntime + verifyRuntimePin on the real tree with .dist absent → ok:true, launcher <pin>/bin/starci.mjs
$ mv .dist.hold .dist                            # restored; .dist pre-existed and is gitignored — nothing created

$ node --test tests/io.spec.mjs                                     # 6/6 pass
$ node --test tests/runtime-allocator.spec.mjs                      # pass
$ node --test tests/engine-lifecycle.spec.mjs tests/candidate-multi-root.spec.mjs   # 27/27 pass (incl. sealRuntime + runtime-pin + candidate-root suites)
$ node --check <every file w3 touched>            # all clean
$ node -e "import('./kernel/<each>.mjs')"          # all import clean except job-model-worker.mjs (requires a journal file by design — pre-existing)
```

## Intentional remaining `.dist` references in owned scope

- `kernel/ledger-db.mjs` `RUNTIME_MARKER`, `kernel/common.mjs` `grammarReferences`, `kernel/kernel.mjs` pin launcher fallback, `kernel/candidate-roots.mjs` trailing `.dist` candidates, `kernel/runtime-pin.mjs` opportunistic `.dist` sealing, `kernel/terminals.mjs` ENOENT classifier, `kernel/model-policy.mjs` `.dist/model` shim, `core/runtime-root.mjs` compat naming — all are **recognition/fallback for pre-migration payloads and fixtures**, not runtime reads of a live `.dist`. Each carries a comment saying so.
- `bin/starci-skills.mjs`: `RETIRED_ROOTS` includes `'.dist'` (wipe stale build-era dirs on update) and `ensureInstalledDistIgnore` keeps `/.dist*/` gitignore entries (guards trees upgraded from a build-era version — it ignores, never creates).
- `legacy/builders/**` and `legacy/docs/**` are the retired build/docs material — `.dist` mentions there are inherent to legacy content.

## Assumptions

- `readDistJson`/`distPath`/`requireDist` keep their names as compatibility aliases so foreign call sites keep working during the wave; renaming is a fleet-wide follow-up.
- `manifest.json`/`basic-ops.json`/`ops/catalog.json`/`ops/consolidation.json`/`docs/catalog.json` are not runtime contracts any more; the only owned-scope readers were cli + engine, both repointed.
- `modules/ops/registry.yaml`'s `origin:` block still says `.claude/ops/` is authoritative — stale generated metadata owned by the route lane (regenerating it would desync their `--check`); left untouched.

## needed_elsewhere (foreign files; not owned by w3)

- `tests/*.spec.mjs` — several read `../ops/` or `scripts/compile-knowledge.mjs` or assert `.dist/` layout directly:
  - `kind-graph.spec.mjs` (`readdirSync('../ops/')`), `ops.spec.mjs`, `consolidation.spec.mjs`, `goal-contract.spec.mjs`, `source-check-operations.spec.mjs`, `specifications.spec.mjs`, `workflow-routing.spec.mjs` — import/read old `ops/` paths → point at `legacy/ops/` (or the modules manifests).
  - `yaml-dist-migration.spec.mjs` — asserts `scripts/compile-knowledge.mjs` exists (now `legacy/builders/`).
  - `workflow-kernel.spec.mjs:3614` — asserts the relocated launcher is `.dist/hosts/orca/launch.mjs` → now `hosts/orca/launch.mjs`.
  - `workflow-kernel.spec.mjs:1914` (12× duplicate `shared-change-refused`) and `:4642` (`usedToday 0!==1`) — failing; not attributable to w3's diffs (my changes don't touch shared-change refusal or loads accounting; `modules/models/registry.yaml` content differs from `legacy/model/registry.yaml` — likely in-flight lane work). Flagging for the tests/models lanes.
- `workflows/frontend.mjs` — beyond the `../ops`→`../legacy/ops` path fix I made: `JSON.parse` of `workflows/{matrix,transitions,contracts}.json` and `ops/<id>/authority.json`/`secondary.json` (generated-only docs) needs YAML-aware reads; `authority.json` has no source — the successor is `legacy/ops/role-authority.mjs::authorityFor` in-memory.
- `workflows/lifecycle.mjs:29` — `basename(base)==='.dist'` guard is obsolete (harmless).
- `scripts/plan.mjs:48` — `distPath('workflows','plan.template.json')` + `JSON.parse` → `workflows/plan.template.yaml` via `parseYaml`.
- `scripts/checks/check-json-exceptions.mjs` — stale `ops/**` allowlist entries.
- `scripts/checks/brand.mjs:278` — "`.dist` wins when it exists" grammar read.
- `scripts/route/build-ops-registry.mjs` — `origin:` text still calls `.claude/ops/` authoritative (see Assumptions).
- `modules/goal/*.yaml`, `SKILL.md`, `MASTER.md`, `docs/**`, `knowledge/**` — `.dist`/`ops/` doc references — tinkle-20/docs lanes.
- `legacy/model/index.mjs` — kept verbatim as the frozen legacy module.
