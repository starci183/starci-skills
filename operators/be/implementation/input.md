# `be/implementation` input

The input is an ephemeral object owned by the current task session. It is never written to `.worktrees`, the repository, logs, or a receipt file. The runtime deletes it when the parent skill reaches any terminal state.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| `schemaVersion`, `runId`, `stage`, `status`, `facts` | Skill state machine | Bind the operator to one accepted machine transition. |
| `payload.provided` | Previous machine state | Supply immutable references already approved for this operation. |
| `payload.loads` | Runtime resolver | Declare the exact business, boundary, knowledge, source-file, and orchestration bindings that the operator will load. |
| `payload.session` | Session runtime | Name task-local input, output, and scratch slots and their cleanup lifetime. |

### Provided data

`payload.provided` contains only references. The operator must not replace them, infer substitutes, or broaden their scope:

- `approvedBoundaryRef`: the approved backend boundary held in the task session.
- `approvalReceiptRef`: the approval that binds the exact boundary revision.
- `businessHeadRef`: the business head snapshot already selected by the machine.
- `baselineCommitRef`: the Git revision against which source hashes were approved.

### Data that will be loaded

`payload.loads` is produced by the runtime, not by the user or an implementation worker:

- `business`: load the exact revision from `.worktrees/business/...` into session memory.
- `boundary`: load the approved boundary object from session memory.
- `knowledge`: retrieve only `be.boundary-planning` from the pinned Qdrant generation.
- `source`: open only `targetFiles`; repository-wide source context is forbidden.
- `orchestration`: resolve one execution mode and one provider mapping.

The bindings contain references, revisions, hashes, and target paths—not copied business documents, source context, or reasoning transcripts. Validate the complete object before loading any binding or changing source.
