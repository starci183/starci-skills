# `be/repair-prerequisite-check` input

This deterministic gate receives only task-session metadata. The caller provides exact project, route, business freshness, business head, approved boundary, approval, finding and baseline references. The runtime resolves four closed metadata bindings: route, business, boundary and repair finding.

## JSON architecture

| Section | Owner | Purpose |
| --- | --- | --- |
| `payload.provided` | previous machine states | Immutable prerequisite references. |
| `payload.loads` | runtime | Exact metadata bindings that will be loaded. |
| `payload.session` | session runtime | Ephemeral input, output and scratch slots. |

The operator loads no Qdrant knowledge, orchestration profile, source index, repository context or source content. A business authority path must be exactly project-scoped under `.worktrees/<project>/businesses/`. All session references must belong to the current task.
