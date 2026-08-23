# Design facade

## LOADS

None.

## Purpose

Reduce discovery cost for frontend design requests without creating another executable capability. The facade selects one existing physical skill and can attach a compact design-knowledge query result.

## Modes

| Mode | Physical skill | Discriminating intent |
|---|---|---|
| `layout` | `starci-fe-design-layout` | new complete page or end-to-end flow |
| `block` | `starci-fe-design-block` | component-impact addition inside an unchanged complete parent |
| `refactor` | `starci-fe-design-refactor` | concrete feedback corrected source-first |
| `reconcile` | `starci-fe-ui-reconcile` | consistency across a closed set of existing surfaces |
| `resolve` | `starci-fe-design-resolve` | accepted source correction learned into durable authority |
| `refresh-references` | `starci-grammar-refresh-references` | stale optional immutable provenance refreshed without authority changes |

Page-impact extension routes to `layout`. Exact micro changes use the plain edit path. `refresh-references` is maintenance, not `resolve`.

## Input

Use the original request, observable impact, routed Source/project, and only explicitly routed grammar/profile identifiers. Similarity must not guess grammar or profile.

## Output

Return the selected mode and physical skill, the discriminating fact, query provenance or typed stop, unresolved facts, and the unchanged invocation envelope.

## Permissions

Selection and pre-dispatch query are read-only. They never use `--rebuild-if-stale`; a missing or stale index stops selection so an explicit cache-maintenance action can rebuild it outside the facade. The facade performs no product, authority, provider, credential, cache, or external-state write and transfers no approval.

## Stops

Stop when one mode cannot be selected, project routing is unresolved, explicit filters are invalid, the query exits `2`, `3`, or `4`, multiple owners remain, or a new boundary is required.

## Authority boundary

The dispatcher starts the selected physical skill separately. That skill alone owns its topology, source boundary, staged approvals, writes, gates, and proof. No new orchestration profile belongs to this facade.
