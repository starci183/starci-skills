# tinkle-6 — scripts/route/ resolvers

Wait gate: `tinkle-1.done` + `tinkle-2.done` — both landed; lane executed after gate opened.

## Deliverables

- `scripts/route/route-op.mjs` — resolves an op from `--kind/--nodeKind/--phase/--intent` by scoring `route:` blocks only (`modules/ops/ops/<id>.yaml`, also accepts flat `modules/ops/*.yaml`). Deterministic weights: exact-kind +1000 > kind-family +100 > nodeKind +10 > phase +5 > +2 per intent overlap; ties by op id. Prints pick + score breakdown + yaml path + prerequisites/riskHints + runner-ups; `--json` supported; exit 1 with per-key reasons when zero candidates match.
- `scripts/route/route-model.mjs` — executes `modules/models/selection.yaml` order-sensitively: normalize → derive (elevation, kernel-function, gate flags) → qualification gates → probation admission → pick + fallback chain. Candidate order: declared `registry.json operators.<kind>.chain` first (closed set — off-chain pools are rejected), else `runtimes.json allocation.preference[role]`. Live evidence from `.dist/model/qualifications.json` (empty today → every route is probation or refusal). Prints model + fired rule + fallback chain; exit 1 on refusal.
- `scripts/route/build-ops-registry.mjs` — regenerates `modules/ops/registry.yaml` from per-op yamls (GENERATED header; entries: id/family/kindInferred/goal/nodeKinds/completionProfile/sideEffects/reads/writes/route/lifecyclePosition/businessQuestion/whenNeeded + stages + engines). `--check` diffs without writing (CI); flags missing `route:` blocks and unknown stage ids.

## Fixture tests

### Op routes — `route-op.mjs`

| # | argv | pick | score / breakdown |
|---|------|------|-------------------|
| 1 | `--kind interface.draw --intent direction` | `interface.draw` | 1002 — exact-kind +1000, intent(direction) +2 |
| 2 | `--kind backend.implement --nodeKind implementation --phase implementation` | `backend.implement` | 1015 — exact + nodeKind + phase |
| 3 | `--kind uat.verify --intent acceptance` | `uat.verify` | 1002 |
| 4 | `--nodeKind ui --phase pre-implementation` (no kind) | `interface.draw` | 15 — nodeKind+phase; tie with `work.author` broken deterministically by id; runners-up `interface.asset`, `architecture.decide`, `brand.decide` |
| 5 | `--kind interface --intent artwork` (family only) | `interface.asset` | 102 — kind-family +100, intent +2; beats `interface.draw`/`interface.implement` (100) on intent |
| 6 | `--kind bogus.thing --intent nonsense` | — | **exit 1**, NO ROUTE with per-key reasons |

### Model workloads — `route-model.mjs`

| # | argv | result |
|---|------|--------|
| 1 | `--kind backend.implement` | PICK `qwen-agent` (model `qwen3.8-flash`, mode probation) — declared chain lead; fallback `devin-agent → claude-agent → codex-agent` |
| 2 | `--kind model.decide` | KERNEL-FUNCTION — all 5 pools eligible (kernel functions keep all members per providerFilter); pick `codex-agent`, chain of 4 |
| 3 | `--kind release.deliver` | **REFUSAL, exit 1** — highKinds → elevated to risk/floor high → probation forbidden, no qualification evidence |
| + | `--kind interface.draw` | `codex-agent` only — the declared chain has one member (sole image-gen route); other 4 pools rejected "not on the declared chain" |
| + | `--kind test.author --risk critical` | **REFUSAL, exit 1** — elevation by risk flag |

Registry: `build-ops-registry.mjs` wrote `modules/ops/registry.yaml` (30 ops, 6 engines); `--check` reports current — generation is idempotent.

## Defects found in consumed lanes — fixed at source

1. **tinkle-1 shipped no `route:` blocks** (mandatory per _common.md amendment). Added a `route:` block to all 30 `modules/ops/ops/<id>.yaml` — keys derived from each file's own `nodeKinds` + `registry.yaml` `lifecyclePosition`/`kindInferred`; derivation helper + nodeKinds repair pass in `ex-testing/lint/scratch/_tinkle6-*.mjs`. All 30 re-parse clean under the strict parser.
2. **tinkle-2 `selection.yaml` line 49**: `- "model.decide           # (model-policy.mjs MODEL_KINDS..."` — a quoted scalar swallowed the comment, corrupting the `kernelFunctionKinds` entry (kernel functions failed to detect). Unquoted the value so `#` is a real comment.
3. **tinkle-1's hand-authored `registry.yaml`** replaced by generated output (the amendment requires it generated); original preserved at `ex-testing/lint/scratch/_tinkle6-registry-handwritten.yaml`.

## Notes for tinkle-5

- `route-model` CLI cannot know workflow state; it prints its probation-assumption set (`approved/local/noExternalEffects/machineGates/freshReview`) on every run — override with `--external`, `--unapproved`, `--no-checks`, `--no-review`.
- A workload whose op declares no machine checks (`kinds.json` + `layoutPolicy.checks` both empty) is legitimately not probation-eligible — that is the source rule, not a resolver bug.
