# tinkle-2 — modules/models/: model profiles + selection algorithm

Read tinkle/_common.md. Sources: `.dist/model/*.json` (claude, codex, devin, qwen, capabilities, kinds, qualifications, registry, runtimes, hosts, records) + `.dist/kernel/model-policy.mjs` (the selection algorithm) + `.dist/docs/model-catalog.md`, `model-functions.md`.

Produce `.claude/modules/models/`:
- `profiles/<model>.yaml` per model/runtime — capabilities, strengths, weaknesses, cost/latency posture, context limits, tool support — from the json facts, PLUS business analysis: which workload kinds this model is FOR, which it must NOT get.
- `selection.yaml` — the selection algorithm AS DECLARATIVE RULES: workload normalization (kind/role/domain/risk/qualityFloor/tools/contextTokens), the risk ladder (low<medium<high<critical), floor ladder (probation<standard<high<critical), qualification gates, fallback order — port the LOGIC of model-policy.mjs into readable rules an agent can reason about. Where the mjs is the only source of a rule, cite the function name.
- `README.md` is NOT wanted — keep everything yaml.

## Amendment — selection.yaml is source of truth
Write selection.yaml as executable-declarative rules (match arms: when {kind,risk,floor,tools} → pick + fallback chain), NOT prose describing model-policy.mjs. tinkle-6 will implement `scripts/route/route-model.mjs` executing YOUR yaml — so write it like a rules file, test by hand-simulating 3 workloads in your report.
