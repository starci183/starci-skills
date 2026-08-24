# `source/conversation-record` input

This operator records redacted conversation and artifact lineage. The input is an ephemeral object owned by the current task session. It is never written to the repository, a worktree, a log, an index, or a receipt file. The runtime purges it at every parent-skill terminal state.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted transition. |
| `payload.provided` | Previous state | Supply immutable task-session references. |
| `payload.loads` | Runtime resolver | Declare exact bindings loaded only after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `providerRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `conversationSnapshotRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `artifactRefs`: exact `session://` reference; this operator cannot replace or broaden it.
- `redactionReceiptRef`: exact `session://` reference; this operator cannot replace or broaden it.

## Loaded by the runtime

- `artifacts`: resolve only references declared by `payload.provided` into task-session memory.
- `knowledge`: retrieve only `source.provenance` from the pinned Qdrant generation.
- `orchestration`: resolve execution mode separately from provider/model mapping.

Acceptance requires that provider, redaction receipt, artifact hashes, and ownership are valid. Validate the whole envelope before any load or side effect. Loaded content and intermediate analysis remain session-only.
