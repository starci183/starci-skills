# Architecture decision analysis

| Field | Value |
| --- | --- |
| Knowledge ID | `architecture.decision-analysis` |
| Operators | `decision-frame, current-state, alternatives, decision-challenge, decision-handoff` |
| Search tags | `architecture, constraints, current state, alternatives, tradeoff, challenge, handoff` |
| Dependencies | `business.authority-lifecycle, workspace.routing` |

## Record

Architecture analysis is read-only and warranted only for a meaningful cross-boundary correctness, ownership, consistency, security, failure, recovery, capacity, cost, latency, migration, or operability trade-off. Separate fixed intent, measurable constraints, preferences, assumptions, and unknowns. Resolve the exact routed source through `<Source>/.workspaces`, use default repository search to locate the smallest relevant source slice, then bind findings to the source head and exact file references. Reading routed source is evidence discovery, never permission to mutate it.

Generate two to four materially viable alternatives and compare them using the same applicable criteria. Challenge the strongest option under partial failure, retry/idempotency, concurrency, stale state, deletion, recovery, dependency outage, and rollback. Recommend one option, but bind it only after an explicit approval or an input-declared automatic-selection policy. The handoff freezes decision, invariants, risks, affected contracts/data, migration/rollback, proof expectations, and unknowns; it names no implementation files.
