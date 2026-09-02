# architecture-decision — <decisionId>

## Decision

| Field | Value |
| --- | --- |
| Objective | the objective as the person stated it |
| Decision id | `<decisionId>` |
| Selected alternative | `<alternativeId>` |
| Selection policy | `automatic` or `approval-required` |

## Current state

| Boundary | Responsibility | Stores | Evidence |
| --- | --- | --- | --- |
| `boundary-id` | what it does today | `store-a`, `store-b` or — | `path:line@head` |

## Alternatives

| Alternative | Status | Assessment | Rejected because |
| --- | --- | --- | --- |
| `alt-id` | selected | one cell per trade-off axis, in the axis order the person named | — |

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
| `CODE` | what the fallback did, or no rows when none was taken |

```json template-contract
{
  "kind": "architecture-decision",
  "applies": [],
  "title": { "en": "^# architecture-decision — [a-z0-9][a-z0-9-]*$" },
  "sections": [
    { "en": "^## Decision$", "table": { "en": "| Field | Value |" }, "rows": ["Objective", "Decision id", "Selected alternative", "Selection policy"], "cell": { "Value": "\\S" } },
    { "en": "^## Current state$", "table": { "en": "| Boundary | Responsibility | Stores | Evidence |" }, "minRows": 1, "cell": { "Evidence": "\\S" } },
    { "en": "^## Alternatives$", "table": { "en": "| Alternative | Status | Assessment | Rejected because |" }, "minRows": 1, "cell": { "Status": "^(selected|rejected)$" } },
    { "en": "^## Boundaries$", "table": { "en": "| Boundary | Responsibility | Owner | Interfaces | Owns data |" }, "minRows": 1, "cell": { "Owns data": "^(yes|no)$" } },
    { "en": "^## Data ownership$", "table": { "en": "| Store | Owning boundary | Writers | Readers | Migrators | Transaction scope | Backup | Restore |" } },
    { "en": "^## Stack delta$", "table": { "en": "| Component | Status | Justification | Evidence | Compatibility |" }, "minRows": 1, "cell": { "Status": "^(existing|added|replaced|removed|replaced-candidate)$", "Justification": "^(measured-constraint|observed-evidence|requirement-fit|—)$" } },
    { "en": "^## Handoff$", "table": { "en": "| Item | Kind | Detail |" }, "minRows": 1, "cell": { "Kind": "^(invariant|risk|contract|migration|rollback|proof|unknown)$" } },
    { "en": "^## Fallbacks taken$", "table": { "en": "| Code | Action |" }, "cell": { "Code": "^`[A-Z][A-Z0-9_]+`$" } }
  ],
  "rules": null
}
```
