# `architecture/conformance` input

Prove implementation and deployment realize approved architecture and persistence ownership before deterministic checks.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route | Parent state machine | Select this atomic capability. |
| `payload.provided.artifactRefs` | Previous state | Supply immutable session refs; source remains observation. |
| `payload.loads.artifacts` | Runtime | Resolve only revision-pinned refs after validation. |
| `payload.loads.knowledge` | Runtime | Retrieve only `architecture.decision-analysis`. |
| `payload.session` | Runtime | Own ephemeral input, output and scratch slots. |

Validation precedes every load. No undeclared source or adjacent capability context is accepted.
