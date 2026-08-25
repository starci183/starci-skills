# `architecture/boundary-plan` input

This operator compiles one canonical backend implementation boundary. The input is an ephemeral object owned by the current task session. It is never written to the repository, a worktree, a log, an index, or a receipt file. The runtime purges it at every parent-skill terminal state.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted transition. |
| `payload.provided` | Previous state | Supply immutable task-session references. |
| `payload.loads` | Runtime resolver | Declare exact bindings loaded only after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `businessHeadRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `planningContextRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `sourceReceiptRef`: exact `session://` reference; this operator cannot replace or broaden it.
- `patternBindingRef`: exact `session://` reference; this operator cannot replace or broaden it.

## Loaded by the runtime

- `artifacts`: resolve only references declared by `payload.provided` into task-session memory.
- `knowledge`: retrieve only `be.boundary-planning` from the pinned Qdrant generation.
- `orchestration`: resolve execution mode separately from provider/model mapping.
- `business`: load the exact declared revision from `.worktrees/<project>/businesses/`; product source is not business authority.

Acceptance requires that each target has repository owner, deployable owner, state owner, baseline hash, allowed change, exclusion, dependency, runtime-flow edge and proof. The target set must close every affected ingress, execution, persistence, side-effect and reconciliation hop; cross-process edges must declare caller, callee, transport/auth direction, retry/idempotency and consistency. Validate the whole envelope before any load or side effect. Loaded content and intermediate analysis remain session-only.
