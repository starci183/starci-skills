# `workspace/routes-hydrate` input

This operator hydrates machine-local routes from portable declarations. The input is an ephemeral object owned by the current task session. It is never written to the repository, a worktree, a log, an index, or a receipt file. The runtime purges it at every parent-skill terminal state.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted transition. |
| `payload.provided` | Previous state | Supply immutable task-session references. |
| `payload.loads` | Runtime resolver | Declare exact bindings loaded only after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `compiledDeclarationsRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `localRepositoryMapRef`: exact `session://` reference; this operator cannot replace or broaden it.

## Loaded by the runtime

- `artifacts`: resolve only references declared by `payload.provided` into task-session memory.
- `knowledge`: retrieve only `workspace.initialization` from the pinned Qdrant generation.
- `orchestration`: resolve execution mode separately from provider/model mapping.

Acceptance requires that each local repository mapping resolves once within declared roots. Validate the whole envelope before any load or side effect. Loaded content and intermediate analysis remain session-only.
