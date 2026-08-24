# `architecture/current-state` input

This operator captures decision-relevant current architecture. The input is an ephemeral object owned by the current task session. It is never written to the repository, a worktree, a log, an index, or a receipt file. The runtime purges it at every parent-skill terminal state.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted transition. |
| `payload.provided` | Previous state | Supply immutable task-session references. |
| `payload.loads` | Runtime resolver | Declare exact bindings loaded only after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `decisionFrameRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `routeReceiptRefs`: exact `session://` reference; this operator cannot replace or broaden it.
- `sourcePartitionRefs`: exact `session://` reference; this operator cannot replace or broaden it.

## Loaded by the runtime

- `artifacts`: resolve only references declared by `payload.provided` into task-session memory.
- `knowledge`: retrieve only `architecture.decision-analysis` from the pinned Qdrant generation.
- `orchestration`: resolve execution mode separately from provider/model mapping.
- `source`: open only declared exact files and verify their hashes; broad repository context is forbidden.

Acceptance requires that each included fact changes the decision and has exact artifact or file evidence. Validate the whole envelope before any load or side effect. Loaded content and intermediate analysis remain session-only.
