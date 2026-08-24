# Backend source discovery

| Field | Value |
| --- | --- |
| Knowledge ID | `be.source-discovery` |
| Operators | `source-discovery` |
| Search tags | `backend, qdrant, source context, live schema, sibling family, precedent` |
| Dependencies | `be.request-routing, be.demand-modeling` |

## Record

Resolve live backend capability from the verified checkout. Query the routed `/be/<project>/` Qdrant partition to find candidate schemas, modules, handlers, entities, exceptions, transports, tests, and gates; then open the exact source files and record their revision and hashes.

## Evidence rules

Read the live schema rather than remembered field names. Read the nearest sibling family whole, including implementation, exception identity, transport, persistence, tests, and module wiring. If siblings disagree, inventory the family and report the dominant precedent plus exceptions; do not quietly select the nearest example.

Qdrant summaries are indexes, never source authority. A missing candidate triggers broader search; an unreadable file, stale revision, contradictory family, or absent precedent becomes an explicit source gap. The output is an evidence matrix, not a plan and never a source mutation.
