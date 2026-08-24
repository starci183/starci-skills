# `business/staleness-check` input

This operator receives no business semantics. It compares only project-scoped authority metadata with the routed source identity.

## JSON architecture

| Section | Ownership | Purpose |
| --- | --- | --- |
| Route envelope | Skill machine | Enter a first check or recheck after publication. |
| `payload.provided` | Previous state | Bind project, route, role, `consumer-read` purpose, and bounded refresh counter. |
| `payload.loads.businessMetadata` | Runtime resolver | Read existence, approval, revision, baseline commit, and content hash below `.worktrees/<project>/businesses/`. |
| `payload.loads.sourceMetadata` | Runtime resolver | Read routed repository, branch, current commit, and route revision. |
| `payload.loads.orchestration` | Runtime resolver | Bind a provider-neutral profile; execution remains coordinator-only. |
| `payload.session` | Session runtime | Hold the ephemeral input, comparison, receipt, and output until skill terminal. |

The runtime must not attach business bodies, source files, Qdrant documents, Principles, Grammar, or coding context.

This gate runs before planning or delivery. After implementation, source HEAD is expected to advance; `business/reconcile` must instead compare the frozen pre-delivery freshness receipt with delivery proof and then advance the business baseline.
