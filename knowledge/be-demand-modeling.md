# Backend demand modeling

| Field | Value |
| --- | --- |
| Knowledge ID | `be.demand-modeling` |
| Operators | `demand` |
| Search tags | `backend, demand, capability, behavior, invariant, branch, acceptance` |
| Dependencies | `be.request-routing` |

## Record

Normalize an accepted backend request into behavior before choosing files or framework shapes. Name actors or callers, commands and queries, outcomes, invariants, failure branches, authorization decisions, consistency expectations, external effects, and observable acceptance evidence.

## Boundaries

Every behavior must cite business or technical authority. Preserve unknowns instead of filling them with source assumptions. Separate mandatory outcomes from alternatives and explicitly name non-goals. Test obligations are derived now, while implementation branches do not yet bias the list.

Demand modeling never invents entities, tables, handlers, transports, or module placement. Those are source capability facts owned by source discovery. A behavior without authority, an unowned outcome, contradictory invariants, or an untestable acceptance condition blocks the run.
