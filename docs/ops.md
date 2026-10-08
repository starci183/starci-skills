Owner: modules/ops/
# Ops — writing an operation contract

An **op** is the unit of work the kernel dispatches to one ephemeral `[Op]`
agent. Every op is an authored YAML manifest at `modules/ops/ops/<id>.yaml` —
data, not code. Every manifest holds one shape, `starci/op@1`, declared by
`modules/schemas/op.schema.yaml` and enforced by
`starci runtime check --only op-manifest`. The kernel never reads a whole
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
    path: evidence/**                   # one path, or one glob; never `a + b + c`
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
    requirement: {en: "Scoped unit tests pass; backend E2E runs only in an explicitly selected e2e.verify leg …"}
    check: scripts/work/validate/check-work-deep.mjs    # the executable, when one exists

blockers:                        # typed escape hatches, not free text
  - code: SCOPE_WIDENING
    condition: {en: "Required operation lies outside selected code-scope."}

placeholders: {feature: Selected feature slug}   # the <tokens> the paths use
layoutPolicy: {...}              # where artifacts land, which validator refuses

policy:                          # ONE map for everything op-specific
  qualityPolicy: {checks: [lint, typecheck, unit], requiredResult: pass}

route:                           # the resolver index — route-op.mjs reads ONLY this
  nodeKinds: [implementation]
  phase: [implement, implementation]
  intent: [implement, backend, code, api, build]
  prerequisites: ["architecture.decide settled pass"]
  riskHints: [source-edits]
```

No other top-level key exists. A manifest that declares
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
these manifests by `starci runtime gen-ops` and carries the
one-line goal, the params, the route keys and the lifecycle position — that is
where a reader looking for "what is this op for" goes.

## How params flow

A tunable is a value, not a sentence. The manifest declares it once; the owner
or the kernel may set it; the packet delivers the resolved number.

```text
goal leg          scripts/goal/define-goal.mjs --params '{"<op>":{"<name>":<value>}}'
                  → goals.json.opChain.legs[].params   (modules/schemas/goal-plan.yaml)
enqueue           starci kernel enqueue --op <id> --params '<json>'
                  → resolveOpParams validates type, min, max, enum and setter
                  → refuses `params-invalid` before any jobs row exists
                  → the row stores only the overrides
dispatch          starci kernel dispatch → the brief's defaults with the overrides on top
                  → packet.params (modules/kernel/dispatch.yaml)
the agent         reads `params.<name>` from its packet, never a number from prose
```

`setBy: owner` means only the approved goal leg may carry it — `--params` can
relay it at enqueue, but only when the leg already names it. `setBy: kernel`
means the kernel sets it and a goal leg cannot. One resolver does all of it:
`resolveOpParams` in `scripts/kernel/dispatch-op.mjs`.

## What the check refuses

`starci runtime check --only op-manifest` validates every manifest and exits 1
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
kernel: starci kernel enqueue --op <id> --paths <csv> [--params '<json>']
      → starci kernel dispatch --job <id> --spawn      (the workflow worktree resolved, no worktree per op; worker-start; packet = {op, brief, params, context, constraints, returns})
      → [Op] agent runs the op loop inside owned_paths: READ (read-digest.mjs) → CODE → gate.mjs → FIX → REPORT
      → starci kernel report --job <id> --report <file>  (starci/op-report@1 envelope, gate.json and read-digest.json attached)
      → starci kernel consume-report → starci kernel record-checks → starci kernel settle --job <id> --verdict <v>
                                           (op-gate enforcement; a green op is a checkpoint on wf-<workflowId>, a failed one is preserved and reset; worker released)
```

The packet fields and lease semantics are `modules/kernel/dispatch.yaml`; what
`settle` accepts is `modules/kernel/verdict-contract.yaml`; the op loop, the merge guard and
the workflow worktree, its checkpoints and the finish that alone touches main are in [workflow-kernel](workflow-kernel.md). The Job controller
handles eligible green reports and dispatch mechanics; the Kernel makes
non-green decisions through `modules/kernel/driver-loop.yaml`
([workflow-kernel](workflow-kernel.md)).

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
10. Run `starci runtime check --only op-manifest`, then
    `starci runtime gen-ops` to regenerate the registry and
    `--check` to verify (never hand-edit it; see
    [ops-source-ownership](ops-source-ownership.md)).
11. Dry-run: `starci kernel dispatch --job <id>` (no `--spawn`)
    prints the packet, params included, without reserving or launching.

<!-- roles:begin op -->
**Op** (modules/kernel/roles.yaml#op): One unit of work of one workflow.
- Does:
  - Does exactly one job under its contract: the required reads, the work, its own checks, and a report with evidence.
  - When it cannot decide or is blocked, reports up to its Kernel with the cause: that is a correct error.
- Must clean up:
  - its own processes, temp files and servers, before it reports
- Never:
  - grades itself
  - writes outside its scope
  - runs a command outside its allowed list
  - starts a server outside the runtime-slot verbs
  - addresses anyone but its Kernel: its reports, questions, blocked causes and owner asks all go to its Kernel
  - sits stuck without reporting
- Owns: one attempt and its worktree. Decides alone: how to do the work inside its contract.
- Reports to: Kernel (done, blocked, or a question). Overseen by: Kernel.
- Measure: passes its gate first time.
- Token budget (provisional): 6000000 per attempt; over it, the Kernel acts on the overrun: it reads the attempt's usage, then stops, re-scopes or switches agent.
- Principles: P2 P3 P4 P8 (modules/kernel/roles.yaml, principles).
<!-- roles:end op -->

<!-- roles:begin critic -->
**Critic** (modules/kernel/roles.yaml#critic): One product of one op.
- Does:
  - Grades that product independently: from a different provider than the op that made it, seeing only the product and the rubric, not the op's context.
  - Returns its verdict as evidence attached to the attempt of the op it judged.
- Must clean up:
  - its placement worktree and processes, before it returns the verdict
- Never:
  - edits the product
  - grades when it shares the maker's provider
  - addresses anyone but through the attempt
- Owns: one verdict. Decides alone: the score by the rubric.
- Reports to: Kernel (always, as the verdict attached to the op's attempt). Overseen by: Kernel, the runtime.
- Measure: its verdict agrees with the later outcome.
- Principles: P2 P3 P7 (modules/kernel/roles.yaml, principles).
<!-- roles:end critic -->
