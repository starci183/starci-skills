# `fe/grammar-convergence` input

The input is a closed, ephemeral object owned by the current task session. It is never persisted to the repository, `.worktrees`, Qdrant, logs, or receipt files. The runtime purges it and all resolved values when the parent skill reaches any terminal state.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| `schemaVersion`, `runId`, `stage`, `status`, `facts` | Skill state machine | Bind this invocation to one accepted route and its fact guards. |
| `payload.provided` | Previous machine state | Supply immutable prior-state, business, authority, approval, and baseline references. |
| `payload.loads` | Runtime resolver | Declare the exact values that this operator will load; callers and workers cannot populate or broaden them. |
| `payload.session` | Session runtime | Name task-local input, output, and scratch slots with terminal cleanup. |

## Provided by the previous state

- `priorStateRef`: the accepted upstream state that authorizes bind an approved layout to the locked Grammar packages and refuse business semantics inside Grammar.
- `grammarId`: the selected Grammar identity, exactly `core` or `offset-pop`.
- `authorityRefs`: the exact approved layout, neutral fact model, npm Grammar lock, installed public export map, and applicable contract references.
- `approvalRef`: the approval binding when the transition requires one; otherwise `null`.
- `baselineRef`: the immutable Git, SHA-256, or task-session baseline.

These fields are references, not copied documents. The operator must not infer substitutes.

## Loaded by the runtime

- `upstream`: resolve only the declared session references for the approved layout, neutral fact model, exact npm package lock, installed public export map, and applicable package-contract hashes.
- `knowledge`: retrieve Common overview and contracts, the selected Grammar overview, and only the object or named-case guides triggered by the approved layout. Never retrieve any guide from the unselected Grammar. The guides explain when and how to use package capabilities; they are never implementation authority.
- `frontendSource`: query only the hash-pinned plain-JSON effective application-contract snapshot under `.worktrees/<project>/coding-context/frontend/`; the snapshot and generator hashes must match and `rawRepositoryContext` is always `false`. It may locate consumers and declared extension points, but it cannot replace the installed npm package contract.

No business document is loaded. The approved neutral fact model is the only presentation-state boundary; any business-named state or entity in Grammar is a refusal.
- `orchestration`: resolve one provider-neutral mode and provider profile; it cannot change routing, approval, or boundaries.

`payload.session` contains URI slots only. Inputs, outputs, loaded values, worker observations, drafts, and evidence are purged at every parent-skill terminal, including failure and rejection.
