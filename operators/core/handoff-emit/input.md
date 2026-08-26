# `core/handoff-emit` input

## JSON architecture

`provided` actively supplies objectiveId, fromCapability, terminalCode. `loads` passively binds artifactRefs, nextCandidateRefs from the current task session. `session` owns closed ephemeral storage; no payload is persisted outside the task.
