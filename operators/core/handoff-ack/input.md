# `core/handoff-ack` input

## JSON architecture

`provided` actively supplies objectiveId, consumerCapability, handoffRef. `loads` passively binds artifactRefs, acceptedSha256 from the current task session. `session` owns closed ephemeral storage; no payload is persisted outside the task.
