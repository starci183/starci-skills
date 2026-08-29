# `core/handoff-emit` output

- `output.outcome`: `emitted` or `blocked`.
- `output.handoffRef`: immutable handoff reference, else null.
- `output.handoffSha256`: immutable handoff hash, else null.
- `output.retainedArtifactRefs`: refs retained by the runtime until acknowledgement.
- `output.evidenceRefs`: exact emission evidence.
- `output.reason`: blocker explanation, else null.
