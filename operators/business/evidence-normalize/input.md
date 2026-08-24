# `business/evidence-normalize` input

This operator normalizes product-owner evidence. The input is an ephemeral object owned by the current task session. It is never written to the repository, a worktree, a log, an index, or a receipt file. The runtime purges it at every parent-skill terminal state.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted transition. |
| `payload.provided` | Previous state | Supply immutable task-session references. |
| `payload.loads` | Runtime resolver | Declare exact bindings loaded only after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `routeReceiptRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `requestRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `ownerEvidenceRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `sourceEvidenceRefs`: exact `session://` reference; this operator cannot replace or broaden it.

## Loaded by the runtime

- `artifacts`: resolve only references declared by `payload.provided` into task-session memory.
- `knowledge`: retrieve only `business.authority-lifecycle` from the pinned Qdrant generation.
- `orchestration`: resolve execution mode separately from provider/model mapping.
- `business`: load the exact declared revision from `.worktrees/<project>/businesses/`; product source is not business authority.

Acceptance requires that each fact carries owner, source, revision, confidence, and conflict status. Validate the whole envelope before any load or side effect. Loaded content and intermediate analysis remain session-only.
