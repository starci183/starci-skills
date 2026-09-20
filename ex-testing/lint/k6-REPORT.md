# k6 REPORT — `--plan` what-if tier preview on route-model.mjs

Lane: k6. Owned file: `scripts/route/route-model.mjs` (only file touched; +133/-5).
No commits. `runtimes.yaml`, `selection.yaml`, `kinds.yaml` untouched.

## What was built

`node scripts/route/route-model.mjs --kind <opKind> --difficulty <easy|medium|hard> [--json] --plan`

- `--difficulty` and `--plan` added to `parseArgs`; `--plan` without a valid
  `--difficulty` exits 2 (`--plan requires --difficulty <easy|medium|hard>`).
- Plan mode derives the workload through the same `deriveWorkload` path
  (risk/floor defaults from `selection.yaml` ladders, elevation for
  `highKinds`), but resolves the role via `runtimes.yaml roleOfKind`
  (falling back to `kinds.yaml` role) per spec.
- Chain lookup: `runtimes.yaml allocation.tiers.<difficulty>` — role-keyed
  when the tier is a map (`tiers.hard.implement`, `tiers.medium.decide`),
  `tier.default` when the role has no entry, bare list for `easy`.
- Per candidate (read straight from `runtimes.yaml runtimes.<id>`): target,
  provider, per-role `models[role]`, `maxParallel`, and status
  `qualified | probation-only | rejected` — reusing the real
  `qualificationReasons` + `probationAdmissionReasons` gates. Missing/stale
  evidence is annotated (`no qualification evidence on disk` /
  `qualification evidence on disk is stale`) instead of being fatal.
- Ordered pick: `qualified` > `probation-only` > evidence-excused `rejected`
  (a rejected pool stays pickable only when every qualification failure is
  absent/stale evidence — probation reasons are workload-level and never
  disqualify a pool in the preview); ties break by tier chain order.
  Prints `primary: X (reason)`, `fallbacks: [...]`, and a cold estimate
  (easy 15m / medium 45m / hard 90m). Exit 1 only when nothing is pickable.
- `--json` emits `{plan, difficulty, workload, tier, candidates, pick,
  estimate}` — an additive shape; non-plan JSON is untouched.
- Non-plan path untouched: same exit codes, same JSON shape, same refusal
  semantics (verified below).

## `node --check`

```
$ node --check scripts/route/route-model.mjs && echo CHECK-OK
CHECK-OK
```

## Smoke 1 — `--kind code.refactor --difficulty hard --plan`

```
plan what-if: kind=code.refactor role=implement difficulty=hard
workload: risk=medium floor=standard tools=[] ctx=0
chain: runtimes.yaml allocation.tiers.hard.implement  ->  [claude-agent, devin-agent, codex-agent]
candidates:
  1. claude-agent  provider=claude  model=claude-opus-5  maxParallel=6  status=probation-only  (no qualification evidence on disk)
  2. devin-agent  provider=devin  model=swe-2-max  maxParallel=10  status=probation-only  (no qualification evidence on disk)
  3. codex-agent  provider=codex  model=gpt-5.6-luna  maxParallel=10  status=probation-only  (no qualification evidence on disk)
primary: claude-agent (no qualification evidence on disk; scoped probation would admit)
fallbacks: [devin-agent (probation-only), codex-agent (probation-only)]
estimate: cold ~90m for a hard operation
EXIT=0
```

## Smoke 2 — `--kind test.author --difficulty easy --plan`

```
plan what-if: kind=test.author role=implement difficulty=easy
workload: risk=medium floor=standard tools=[] ctx=0
chain: runtimes.yaml allocation.tiers.easy  ->  [qwen-agent, devin-agent, codex-agent, claude-agent]
candidates:
  1. qwen-agent  provider=qwen  model=qwen3.8-flash  maxParallel=4  status=probation-only  (no qualification evidence on disk)
  2. devin-agent  provider=devin  model=swe-2-max  maxParallel=10  status=probation-only  (no qualification evidence on disk)
  3. codex-agent  provider=codex  model=gpt-5.6-luna  maxParallel=10  status=probation-only  (no qualification evidence on disk)
  4. claude-agent  provider=claude  model=claude-opus-5  maxParallel=6  status=probation-only  (no qualification evidence on disk)
primary: qwen-agent (no qualification evidence on disk; scoped probation would admit)
fallbacks: [devin-agent (probation-only), codex-agent (probation-only), claude-agent (probation-only)]
estimate: cold ~15m for an easy operation
EXIT=0
```

## Extra checks

Elevated kind (`release.deliver` is in `highKinds`): all candidates honestly
show `rejected` (probation banned), yet the what-if pick still names a
primary — exactly the "annotate, don't fail" contract:

```
$ node scripts/route/route-model.mjs --kind release.deliver --difficulty hard --plan --verbose
plan what-if: kind=release.deliver role=implement difficulty=hard
workload: risk=high floor=high tools=[] ctx=0  ELEVATED
chain: runtimes.yaml allocation.tiers.hard.implement  ->  [claude-agent, devin-agent, codex-agent]
candidates:
  1. claude-agent  provider=claude  model=claude-opus-5  maxParallel=6  status=rejected  (no qualification evidence on disk)
     reasons: model qualification evidence is missing; probation cannot satisfy elevated quality or risk; workload shape is not probation-eligible (needs machine checks + fresh review, or a kernel function)
  2. devin-agent  provider=devin  model=swe-2-max  maxParallel=10  status=rejected  (no qualification evidence on disk)
     reasons: model qualification evidence is missing; probation cannot satisfy elevated quality or risk; workload shape is not probation-eligible (needs machine checks + fresh review, or a kernel function)
  3. codex-agent  provider=codex  model=gpt-5.6-luna  maxParallel=10  status=rejected  (no qualification evidence on disk)
     reasons: model qualification evidence is missing; probation cannot satisfy elevated quality or risk; workload shape is not probation-eligible (needs machine checks + fresh review, or a kernel function)
primary: claude-agent (what-if pick: no qualification evidence on disk — launch still requires measured qualification (probation cannot satisfy this workload))
fallbacks: [devin-agent (rejected), codex-agent (rejected)]
estimate: cold ~90m for a hard operation
EXIT=0
```

Role-keyed medium tier + `--json` (`architecture.decide` → role `decide`,
per-role models `claude-fable-5-1` / `gpt-6-astra`):

```
$ node scripts/route/route-model.mjs --kind architecture.decide --difficulty medium --plan --json
{
  "plan": true,
  "difficulty": "medium",
  "workload": { "kind": "architecture.decide", "role": "decide", "risk": "medium", "qualityFloor": "standard", ... },
  "tier": { "source": "runtimes.yaml allocation.tiers.medium.decide", "chain": ["claude-fable", "codex-agent", "claude-agent"] },
  "candidates": [
    {"target": "claude-fable", "provider": "claude", "model": "claude-fable-5-1", "maxParallel": 2, "status": "probation-only", "evidence": "no qualification evidence on disk"},
    {"target": "codex-agent", "provider": "codex", "model": "gpt-6-astra", "maxParallel": 10, "status": "probation-only", "evidence": "no qualification evidence on disk"},
    {"target": "claude-agent", "provider": "claude", "model": "claude-opus-5", "maxParallel": 6, "status": "probation-only", "evidence": "no qualification evidence on disk"}
  ],
  "pick": {"primary": {"target": "claude-fable", "model": "claude-fable-5-1", "status": "probation-only"},
           "reason": "no qualification evidence on disk; scoped probation would admit",
           "fallbacks": [{"target": "codex-agent", ...}, {"target": "claude-agent", ...}]},
  "estimate": {"difficulty": "medium", "coldMinutes": 45}
}
EXIT=0
```

Arg validation:

```
$ node scripts/route/route-model.mjs --kind code.refactor --plan
--plan requires --difficulty <easy|medium|hard>
EXIT=2
$ node scripts/route/route-model.mjs --kind code.refactor --difficulty bogus --plan
--plan requires --difficulty <easy|medium|hard>
EXIT=2
```

## Non-plan behavior unchanged

```
$ node scripts/route/route-model.mjs --kind code.refactor
workload: kind=code.refactor role=implement risk=medium floor=standard tools=[] ctx=0
assumed: approved=true local noExternalEffects=true strictMachineGates=true freshIndependentReview=true
PICK qwen-agent  model=qwen3.8-flash  mode=probation
  rule: decisionFlow.probation-fallback: no qualification evidence; scoped probation admitted
  order: registry.yaml operators.code.refactor.chain
fallback chain:
  -> devin-agent (swe-2-max) [probation]
  -> claude-agent (claude-opus-5) [probation]
  -> codex-agent (gpt-5.6-luna) [probation]
  note: probation admits exactly one target for one durable job; fallbackChain lists order, not parallel admission
EXIT=0

$ node scripts/route/route-model.mjs --kind release.deliver
workload: kind=release.deliver role=implement risk=high floor=high tools=[] ctx=0  ELEVATED
assumed: approved=true local noExternalEffects=true strictMachineGates=true freshIndependentReview=true
REFUSAL — decisionFlow.verdict: no eligible model
  qwen-agent: model qualification evidence is missing; probation cannot satisfy elevated quality or risk; ...
  devin-agent: model qualification evidence is missing; probation cannot satisfy elevated quality or risk; ...
  claude-agent: model qualification evidence is missing; probation cannot satisfy elevated quality or risk; ...
  codex-agent: model qualification evidence is missing; probation cannot satisfy elevated quality or risk; ...
  claude-fable: pool is not on the declared chain for release.deliver
EXIT=1
```

Refusal exit code 1 and JSON shape for existing callers are byte-identical
to pre-change behavior (the plan branch returns before `loadCandidates` /
`candidateOrder` run and is unreachable without `--plan`).

## Notes / decisions the parent may want to know

- "Missing/stale evidence doesn't fail the pick" was implemented as: a pool
  rejected *only* because evidence is absent/stale still appears as a what-if
  primary/fallback, with the reason string making the caveat explicit. Pools
  that fail real gates (role not served, no runtimes.yaml entry, evidence
  present but unfit) stay unpickable.
- `--difficulty` selects the *tier preview* only; it does not raise workload
  risk/floor (spec: "derive workload as today"). Elevation still comes from
  `highKinds`/explicit `--risk`/`--floor`.
- No tests exist for this script in-repo; verification was CLI smoke only.
