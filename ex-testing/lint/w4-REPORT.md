# w4 — model + schemas consolidation (tinkle-15 + tinkle-16)

## Missions executed

### 1. Model source consolidation (tinkle-15)

**Diff `model/*.yaml` vs `modules/models/` — ported gaps.** `modules/models/` previously held only
`index.yaml`, `selection.yaml`, `profiles/*.yaml` (tinkle-2 output). Ported verbatim into
`modules/models/` (prose references to `model/<name>.yaml` inside them updated to
`modules/models/<name>.yaml`):

| ported file | schema | consumed by |
|---|---|---|
| capabilities.yaml | starci/model-capability-policy@1 | kernel/model-policy.mjs (now via modules/models) |
| qualifications.yaml | starci/model-qualifications@1 | empty shipped evidence store |
| runtimes.yaml | starci/runtimes@1 | allocator / route-model / config |
| registry.yaml | starci/profile-registry@3 | chains, aliases, operators, supervisors |
| kinds.yaml | starci/kinds@2 | kernel/graph.mjs (loadKinds) |
| records.yaml | starci/records@1 | kernel/io.mjs (loadRecords) |
| hosts.yaml | starci/hosts@1 | hosts/index.mjs (loadHosts) |
| code-patterns.yaml | starci/code-pattern-profile@1 | scripts/checks/check-scoped-lint.mjs |
| claude/codex/qwen/devin.yaml | starci/execution-profiles@1 | per-runtime profile configs (registry.runtimes) |

No json field lacked a yaml equivalent — the old `model/*.yaml` were the authored sources the
`.dist/model/*.json` were compiled from; all fields carry over.

**New canonical loader** `modules/models/index.mjs`: drop-in port of `model/index.mjs` (same exports:
`loadRegistry/loadKinds/loadRecords/loadHosts/loadRuntimes/loadRuntime`, `registry`, `runtimes`,
`normalizeRuntime`, `canonicalTarget`, `resolveModel`, `configFor`, `allocateSlot`, `releaseSlot`)
reading the sibling `modules/models/*.yaml` directly via `core/yaml.mjs` — no `.dist` preference.
`profileDir` fixture option preserved. This is the repoint target for the kernel/hosts imports below.

**kernel/model-policy.mjs** now reads `modules/models/*.yaml` directly:
- `modelSourceFile()` maps any `.../.dist/model/<name>.json` path to `<skillRoot>/modules/models/<name>.yaml`;
  all other paths (test fixtures, per-workflow `runtimeRoot` `model-qualifications.json`/`model-probations.json`
  stores) are honored unchanged.
- `policyFile` now defaults to `modules/models/capabilities.yaml` when omitted.
- Verified: `loadModelEligibilityContext` called with the old `.dist/model/capabilities.json` path resolves
  the yaml and returns `starci/model-capability-policy@1`.

**`git mv model legacy/model`** done (13 files renamed). `legacy/model/index.mjs` is retained as
reference only — its internal `../core`/`../scripts` imports no longer resolve; that is expected for
legacy code.

### 2. Schemas distless (tinkle-16)

- `schemas/` had **no `.json` files** — the json/yaml dedupe was already clean (`goal-plan.yaml` canon,
  no `goal-plan.json`). Nothing deleted.
- Readers repointed from `.dist/schemas/*.json` / `.dist/model/*` to canonical yaml via `parseYaml`:
  - `tests/ops.spec.mjs` — profiles schema now reads `schemas/profiles.yaml` directly.
  - `tests/cli.spec.mjs` — installed-payload assertion `.dist/schemas/work.schema.json` → `schemas/work.schema.yaml`
    (`schemas/` is in the package.json `files` allowlist, so the authored file ships).
  - `tests/helpers/read-public.mjs` — added `readModel(name)` reading `modules/models/<name>.yaml`.
  - `tests/profiles-assets.spec.mjs` — `readPublicJson('model/registry.json')` ×2 → `readModel('registry')`.
- Model readers in tests repointed `model/*.yaml` → `modules/models/*.yaml` (required by the move):
  `tests/io.spec.mjs`, `tests/kind-graph.spec.mjs` (incl. the "compiled profile" parity tests, now against
  the canonical yaml), `tests/hosts.spec.mjs` (+profileDir arg), `tests/workflow-kernel.spec.mjs`,
  `tests/runtime-allocator.spec.mjs`, `tests/w4-fanout.spec.mjs`, `tests/goal-contract.spec.mjs`,
  `tests/execution-contracts.spec.mjs`, `tests/execution-resolve-v3.spec.mjs`, `tests/execution-api-cli.spec.mjs`,
  `tests/graph-invalidation.spec.mjs`, `tests/pattern-coverage.spec.mjs`, `tests/helpers/pools.mjs`,
  `tests/scoped-lint.spec.mjs`, `tests/integration.spec.mjs` (installed-payload asserts now
  `.claude/modules/models/{kinds,hosts}.yaml`), `tests/w3-ops-view.spec.mjs` (comment).
- Fixture dir lists `model` → `modules`: `tests/build-entry.spec.mjs`,
  `tests/application-stacks-integration.spec.mjs`, `tests/yaml-dist-migration.spec.mjs`.
- `scripts/config.mjs` — `runtimeProfile()`/`targetAliases()` now read `../modules/models/{runtimes,registry}.yaml`
  first; `readDistJson` fallback retained for relocated installed payloads during the transition
  (w7 may drop it with `.dist`).
- `scripts/route/route-model.mjs` — `.dist/model/{kinds,runtimes,registry,qualifications}.json` reads →
  `readYaml` on `modules/models/*.yaml`; comments updated. (scripts/route/ is w2's area but the other two
  route files are untouched; this file is purely a model reader.)

## Files changed

- Added: `modules/models/index.mjs`, `modules/models/{capabilities,qualifications,runtimes,registry,kinds,records,hosts,code-patterns,claude,codex,devin,qwen}.yaml`
- Edited: `modules/models/index.yaml`, `modules/models/selection.yaml`, `kernel/model-policy.mjs`,
  `scripts/config.mjs`, `scripts/route/route-model.mjs`, `tests/helpers/read-public.mjs`, and the 20 test
  files listed above.
- Moved (staged `git mv`, uncommitted per instructions): `model/*` → `legacy/model/*` (13 files).

## Verification

- `node --check` on every edited/added `.mjs` — all OK.
- All `modules/models/**/*.yaml` parse via `core/yaml.mjs` parseYaml — ALL OK (15 files + 8 profiles).
- `node --test tests/model-policy.spec.mjs` — **15/15 pass**.
- `node scripts/route/route-model.mjs --kind backend.implement --json` — picks `qwen-agent` (probation
  mode, empty qualification store) ordered by `registry.yaml operators.backend.implement.chain`. Works.
- `import('./modules/models/index.mjs')` — runtimes `codex,claude,qwen,devin`; `canonicalTarget('gpt-5.6-luna')→codex-agent`;
  `loadKinds/loadRecords/loadHosts` return `starci/kinds@2`, `starci/records@1`, `starci/hosts@1`.
- `node --test tests/io.spec.mjs tests/kind-graph.spec.mjs tests/hosts.spec.mjs tests/config.spec.mjs` —
  17/20 pass. `node --test tests/ops.spec.mjs tests/graph-invalidation.spec.mjs
  tests/execution-resolve-v3.spec.mjs tests/execution-api-cli.spec.mjs` — pass.

### Known failures — all expected mid-flight, owned by other lanes

- `ERR_MODULE_NOT_FOUND: ../model/index.mjs` in `kernel/{chains,common,engine,loads,schedule}.mjs` and
  `hosts/headless/host.mjs` — these still import the moved file. **w3/w5 must repoint to
  `../modules/models/index.mjs`** (drop-in; exports identical). Breaks specs that transitively import
  chains/engine (workflow-kernel, goal-contract, runtime-allocator, w4-fanout, profiles-assets, etc.).
- `tests/io.spec.mjs` "compiled catalog is the authored one" — was ALREADY failing before this lane:
  `.dist/model/records.json` is stale vs authored yaml (`checks/stacks.mjs` vs `scripts/checks/stacks.mjs`
  drift from tinkle-4's move; last `.dist` build predates it). Resolves when w3 repoints
  `kernel/io.mjs::loadRecords` off `.dist`.
- `tests/config.spec.mjs` — fails at import via `kernel/chains.mjs` (above), not via config.mjs itself;
  its `.dist/model/runtimes.json` fallback fixture still works through `readDistJson`.

## Needed elsewhere (NOT done — foreign lanes)

- **w3 (kernel/**, cli/, bin/)**: repoint `../model/index.mjs` imports in `kernel/{chains,common,engine,
  loads,schedule}.mjs` → `../modules/models/index.mjs`; internal `.dist/model/*.json` readers in
  `kernel/io.mjs` (records), `kernel/graph.mjs` (kinds), `kernel/schedule.mjs` (runtimes),
  `kernel/kernel.mjs` (policyFile `.dist/model/capabilities.json` ×3 — currently auto-remapped by
  model-policy.mjs, but the literal should be repointed); `cli/main.mjs` `readDistJson('model','registry.json')`
  ×3 and `readDistJson('schemas',...)` ×2. Also `kernel/model-policy.mjs` is double-claimed by w3's brief —
  my changes there are confined to the modelSourceFile remap + default + one import; merge accordingly.
- **w5 (hosts/, tests build machinery, package.json)**: `hosts/index.mjs` `readDistJson('model','hosts.json')`,
  `hosts/headless/host.mjs` `../../model/index.mjs` → `../../modules/models/index.mjs`;
  `package.json` `files` lacks `modules/` (canonical model+ops source) and still lists `model/` —
  installed payload will not ship `modules/models/` until updated; `tests/integration.spec.mjs` payload
  asserts were updated optimistically to `.claude/modules/models/*` and depend on that allowlist change.
  `tests/stacks.spec.mjs` builds a `.dist` fixture for `scripts/checks/stacks.mjs` (excluded file).
- **w2**: `scripts/route/route-plan.mjs:314` comment still says `model/kinds.yaml`.
- **w7**: `.dist` sweep should drop the transitional `readDistJson` fallback in `scripts/config.mjs`,
  the `.dist/model` remap in `kernel/model-policy.mjs`, and `tests/config.spec.mjs`'s compiled-registry
  fixture; `tests/trace.spec.mjs` uses `model/kinds.yaml` as a synthetic input-name literal (cosmetic).
- `tests/application-stacks-integration.spec.mjs:22` asserts build output key `schemas/application-stacks.schema.json`
  — bound to the builder contract w5 is dismantling.

## Assumptions

- `modules/models/` is the canonical home for ALL former `model/*.yaml` (per tinkle-15 "port the gap"),
  including kinds/records/hosts/code-patterns — not only profile data.
- `legacy/model/index.mjs` kept as-is (broken relative imports acceptable for dead reference code).
- json→yaml equivalence: yaml was always the authored source of the compiled json, so no field audit
  found drops; `.dist/model/*.json` remains until w7 deletes `.dist`.
