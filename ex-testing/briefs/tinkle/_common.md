# TINKLE — modules fleet (ops + models business analysis)

Read `.claude/SKILL.md` first. Naming: HIHI = the .starciwork fleets (v7-v11) — NOT yours. TINKLE = you.

## Mission
Build `.claude/modules/` as PURE YAML context for AI agents — no scripts. If logic is needed (selection algorithm, tracing), it is DESCRIBED in yaml as declarative rules + rationale; execution engines stay in `.mjs` elsewhere.

## The business-analysis bar — this is the point, not transcription
Every yaml you write must answer the NGHIỆP VỤ questions an agent needs BEFORE using the thing:
- WHAT business question does this op/model answer? (not "what does it do" — "when does a workflow NEED it")
- WHERE in the lifecycle: which node kinds, which prerequisite states, what it consumes/produces
- WHEN NOT to use it — the misuse modes and what goes wrong
- WHO picks it — the selection rules that would route a workload here
Use Vietnamese-or-English field VALUES matching existing convention (operator.yaml files write `goal.en`); keep field NAMES English. Every claim must trace to a real source file — cite it (`source:` comments/paths). If a source is ambiguous, write what is OBSERVED and mark the inferred part explicitly — never invent authority.

## Conventions
- Pure yaml only under `modules/`. Comments are welcome and encouraged — they ARE the context.
- Marker `ex-testing/lint/done/tinkle-<n>.done` + report `ex-testing/lint/tinkle-<n>-REPORT.md`.

## Amendment — script domains + route keys

Script domains are split: `scripts/checks/` (verification) vs `scripts/route/` (selection). `modules/` stays pure yaml.

- Every `modules/ops/<id>.yaml` MUST carry a `route:` block — the declared matching keys: {nodeKinds, phase, intent[], prerequisites[], riskHints?}. This is the resolver's index: an agent must NOT need to read the whole file to route.
- `modules/models/selection.yaml` is the SOURCE OF TRUTH for selection rules (not docs-of-code — the rules themselves, declarative).
- `scripts/route/route-op.mjs` resolves an op from structured input {kind, nodeKind, phase, intent} by matching `route:` blocks — deterministic, output = pick + reasons + yaml path citations.
- `scripts/route/route-model.mjs` resolves a model from {kind, risk, qualityFloor, tools, contextTokens} executing `selection.yaml` rules — same output contract.
- `registry.yaml` under modules/ops is GENERATED (comment at top says so) — never hand-edited; a generator script may live in scripts/route/.
