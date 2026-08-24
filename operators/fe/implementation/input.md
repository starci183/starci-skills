# `fe/implementation` input

The input is a closed, ephemeral object owned by the current task session. It is never persisted to the repository, `.worktrees`, Qdrant, logs, or receipt files. The runtime purges it and all resolved values when the parent skill reaches any terminal state.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| `schemaVersion`, `runId`, `stage`, `status`, `facts` | Skill state machine | Bind this invocation to one accepted route and its fact guards. |
| `payload.provided` | Previous machine state | Supply immutable prior-state, business, authority, approval, and baseline references. |
| `payload.loads` | Runtime resolver | Declare the exact values that this operator will load; callers and workers cannot populate or broaden them. |
| `payload.session` | Session runtime | Name task-local input, output, and scratch slots with terminal cleanup. |

## Provided by the previous state

- `priorStateRef`: the accepted upstream state that authorizes turn the approved layout, Grammar convergence, source-fit verdicts, and Principle decisions into bounded frontend source changes.
- `businessHeadRef`: the selected business authority reference.
- `authorityRefs`: the exact approved implementation boundary, layout hash, source-fit result, and Principle compilation references.
- `approvalRef`: the approval binding when the transition requires one; otherwise `null`.
- `baselineRef`: the immutable Git, SHA-256, or task-session baseline.

These fields are references, not copied documents. The operator must not infer substitutes.

## Loaded by the runtime

- `business`: load only the declared revision under `.worktrees/business/`; source code is never business authority.
- `upstream`: resolve only the declared session references for approved implementation boundary, layout hash, source-fit result, and Principle compilation.
- `knowledge`: retrieve `fe.implementation-boundaries` from the pinned generation and content hash.
- `frontendSource`: query only the hash-pinned plain-JSON frontend contract snapshot at its declared generation; the snapshot and generator hashes must match and `rawRepositoryContext` is always `false`.
- `exactTargets`: the coordinator may read and write only the approved repository-relative files after their hashes match.
- `orchestration`: resolve one provider-neutral mode and provider profile; it cannot change routing, approval, or boundaries.

`payload.session` contains URI slots only. Inputs, outputs, loaded values, worker observations, drafts, and evidence are purged at every parent-skill terminal, including failure and rejection.
