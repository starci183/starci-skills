# `architecture/boundary-challenge` input

This operator challenges a proposed backend boundary. The input is an ephemeral object owned by the current task session. It is never written to the repository, a worktree, a log, an index, or a receipt file. The runtime purges it at every parent-skill terminal state.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted transition. |
| `payload.provided` | Previous state | Supply immutable task-session references. |
| `payload.loads` | Runtime resolver | Declare exact bindings loaded only after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `boundaryPlanRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `sourceReceiptRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `patternBindingRef`: exact `session://` reference; this operator cannot replace or broaden it.

## Loaded by the runtime

- `artifacts`: resolve only references declared by `payload.provided` into task-session memory.
- `knowledge`: retrieve only `be.boundary-planning` from the pinned Qdrant generation.
- `orchestration`: resolve execution mode separately from provider/model mapping.
- `source`: open only declared exact files and verify their hashes; broad repository context is forbidden.

Acceptance requires that repository, deployable/runtime and data ownership, transport direction, consistency, dependencies, hashes, exclusions and tests are consistent. The challenge must reject central-service overreach, duplicated sources of truth, missing instance-controller hops and reversed cross-process call directions. Validate the whole envelope before any load or side effect. Loaded content and intermediate analysis remain session-only.
