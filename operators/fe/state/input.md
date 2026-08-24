# `fe/state` input

The input is a closed, ephemeral object owned by the current task session. It is never persisted to the repository, `.worktrees`, Qdrant, logs, or receipt files. The runtime purges it and all resolved values when the parent skill reaches any terminal state.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| `schemaVersion`, `runId`, `stage`, `status`, `facts` | Skill state machine | Bind this invocation to one accepted route and its fact guards. |
| `payload.provided` | Previous machine state | Supply immutable prior-state, business, authority, approval, and baseline references. |
| `payload.loads` | Runtime resolver | Declare the exact values that this operator will load; callers and workers cannot populate or broaden them. |
| `payload.session` | Session runtime | Name task-local input, output, and scratch slots with terminal cleanup. |

## Provided by the previous state

- `priorStateRef`: the accepted upstream state that authorizes derive complete business and Block states plus owned transitions for every page in the approved model.
- `businessHeadRef`: the selected business authority reference.
- `authorityRefs`: the exact page model, business state authority, and approved flow references.
- `approvalRef`: the approval binding when the transition requires one; otherwise `null`.
- `baselineRef`: the immutable Git, SHA-256, or task-session baseline.

These fields are references, not copied documents. The operator must not infer substitutes.

## Loaded by the runtime

- `business`: load only the declared revision under `.worktrees/<project>/businesses/`; source code is never business authority.
- `upstream`: resolve only the declared session references for page model, business state authority, and approved flow.
- `knowledge`: retrieve `fe.state-modeling` from the pinned generation and content hash.
- `source`: this operator loads no frontend source capability and no repository files.
- `orchestration`: resolve one provider-neutral mode and provider profile; it cannot change routing, approval, or boundaries.

`payload.session` contains URI slots only. Inputs, outputs, loaded values, worker observations, drafts, and evidence are purged at every parent-skill terminal, including failure and rejection.
