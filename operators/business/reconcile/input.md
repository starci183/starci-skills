# `business/reconcile` input

This operator reconciles delivery proof with business authority. The input is an ephemeral object owned by the current task session. It is never written to the repository, a worktree, a log, an index, or a receipt file. The runtime purges it at every parent-skill terminal state.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted transition. |
| `payload.provided` | Previous state | Supply immutable task-session references. |
| `payload.loads` | Runtime resolver | Declare exact bindings loaded only after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `businessHeadRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `deliveryProofRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `finalSourceHeadsRef`: exact `session://` reference; this operator cannot replace or broaden it.

## Loaded by the runtime

- `artifacts`: resolve only references declared by `payload.provided` into task-session memory.
- `knowledge`: retrieve only `business.authority-lifecycle` from the pinned Qdrant generation.
- `orchestration`: resolve execution mode separately from provider/model mapping.
- `business`: load the exact declared revision from `.worktrees/business/`; product source is not business authority.

Acceptance requires that every accepted outcome is proved by final source heads or reported as a discrepancy. Validate the whole envelope before any load or side effect. Loaded content and intermediate analysis remain session-only.
