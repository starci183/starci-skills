# architecture-decision — decision-id

## Decision

| Field | Value |
| --- | --- |
| Objective | the objective as the person stated it |
| Decision id | `decision-id` |
| Selected alternative | `alternative-id` |
| Selection policy | `automatic` |

## Current state

| Boundary | Responsibility | Stores | Evidence |
| --- | --- | --- | --- |
| `boundary-id` | what it does today | `store-id` or — | `path:line@head` |

## Alternatives

| Alternative | Status | Assessment | Rejected because |
| --- | --- | --- | --- |
| `alternative-id` | selected | one cell per trade-off axis, in the order the person named them | — |

## Boundaries

| Boundary | Responsibility | Owner | Interfaces | Owns data |
| --- | --- | --- | --- | --- |
| `boundary-id` | what it will do | team or service | the contracts it exposes | yes |

## Data ownership

| Store | Owning boundary | Writers | Readers | Migrators | Transaction scope | Backup | Restore |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `store-id` | `boundary-id` | `boundary-id` | `other-boundary` | `boundary-id` | per request | nightly snapshot | tested restore path |

## Stack delta

| Component | Status | Justification | Evidence | Compatibility |
| --- | --- | --- | --- | --- |
| `component-id` | existing | measured-constraint | `path@head` | 5/5 verified, or the axes still unknown |

## Handoff

| Item | Kind | Detail |
| --- | --- | --- |
| one line each | invariant | what must stay true; contracts are named, implementation files never |

## Fallbacks taken

| Code | Action |
| --- | --- |
| `CODE` | what the fallback did; no rows when none was taken |
