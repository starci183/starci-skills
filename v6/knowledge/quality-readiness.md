# Quality readiness and repair

| Field | Value |
| --- | --- |
| Knowledge ID | `quality.readiness-repair` |
| Operators | `workflow-diagnose, readiness-inventory, rule-binding-check, finding-repair, debt-repay` |
| Search tags | `diagnose, stale, readiness, repair, debt, rule binding, gate` |
| Dependencies | `workspace.routing, quality.source-gates` |

## Record

Diagnosis traces a workflow without mutation. Inventory executes check-only readiness and records measured findings. Rule-binding check proves law, gate, and published machine identities agree. Repair changes only an approved finding boundary and never weakens a gate. Debt repayment acts only on an owner-approved scoped record with baseline and expiry, and closes only evidence that is genuinely green.
