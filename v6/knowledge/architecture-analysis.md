# Architecture decision analysis

| Field | Value |
| --- | --- |
| Knowledge ID | `architecture.decision-analysis` |
| Operators | `decision-frame, current-state, alternatives, decision-challenge, decision-handoff` |
| Search tags | `architecture, constraints, current state, alternatives, tradeoff, challenge, handoff` |
| Dependencies | `business.authority-lifecycle, workspace.routing` |

## Record

Architecture analysis is read-only and warranted only for a meaningful cross-boundary correctness, ownership, consistency, security, failure, recovery, capacity, cost, latency, migration, or operability trade-off. Separate fixed intent, measurable constraints, preferences, assumptions, and unknowns. Trace current state from live routed source.

Generate two to four materially viable alternatives and compare them using the same applicable criteria. Challenge the strongest option under partial failure, retry/idempotency, concurrency, stale state, deletion, recovery, dependency outage, and rollback. The handoff freezes decision, invariants, risks, affected contracts/data, migration/rollback, proof expectations, and unknowns; it names no implementation files.
