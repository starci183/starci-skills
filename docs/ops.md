# Ops — writing an operation contract

An **op** is the unit of work the kernel dispatches to one ephemeral `[Op]`
agent. Every op is an authored YAML manifest at `modules/ops/ops/<id>.yaml` —
data, not code. Every manifest holds one shape, `starci/op@1`, declared by
`modules/schemas/op.schema.yaml` and enforced by
`node scripts/checks/check-op-manifest.mjs`. The kernel never reads a whole
manifest to route: routing reads only the `route:` block; the rest is the brief
the dispatched agent executes under.

## The shape

```yaml
schema: starci/op@1              # every manifest stamps its own shape
id: backend.implement            # <family>.<verb>; the file name matches it
goal: {en: "…"}                  # one sentence: what this operation establishes

params:                          # every tunable, typed — the only place one lives
  maxFiles:
    type: integer                # integer | number | string | boolean | enum
    default: 12                  # what applies when nobody sets it
    min: 1                       # min/max for a number, enum: [...] for a choice
    setBy: kernel                # kernel — the kernel sets it at enqueue
    doc: {en: "…one sentence of meaning…"}

nodeKinds: [implementation]      # which .starciwork node kinds may carry it
completionProfile: implementation
sideEffects: [...]               # honest list: source edits, scoped commits, …

graphPolicy:                     # how the op may touch the record graph
  mode: read-only                # it reads node records; it does not reshape them
  prerequisiteState: done        # declared prerequisites must be effectively done
  dispatch: never                # an op never spawns further work itself

reads:                           # the CLOSED read set — DATA, one entry per source
  - id: architecture
    path: .starciwork/features/<feature>/{sds,contract}/**/index.yaml
    purpose: {en: "…what data sits at this path…"}

writes:                          # the CLOSED write set — DATA, one path per entry
  - id: evidence
    path: E/**                   # one path, or one glob; never `a + b + c`
    schema: starci/asset-manifest@1   # the const a structured write carries
    fields: [id, nodeId, inputDigest, outcome, assertions, assets]
    artifacts: [manifest.yaml, tests.json, result.md]   # what a bundle holds
    content: {en: "…what the written data holds…"}

steps:                           # the RULES, each one written exactly once
  - reads: [architecture]
    writes: [evidence]
    action: {en: "…never write more files than `params.maxFiles`…"}

proofs:                          # what settle verifies
  - id: behavior
    requirement: {en: "Scoped unit tests and backend E2E tests both pass …"}
    check: scripts/checks/check-work-deep.mjs    # the executable, when one exists

blockers:                        # typed escape hatches, not free text
  - code: SCOPE_WIDENING
    condition: {en: "Required operation lies outside selected code-scope."}

placeholders: {feature: Selected feature slug}   # the <tokens> the paths use
layoutPolicy: {...}              # where artifacts land, which validator refuses

policy:                          # ONE map for everything op-specific
  commitPolicy: {mode: scoped-local-commit, push: false}
  qualityPolicy: {checks: [lint, typecheck, unit], requiredResult: pass}

route:                           # the resolver index — route-op.mjs reads ONLY this
  nodeKinds: [implementation]
  phase: [implement, implementation]
  intent: [implement, backend, code, api, build]
  prerequisites: ["architecture.decide settled pass"]
  riskHints: [source-edits]
```

No other top-level key exists. A manifest that declares `commitPolicy`,
`executionModes`, `findingSchema`, `proposalAuthority` or any other invented key
beside `id:` is refused; those go under `policy:`.

## Where a rule lives

One rule has one place to be done and at most one place to be checked.

| Section | Holds | Never holds |
|---|---|---|
| `reads[].purpose` | what data sits at that path | a rule — no `must`, `never`, `only`, `reject` |
| `writes[].content` | what the written data holds | a rule about how to produce it |
| `steps[].action` | the rules, each stated once | a number a param already carries |
| `proofs[].requirement` | what settle verifies | a second copy of the step's rule |
| `blockers[].condition` | when the op legitimately stops | a repair procedure |
| `policy` | op-specific policy data | prose an agent is meant to follow |

An op has no authored summary. `modules/ops/registry.yaml` is generated from
these manifests by `node scripts/route/build-ops-registry.mjs` and carries the
one-line goal, the params, the route keys and the lifecycle position — that is
where a reader looking for "what is this op for" goes.

## How params flow

A tunable is a value, not a sentence. The manifest declares it once; the owner
or the kernel may set it; the packet delivers the resolved number.

```text
goal leg          scripts/goal/define-goal.mjs --params '{"<op>":{"<name>":<value>}}'
                  → goals.json.opChain.legs[].params   (modules/schemas/goal-plan.yaml)
enqueue           api enqueue --op <id> --params '<json>'
                  → resolveOpParams validates type, min, max, enum and setter
                  → refuses `params-invalid` before any jobs row exists
                  → the row stores only the overrides
dispatch          api dispatch → the brief's defaults with the overrides on top
                  → packet.params (modules/kernel/dispatch.yaml)
the agent         reads `params.<name>` from its packet, never a number from prose
```

`setBy: owner` means only the approved goal leg may carry it — `--params` can
relay it at enqueue, but only when the leg already names it. `setBy: kernel`
means the kernel sets it and a goal leg cannot. One resolver does all of it:
`resolveOpParams` in `scripts/route/dispatch-op.mjs`.

## What the check refuses

`node scripts/checks/check-op-manifest.mjs` validates every manifest and exits 1
on any finding.

| Code | Refused because |
|---|---|
| `SCHEMA_INVALID` | an unknown top-level key, a missing section, a param with no default, an id that is not the file name |
| `PARAM_RESTATED` | a step or proof spells out a number (`five rounds`, `3 candidates`) the op already carries as a param |
| `RULE_DUPLICATED` | one sentence of twelve words or more appears twice in the same manifest |
| `RULE_IN_DATA` | a `reads[].purpose` carries `must`, `never`, `only` or `reject` — the rule belongs in the step that applies it |
| `PATH_JOINED` | a `writes[].path` joins several paths with ` + ` instead of naming one path or one glob |
| `CHECK_MISSING` | a `proofs[].check` names a file that is not on disk |

## Lifecycle of an op

```text
kernel: api enqueue --op <id> --paths <csv> [--params '<json>']
      → api dispatch --job <id> --spawn      (packet = {op, brief, params, context, constraints, returns})
      → [Op] agent works inside owned_paths, files its report row
      → api report --job <id> --report <file>  (starci/op-report@1 envelope)
      → api consume-report → api check → api settle --job <id> --verdict <v>
```

The packet fields and lease semantics are `modules/kernel/dispatch.yaml`; what
`settle` accepts is `modules/kernel/verdict-contract.yaml`; the tick that calls
them is `modules/kernel/driver-loop.yaml` ([workflow-kernel](workflow-kernel.md)).

## Checklist for a new op

1. Pick a unique `<family>.<verb>` id; create `modules/ops/ops/<id>.yaml` and
   stamp `schema: starci/op@1`.
2. Declare `goal`, `nodeKinds`, `completionProfile`, honest `sideEffects`.
3. Put every number the operation depends on into `params`, with a default and
   a setter; cite it from the steps as `params.<name>`.
4. Enumerate `reads`/`writes` minimally, as data — the write set becomes
   `owned_paths`. One path per entry; a bundle names its `artifacts`.
5. Write each rule once, in the step that applies it.
6. Write `proofs` that say what settle verifies, with a `check:` when an
   executable proves it.
7. Declare every legitimate stop as a `blockers` entry.
8. Put anything op-specific left over under `policy:`.
9. Fill `route:` so route-op resolves it.
10. Run `node scripts/checks/check-op-manifest.mjs`, then
    `node scripts/route/build-ops-registry.mjs` to regenerate the registry and
    `--check` to verify (never hand-edit it; see
    [ops-source-ownership](ops-source-ownership.md)).
11. Dry-run: `node scripts/kernel/api.mjs dispatch --job <id>` (no `--spawn`)
    prints the packet, params included, without reserving or launching.
