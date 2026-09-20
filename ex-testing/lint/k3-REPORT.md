# k3-REPORT — kernel API contract (lane k3, contract writer)

Verdict: **pass**

## What was written

| file | action | content |
|---|---|---|
| `modules/kernel/api.yaml` | NEW (278 lines) | Full contract for `scripts/kernel/api.mjs` (k1): conventions (invoke shape, JSON stdout, `{ok:false, reason}` refusals, BEGIN IMMEDIATE + hash-chained event per write, complete-identity binding, neverDoes list) + all 8 commands — each with `args` / `reads` / `writes` / `returns` / `refuses` / `usedBy` — + `tableMap` (command → ledger table read/write matrix). |
| `modules/kernel/driver-loop.yaml` | REWRITE of §1 `tick:` | Loop now expressed in api calls: `survey → plan → enqueue → drive{ status → dispatch → wait → settle → repair } → retire`. Preserved semantics inside the new steps: computed-not-remembered frontier (`survey.neverMemory`), plan-divergence → `api incident` + escalate with NO dispatch (`plan.divergence`), owned_paths on the job row so disjointness is checkable pre-agent (`enqueue.boundary`), planDispatch file/lease/group levels as api refusals (`drive.dispatch.eligibility`), route-op/route-model/verifyAvoids (`drive.dispatch.route`), one-lease-one-agent (`oneOpOneAgent`), marker+report is the verdict (`drive.wait.rule`, `drive.settle`), `done` never trusted — checks re-run + git-computed files (`drive.settle.neverTrust`), exact-identity settlement fence (`durableHalf`), retry attempt+1 vs `api incident` past budget (`drive.repair`). §§2–6 (verdictTable, replanTriggers, escalation, failureHandling, supervision) unchanged. Header + `about.sources` updated to cite `scripts/kernel/api.mjs` + `api.yaml`. |
| `modules/kernel/dispatch.yaml` | UPDATE | Packet fields unchanged (`op`, `brief`, `context.records`, `context.owned_paths`, `constraints`, `returns`). `spawnMechanics` now leads with `caller`: the kernel calls `api dispatch --job <id> --spawn` and never runs orca terminal-* itself; `--spawn` omitted = dry-run packet. Adapter-card flags + managed-agent `--spawn` refusal cited. |
| `modules/kernel/start-workflow.yaml` | UPDATE (minimal) | File already carried routed-kernel semantics (`route-model --kind model.manageWorkflow`, spawn flags from `providers/orca/adapters/<provider>.yaml`, api.mjs command list in the prompt). Added `api.yaml` to the kernel's mandatory load order; fixed a pre-existing YAML syntax error (line 68: trailing ` — the singleton lock` after a flow map → converted to `#` comment) so the repo parser accepts the file. |

## Contract decisions worth noting

- **`plan` diff is structural only** (op ids + dependsOn edges vs approved `goals.json.opChain`); the api reports `divergent:true` and the driver escalates — the api never decides (kernel reasons, api transacts).
- **`enqueue` refuses duplicates** (`already-queued`) — an existing pending/in-flight row IS the queue entry; retries are new rows at `attempt+1`.
- **`dispatch` without `--spawn` is a dry-run** packet preview — mirrors `dispatch-op.mjs`'s existing never-spawn-silently rule.
- **`retire` preserves history** — `workflows.phase=finished`, inbox consumed, kernel signal released; nothing deleted.
- **Refusals are typed kebab-strings** the driver loop matches on (e.g. `stale-settlement`, `path-collision`, `contested-lease`, `jobs-unsettled`).

## Evidence verified

- `node -e` + `core/yaml.mjs parseYaml` on all five `modules/kernel/*.yaml` — all OK (output below).
- No tabs in any edited file (checked programmatically).
- All cross-referenced paths verified to exist: `kernel/ledger-db.mjs` (table DDL cited in `tableMap`), `kernel/engine.mjs`, `kernel/dispatcher.mjs`, `kernel/admission.mjs`, `schemas/goal-plan.yaml`, `modules/ops/ops/<id>.yaml` dir, `providers/orca/adapters/*.yaml` (`commandPrefix`/`commandRequirements`/`credentialRefresh`/`terminalFallback`/`bypassFlag` fields verified real), `modules/models/selection.yaml` (`kernelFunctionKinds` incl. `model.manageWorkflow` at line 51), `scripts/route/route-model.mjs`, `scripts/route/dispatch-op.mjs` (the mechanism `api dispatch` supersedes).

```
OK modules/kernel/api.yaml
OK modules/kernel/driver-loop.yaml
OK modules/kernel/dispatch.yaml
OK modules/kernel/start-workflow.yaml   (after fixing pre-existing line-68 syntax error)
OK modules/kernel/verdict-contract.yaml
```

## Notes / handoffs

- `scripts/kernel/api.mjs` does not exist yet (lane k1 in flight) — `api.yaml` is written as its contract: command names, args, refusal reason strings and output shapes are the spec to implement against.
- `modules/kernel/start-workflow.yaml` was already updated by a sibling lane before my pass (routing + adapter-card + api prompt were present); my diff there is the load-order addition + the syntax fix only.
- Git: `modules/kernel/api.yaml` + `start-workflow.yaml` are untracked; `driver-loop.yaml` + `dispatch.yaml` modified. No commits made.
