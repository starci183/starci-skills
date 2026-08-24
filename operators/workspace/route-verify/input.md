# `workspace/route-verify` input

This operator resolves one request to one project-role route. The input is an ephemeral object owned by the current task session. It is never written to the repository, a worktree, a log, an index, or a receipt file. The runtime purges it at every parent-skill terminal state.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted transition. |
| `payload.provided` | Previous state | Supply immutable task-session references. |
| `payload.loads` | Runtime resolver | Declare exact bindings loaded only after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `projectRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `roleRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `requestRef`: exact `session://` reference; this operator cannot replace or broaden it.

## Loaded by the runtime

- `artifacts`: resolve only references declared by `payload.provided` into task-session memory.
- `knowledge`: retrieve only `workspace.routing` from the pinned Qdrant generation.
- `orchestration`: resolve execution mode separately from provider/model mapping.

Acceptance requires that project, role, request, and checkout identity produce exactly one route. Validate the whole envelope before any load or side effect. Loaded content and intermediate analysis remain session-only.
